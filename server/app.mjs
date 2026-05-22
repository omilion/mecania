import { createServer } from 'node:http';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { newId, nowIso, readJson, writeJson } from './storage.mjs';
import { defaultWorkshop, normalizeOrder, permissionsForRole, workshopUsers } from '../src/domain.js';

export const GEMINI_MODEL = 'gemini-3-flash-preview';

const serverDir = fileURLToPath(new URL('.', import.meta.url));
const defaultDataDir = join(serverDir, 'data');
const defaultUploadsDir = join(serverDir, 'uploads');
const defaultPublicDir = join(serverDir, '..', 'dist');
const defaultOrdersPath = join(defaultDataDir, 'orders.json');
const defaultTokensPath = join(defaultDataDir, 'client-tokens.json');
const defaultAuthSessionsPath = join(defaultDataDir, 'auth-sessions.json');
const maxJsonBytes = 12 * 1024 * 1024;
const maxUploadBytes = 8 * 1024 * 1024;
const authSessionTtlHours = 12;
const defaultClientTokenTtlHours = 72;
const defaultDemoPassword = 'mecanicok-demo';
const loginRateWindowMs = 10 * 60 * 1000;
const loginRateMaxAttempts = 8;
const loginAttempts = new Map();
const allowedUploadKinds = new Set(['photo', 'part', 'document', 'progress', 'other']);
const allowedUploadMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']);
const clientPatchKeys = new Set(['client', 'parts', 'quote']);
const clientFields = ['name', 'phone', 'email', 'address', 'contactConsent'];
const clientPartFields = ['status', 'dueDate', 'notes', 'price', 'photoDataUrl'];
const clientQuoteFields = ['approved', 'rejected', 'customerComment', 'decidedAt'];
const taskPatchFields = ['id', 'title', 'status', 'priority', 'targetStep', 'assignedTo', 'assignedUserId', 'createdAt', 'updatedAt', 'createdBy', 'createdByUserId', 'completedAt', 'dueDate', 'notes'];
const commentPatchFields = ['id', 'userId', 'text', 'createdAt'];
const eventPatchFields = ['id', 'type', 'userId', 'message', 'meta', 'createdAt'];
const scrypt = promisify(scryptCallback);

export function createApp(options = {}) {
  const env = options.env || process.env;
  const dataDir = options.dataDir || env.DATA_DIR || defaultDataDir;
  const ordersPath = options.ordersPath || join(dataDir, 'orders.json');
  const tokensPath = options.tokensPath || join(dataDir, 'client-tokens.json');
  const authSessionsPath = options.authSessionsPath || join(dataDir, 'auth-sessions.json');
  const uploadsDir = options.uploadsDir || env.UPLOADS_DIR || defaultUploadsDir;
  const publicDir = options.publicDir || env.PUBLIC_DIR || defaultPublicDir;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  return async function app(req, res) {
    try {
      if (req.method === 'OPTIONS') return sendEmpty(res, 204);

      const url = new URL(req.url || '/', 'http://localhost');
      const route = routeRequest(req.method || 'GET', url.pathname);
      if (!route) {
        if (req.method === 'GET' && !url.pathname.startsWith('/api')) {
          const served = await serveStaticSite(res, publicDir, url.pathname);
          if (served) return undefined;
        }
        return sendJson(res, 404, { error: 'Ruta no encontrada.' });
      }

      if (route.name === 'health') return sendJson(res, 200, { ok: true });
      if (route.name === 'uploadFile') return serveUpload(res, uploadsDir, route.params.file);

      const body = needsBody(req.method) ? await readJsonBody(req) : undefined;

      if (route.name === 'login') return sendJson(res, 200, await login(authSessionsPath, body, env, req));

      const authUser = route.public ? null : await requireAuth(authSessionsPath, req);
      if (route.name === 'me') return sendJson(res, 200, { user: authUser });
      if (route.name === 'logout') return sendJson(res, 200, await logout(authSessionsPath, req));
      authorizeRoute(route, authUser);

      if (route.name === 'getWorkshop') return sendJson(res, 200, workshopContext(authUser));
      if (route.name === 'listWorkshopUsers') return sendJson(res, 200, { users: workshopUsers.map(publicAuthUser) });
      if (route.name === 'listOrders') return sendJson(res, 200, await listOrders(ordersPath));
      if (route.name === 'createOrder') return sendJson(res, 201, await createOrder(ordersPath, tokensPath, body?.order || body, authUser));
      if (route.name === 'getOrder') return sendJson(res, 200, await getOrder(ordersPath, route.params.id));
      if (route.name === 'updateOrder') return sendJson(res, 200, await updateOrder(ordersPath, route.params.id, body?.order || body, req.method === 'PUT', authUser));
      if (route.name === 'deleteOrder') return sendJson(res, 200, await deleteOrder(ordersPath, tokensPath, route.params.id));
      if (route.name === 'createToken') return sendJson(res, 201, await createClientToken(ordersPath, tokensPath, route.params.id, body, env));
      if (route.name === 'getClientOrder') return sendJson(res, 200, await getClientOrder(ordersPath, tokensPath, route.params.token));
      if (route.name === 'getClientOrderEvents') return sendJson(res, 200, await getClientOrderEvents(ordersPath, tokensPath, route.params.token));
      if (route.name === 'updateClientOrder') return sendJson(res, 200, await updateClientOrder(ordersPath, tokensPath, route.params.token, body?.patch || body));
      if (route.name === 'upload') return sendJson(res, 201, await uploadDataUrl(uploadsDir, body));
      if (route.name === 'deleteUpload') return sendJson(res, 200, await deleteUpload(uploadsDir, route.params.file));
      if (route.name === 'ai') return sendJson(res, 200, await generateAi(body, env, fetchImpl));

      return sendJson(res, 404, { error: 'Ruta no encontrada.' });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.expose === false ? 'Error interno del servidor.' : error.message });
    }
  };
}

export function createHttpServer(options = {}) {
  return createServer(createApp(options));
}

export async function login(sessionsPath = defaultAuthSessionsPath, input = {}, env = process.env, req = null) {
  assertObject(input, 'Credenciales invalidas.');
  const userId = String(input.userId || input.username || input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  const rateKey = loginRateKey(userId, req, env);
  assertLoginRate(rateKey);
  const user = workshopUsers.find((item) => item.active && [item.id, item.email].includes(userId));
  if (!user || !password) {
    recordFailedLogin(rateKey);
    throw httpError(401, 'Credenciales invalidas.');
  }

  const demoPassword = env.WORKSHOP_DEMO_PASSWORD || env.AUTH_DEMO_PASSWORD || defaultDemoPassword;
  const expectedHash = await hashPassword(demoPassword, demoSaltForUser(user.id, env));
  const ok = await verifyPassword(password, expectedHash);
  if (!ok) {
    recordFailedLogin(rateKey);
    throw httpError(401, 'Credenciales invalidas.');
  }

  const token = `auth_${randomBytes(32).toString('base64url')}`;
  const session = {
    id: newId('ses'),
    tokenHash: hashBearerToken(token),
    userId: user.id,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + authSessionTtlHours * 60 * 60 * 1000).toISOString(),
  };
  const sessions = await activeSessions(sessionsPath);
  sessions.push(session);
  await writeJson(sessionsPath, sessions);
  loginAttempts.delete(rateKey);
  return { token, tokenType: 'Bearer', expiresAt: session.expiresAt, ...workshopContext(publicAuthUser(user)) };
}

export async function logout(sessionsPath = defaultAuthSessionsPath, req) {
  const token = bearerToken(req);
  if (!token) return { ok: true };
  const tokenHash = hashBearerToken(token);
  const sessions = await activeSessions(sessionsPath);
  await writeJson(sessionsPath, sessions.filter((session) => session.tokenHash !== tokenHash));
  return { ok: true };
}

export async function requireAuth(sessionsPath = defaultAuthSessionsPath, req) {
  const token = bearerToken(req);
  if (!token) throw httpError(401, 'Token bearer requerido.');
  const tokenHash = hashBearerToken(token);
  const sessions = await activeSessions(sessionsPath);
  const session = sessions.find((item) => item.tokenHash === tokenHash);
  if (!session) throw httpError(401, 'Sesión inválida o expirada.');
  const user = workshopUsers.find((item) => item.active && item.id === session.userId);
  if (!user) throw httpError(401, 'Usuario inactivo.');
  return publicAuthUser(user);
}

export async function listOrders(ordersPath = defaultOrdersPath) {
  const orders = await readJson(ordersPath, []);
  return { orders: orders.map(normalizeOrder) };
}

export async function createOrder(ordersPath = defaultOrdersPath, tokensPath = defaultTokensPath, input = {}, authUser = null) {
  assertObject(input, 'La orden debe ser un objeto JSON.');
  const timestamp = nowIso();
  const actorId = authUser?.id || input.createdByUserId || 'admin';
  const actorRole = authUser?.role || 'admin';
  const order = normalizeOrder({
    id: input.id || newId('ord'),
    number: input.number || `MO-${String(Date.now()).slice(-6)}`,
    status: input.status || 'intake',
    createdAt: input.createdAt || timestamp,
    updatedAt: timestamp,
    ...input,
    workshopId: authUser?.workshopId || input.workshopId || defaultWorkshop.id,
    createdByUserId: actorId,
    updatedByUserId: actorId,
    statusChangedByUserId: actorId,
    assignments: normalizeServerAssignments(input.assignments, authUser, timestamp),
    tasks: sanitizeTasks(input.tasks),
    comments: sanitizeComments(input.comments),
    events: sanitizeEvents(input.events),
  });

  const orders = await readJson(ordersPath, []);
  if (orders.some((existing) => existing.id === order.id)) throw httpError(409, 'Ya existe una orden con ese id.');
  orders.push(order);
  await writeJson(ordersPath, orders);

  const token = await ensureStableToken(tokensPath, order.id);
  return { order, clientToken: token.token };
}

export async function getOrder(ordersPath = defaultOrdersPath, id) {
  const orders = await readJson(ordersPath, []);
  const order = orders.find((item) => item.id === id);
  if (!order) throw httpError(404, 'Orden no encontrada.');
  return { order: normalizeOrder(order) };
}

export async function updateOrder(ordersPath = defaultOrdersPath, id, patch = {}, replace = false, authUser = null) {
  assertObject(patch, 'La actualizacion debe ser un objeto JSON.');
  const orders = await readJson(ordersPath, []);
  const index = orders.findIndex((item) => item.id === id);
  if (index === -1) throw httpError(404, 'Orden no encontrada.');

  const current = normalizeOrder(orders[index]);
  const sanitizedPatch = sanitizeOrderPatch(patch);
  const next = replace
    ? normalizeOrder({ ...sanitizedPatch, id: current.id, createdAt: current.createdAt || nowIso() })
    : normalizeOrder(mergeOrder(current, sanitizedPatch));
  if (authUser?.id) {
    next.updatedByUserId = authUser.id;
    next.workshopId = current.workshopId || authUser.workshopId || defaultWorkshop.id;
    if (next.status !== current.status) next.statusChangedByUserId = authUser.id;
  }
  next.updatedAt = nowIso();
  orders[index] = next;
  await writeJson(ordersPath, orders);
  return { order: next };
}

export async function deleteOrder(ordersPath = defaultOrdersPath, tokensPath = defaultTokensPath, id) {
  const orders = await readJson(ordersPath, []);
  const nextOrders = orders.filter((item) => item.id !== id);
  if (nextOrders.length === orders.length) throw httpError(404, 'Orden no encontrada.');
  await writeJson(ordersPath, nextOrders);

  const tokens = await readJson(tokensPath, []);
  await writeJson(tokensPath, tokens.filter((item) => item.orderId !== id));
  return { ok: true };
}

export async function createClientToken(ordersPath = defaultOrdersPath, tokensPath = defaultTokensPath, orderId, input = {}, env = process.env) {
  await getOrder(ordersPath, orderId);
  assertObject(input || {}, 'La configuracion del token debe ser un objeto JSON.');
  const token = input.stable === false ? createTokenRecord(orderId, input) : await ensureStableToken(tokensPath, orderId);

  if (input.stable === false) {
    const tokens = await readJson(tokensPath, []);
    tokens.push(token);
    await writeJson(tokensPath, tokens);
  }

  return { token: token.token, url: clientTokenUrl(token.token, input.clientBaseUrl || env.PUBLIC_APP_URL || ''), expiresAt: token.expiresAt, stable: token.stable };
}

export async function getClientOrder(ordersPath = defaultOrdersPath, tokensPath = defaultTokensPath, tokenValue) {
  const token = await findValidToken(tokensPath, tokenValue);
  const { order } = await getOrder(ordersPath, token.orderId);
  return { order: clientOrderView(order) };
}

export async function getClientOrderEvents(ordersPath = defaultOrdersPath, tokensPath = defaultTokensPath, tokenValue) {
  const token = await findValidToken(tokensPath, tokenValue);
  const { order } = await getOrder(ordersPath, token.orderId);
  const events = [
    order.createdAt && { type: 'created', at: order.createdAt, label: 'Orden creada' },
    order.statusChangedAt && { type: 'status_changed', at: order.statusChangedAt, status: order.status, label: 'Estado actualizado' },
    order.quote?.sentAt && { type: 'quote_sent', at: order.quote.sentAt, label: 'Cotizacion enviada' },
    order.quote?.decidedAt && {
      type: order.quote.approved ? 'quote_approved' : order.quote.rejected ? 'quote_rejected' : 'quote_decided',
      at: order.quote.decidedAt,
      label: 'Decisión de cotización',
    },
    order.updatedAt && { type: 'updated', at: order.updatedAt, label: 'Orden actualizada' },
  ].filter(Boolean);

  return {
    orderId: order.id,
    number: order.number,
    status: order.status,
    createdAt: order.createdAt || '',
    updatedAt: order.updatedAt || '',
    events,
  };
}

export async function updateClientOrder(ordersPath = defaultOrdersPath, tokensPath = defaultTokensPath, tokenValue, input = {}) {
  assertObject(input, 'La actualizacion cliente debe ser un objeto JSON.');
  const token = await findValidToken(tokensPath, tokenValue);
  const ignored = Object.keys(input).filter((key) => !clientPatchKeys.has(key));
  const orders = await readJson(ordersPath, []);
  const current = orders.find((item) => item.id === token.orderId);
  if (!current) throw httpError(404, 'Orden no encontrada.');

  const allowed = sanitizeClientPatch(current, input);
  const { order } = await updateOrder(ordersPath, token.orderId, allowed, false);
  return { order: clientOrderView(order), ignored };
}

export async function uploadDataUrl(uploadsDir = defaultUploadsDir, input = {}) {
  assertObject(input, 'El upload debe ser un objeto JSON.');
  const { dataUrl, filename = 'upload.bin' } = input;
  const requestedKind = input.kind || uploadKindFromTarget(input.target) || uploadKindFromType(input.type) || 'other';
  const kind = allowedUploadKinds.has(requestedKind) ? requestedKind : 'other';
  if (typeof dataUrl !== 'string') throw httpError(400, 'dataUrl es requerido.');

  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) throw httpError(400, 'dataUrl debe tener formato data URL.');

  const mime = normalizeMime(match[1]);
  if (!allowedUploadMimes.has(mime)) throw httpError(415, 'Tipo de archivo no permitido.');

  const originalName = sanitizeFilename(filename);
  const ext = safeUploadExtension(originalName, mime);
  const storedName = `${kind}-${randomBytes(16).toString('base64url')}${ext}`;
  const buffer = decodeDataUrlPayload(match[3], Boolean(match[2]));
  validateUploadBuffer(buffer, mime);

  await mkdir(uploadsDir, { recursive: true });
  const filePath = join(uploadsDir, storedName);
  await writeFile(filePath, buffer);
  return {
    id: newId('upl'),
    type: input.type || kind,
    caption: input.caption || '',
    dataUrl: `/uploads/${storedName}`,
    filename: originalName,
    kind,
    path: filePath,
    url: `/uploads/${storedName}`,
    size: buffer.length,
  };
}

export async function deleteUpload(uploadsDir = defaultUploadsDir, file) {
  const filePath = safeUploadPath(uploadsDir, file);
  try {
    await unlink(filePath);
    return { ok: true };
  } catch (error) {
    if (error.code === 'ENOENT') throw httpError(404, 'Archivo no encontrado.');
    throw error;
  }
}

function uploadKindFromTarget(target = '') {
  if (target === 'progressPhotos') return 'progress';
  if (target === 'parts') return 'part';
  if (target === 'photos') return 'photo';
  return '';
}

function uploadKindFromType(type = '') {
  const lower = String(type).toLowerCase();
  if (lower.includes('repuesto')) return 'part';
  if (lower.includes('pieza') || lower.includes('proceso') || lower.includes('entrega')) return 'progress';
  if (lower.includes('foto') || lower) return 'photo';
  return '';
}

export async function generateAi(input = {}, env = process.env, fetchImpl = globalThis.fetch) {
  assertObject(input, 'La solicitud IA debe ser un objeto JSON.');
  const task = input.task || 'inspection';
  const order = input.order || {};
  const context = isObject(input.context) ? input.context : {};
  const prompt = input.prompt || buildAiPrompt(task, order, context);
  const apiKey = env.GEMINI_API_KEY || '';

  if (!apiKey) {
    const fallbackText = await tryLocalAi(task, order, context);
    if (fallbackText) {
      return {
        model: GEMINI_MODEL,
        fallback: true,
        text: fallbackText,
        warning: 'Falta GEMINI_API_KEY; se uso fallback local.',
      };
    }
    throw httpError(503, 'Falta GEMINI_API_KEY para usar Gemini server-side.');
  }

  if (typeof fetchImpl !== 'function') throw httpError(500, 'fetch no esta disponible en este runtime.');

  const response = await fetchImpl(geminiUrl(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, topP: 0.8, maxOutputTokens: task === 'part_sheet' ? 2200 : 1200 },
    }),
  });

  if (!response.ok) throw httpError(response.status, `Gemini error ${response.status}.`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n').trim();
  if (!text) throw httpError(502, 'Gemini no devolvio texto util.');
  return { model: GEMINI_MODEL, fallback: false, text };
}

export function geminiUrl(apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function routeRequest(method, pathname) {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (method === 'GET' && pathname === '/health') return { name: 'health', params: {} };
  if (method === 'GET' && parts[0] === 'uploads' && parts.length === 2) return { name: 'uploadFile', params: { file: parts[1] } };
  const apiParts = parts[0] === 'api' ? parts.slice(1) : parts;
  if (!['auth', 'workshop', 'orders', 'client', 'uploads', 'ai'].includes(apiParts[0])) return null;

  if (apiParts[0] === 'auth' && apiParts[1] === 'login' && apiParts.length === 2 && method === 'POST') return { name: 'login', params: {}, public: true };
  if (apiParts[0] === 'auth' && apiParts[1] === 'me' && apiParts.length === 2 && method === 'GET') return { name: 'me', params: {} };
  if (apiParts[0] === 'auth' && apiParts[1] === 'logout' && apiParts.length === 2 && method === 'POST') return { name: 'logout', params: {} };
  if (apiParts[0] === 'workshop' && apiParts.length === 1 && method === 'GET') return { name: 'getWorkshop', params: {} };
  if (apiParts[0] === 'workshop' && apiParts[1] === 'users' && apiParts.length === 2 && method === 'GET') return { name: 'listWorkshopUsers', params: {} };
  if (apiParts[0] === 'orders' && apiParts.length === 1 && method === 'GET') return { name: 'listOrders', params: {} };
  if (apiParts[0] === 'orders' && apiParts.length === 1 && method === 'POST') return { name: 'createOrder', params: {} };
  if (apiParts[0] === 'orders' && apiParts.length === 2 && method === 'GET') return { name: 'getOrder', params: { id: apiParts[1] } };
  if (apiParts[0] === 'orders' && apiParts.length === 2 && ['PATCH', 'PUT'].includes(method)) return { name: 'updateOrder', params: { id: apiParts[1] } };
  if (apiParts[0] === 'orders' && apiParts.length === 2 && method === 'DELETE') return { name: 'deleteOrder', params: { id: apiParts[1] } };
  if (apiParts[0] === 'orders' && apiParts.length === 3 && apiParts[2] === 'client-token' && method === 'POST') {
    return { name: 'createToken', params: { id: apiParts[1] } };
  }
  if (apiParts[0] === 'client' && apiParts.length === 2 && method === 'GET') return { name: 'getClientOrder', params: { token: apiParts[1] }, public: true };
  if (apiParts[0] === 'client' && apiParts.length === 2 && ['PATCH', 'PUT'].includes(method)) return { name: 'updateClientOrder', params: { token: apiParts[1] }, public: true };
  if (apiParts[0] === 'client' && apiParts[1] === 'orders' && apiParts.length === 3 && method === 'GET') return { name: 'getClientOrder', params: { token: apiParts[2] }, public: true };
  if (apiParts[0] === 'client' && apiParts[1] === 'orders' && apiParts.length === 3 && ['PATCH', 'PUT'].includes(method)) return { name: 'updateClientOrder', params: { token: apiParts[2] }, public: true };
  if (apiParts[0] === 'client' && apiParts[1] === 'orders' && apiParts.length === 4 && apiParts[3] === 'events' && method === 'GET') {
    return { name: 'getClientOrderEvents', params: { token: apiParts[2] }, public: true };
  }
  if (apiParts[0] === 'uploads' && apiParts.length === 1 && method === 'POST') return { name: 'upload', params: {} };
  if (apiParts[0] === 'uploads' && apiParts.length === 2 && method === 'DELETE') return { name: 'deleteUpload', params: { file: apiParts[1] } };
  if (apiParts[0] === 'ai' && apiParts.length === 1 && method === 'POST') return { name: 'ai', params: {} };
  if (apiParts[0] === 'ai' && apiParts[1] === 'generate' && apiParts.length === 2 && method === 'POST') return { name: 'ai', params: {} };
  return null;
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxJsonBytes) throw httpError(413, 'JSON demasiado grande.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw httpError(400, 'JSON invalido.');
  }
}

function needsBody(method) {
  return ['POST', 'PUT', 'PATCH'].includes(method || '');
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...corsHeaders(),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendEmpty(res, status) {
  res.writeHead(status, {
    ...corsHeaders(),
  });
  res.end();
}

async function serveStaticSite(res, publicDir, pathname) {
  const targetPath = safeStaticPath(publicDir, pathname);
  const fallbackPath = safeStaticPath(publicDir, '/index.html');
  const filePath = await readableFile(targetPath) ? targetPath : fallbackPath;
  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mimeForExt(extname(filePath)),
      'Content-Length': content.length,
      'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(content);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function serveUpload(res, uploadsDir, file) {
  const safeName = basename(String(file || ''));
  const filePath = safeUploadPath(uploadsDir, safeName);
  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      ...corsHeaders(),
      'Content-Type': mimeForExt(extname(safeName)),
      'Content-Length': content.length,
      'Cache-Control': 'private, no-store',
    });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') throw httpError(404, 'Archivo no encontrado.');
    throw error;
  }
}

async function readableFile(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

function sanitizeClientPatch(current, input) {
  const allowed = {};
  if ('client' in input) {
    assertObject(input.client, 'client debe ser un objeto JSON.');
    allowed.client = pick(input.client, clientFields);
  }
  if ('parts' in input) {
    allowed.parts = sanitizeClientParts(current.parts || [], input.parts);
  }
  if ('quote' in input) {
    assertObject(input.quote, 'quote debe ser un objeto JSON.');
    allowed.quote = sanitizeClientQuote(current.quote || {}, input.quote);
  }
  return allowed;
}

function sanitizeOrderPatch(patch) {
  const next = { ...patch };
  if ('tasks' in next) next.tasks = sanitizeTasks(next.tasks);
  if ('comments' in next) next.comments = sanitizeComments(next.comments);
  if ('events' in next) next.events = sanitizeEvents(next.events);
  return next;
}

function authorizeRoute(route, authUser = {}) {
  const permissionByRoute = {
    deleteOrder: 'deleteOrders',
    createToken: 'createClientLinks',
  };
  const permission = permissionByRoute[route.name];
  if (!permission) return;
  if (authUser?.permissions?.[permission]) return;
  throw httpError(403, 'Tu rol no tiene permiso para esta accion.');
}

function workshopContext(authUser = {}) {
  return {
    workshop: defaultWorkshop,
    user: authUser,
    permissions: authUser.permissions || permissionsForRole(authUser.role),
    users: workshopUsers.map(publicAuthUser),
  };
}

function normalizeServerAssignments(assignments = {}, authUser = null, timestamp = nowIso()) {
  const actorId = authUser?.id || assignments.updatedBy || 'admin';
  const actorRole = authUser?.role || 'admin';
  return {
    responsible: assignments.responsible || (['admin', 'coordinator'].includes(actorRole) ? actorId : ''),
    coordinator: assignments.coordinator || 'coordinator',
    mechanic: assignments.mechanic || (actorRole === 'mechanic' ? actorId : 'mechanic'),
    updatedBy: actorId,
    updatedAt: timestamp,
  };
}

function sanitizeTasks(tasks) {
  if (tasks === undefined) return [];
  if (!Array.isArray(tasks)) throw httpError(400, 'tasks debe ser un arreglo.');
  return tasks.filter(isObject).map((task) => pick(task, taskPatchFields));
}

function sanitizeComments(comments) {
  if (comments === undefined) return [];
  if (!Array.isArray(comments)) throw httpError(400, 'comments debe ser un arreglo.');
  return comments.filter(isObject).map((comment) => pick(comment, commentPatchFields));
}

function sanitizeEvents(events) {
  if (events === undefined) return [];
  if (!Array.isArray(events)) throw httpError(400, 'events debe ser un arreglo.');
  return events.filter(isObject).map((event) => pick(event, eventPatchFields));
}

function sanitizeClientParts(currentParts, incomingParts) {
  if (!Array.isArray(incomingParts)) throw httpError(400, 'parts debe ser un arreglo.');
  const byId = new Map(incomingParts.filter(isObject).map((part) => [String(part.id || ''), part]));
  return currentParts.map((part) => {
    const incoming = byId.get(String(part.id || ''));
    if (!incoming) return part;
    return { ...part, ...pick(incoming, clientPartFields), id: part.id, name: part.name, owner: part.owner };
  });
}

function sanitizeClientQuote(currentQuote, incomingQuote) {
  const quote = pick(incomingQuote, clientQuoteFields);
  const approved = quote.approved === true;
  const rejected = quote.rejected === true;
  if (approved || rejected) {
    quote.approved = approved;
    quote.rejected = rejected && !approved;
    quote.decidedAt = quote.decidedAt || nowIso();
  }
  return { ...currentQuote, ...quote };
}

function safeUploadPath(uploadsDir, file) {
  const safeName = basename(String(file || ''));
  if (!safeName) throw httpError(400, 'Archivo invalido.');
  const root = resolve(uploadsDir);
  const filePath = resolve(root, safeName);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) throw httpError(400, 'Archivo invalido.');
  return filePath;
}

function safeStaticPath(publicDir, pathname = '/') {
  const root = resolve(publicDir);
  const decoded = decodeURIComponent(String(pathname || '/'));
  const clean = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const filePath = resolve(root, clean);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) throw httpError(400, 'Ruta estatica invalida.');
  return filePath;
}

function corsHeaders() {
  const origin = process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function mergeOrder(current, patch) {
  return {
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt || nowIso(),
    vehicle: isObject(patch.vehicle) ? { ...(current.vehicle || {}), ...patch.vehicle } : current.vehicle,
    client: isObject(patch.client) ? { ...(current.client || {}), ...patch.client } : current.client,
    quote: isObject(patch.quote) ? { ...(current.quote || {}), ...patch.quote } : current.quote,
  };
}

async function ensureStableToken(tokensPath, orderId) {
  const tokens = await readJson(tokensPath, []);
  const existing = tokens.find((item) => item.orderId === orderId && item.stable === true && !tokenExpired(item));
  if (existing) return existing;
  const token = createTokenRecord(orderId, { stable: true });
  await writeJson(tokensPath, [...tokens.filter((item) => !(item.orderId === orderId && item.stable === true && tokenExpired(item))), token]);
  return token;
}

function createTokenRecord(orderId, input = {}) {
  const ttlHours = Number(input.ttlHours || defaultClientTokenTtlHours);
  return {
    token: input.token || newId('cli').replaceAll('-', ''),
    orderId,
    stable: input.stable !== false,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString(),
  };
}

async function findValidToken(tokensPath, tokenValue) {
  const tokens = await readJson(tokensPath, []);
  const token = tokens.find((item) => item.token === tokenValue);
  if (!token) throw httpError(404, 'Token cliente no encontrado.');
  if (token.expiresAt && Date.parse(token.expiresAt) < Date.now()) throw httpError(401, 'Token cliente expirado.');
  return token;
}

function tokenExpired(token) {
  return Boolean(token?.expiresAt && Date.parse(token.expiresAt) < Date.now());
}

function clientOrderView(order) {
  return {
    ...pick(order, ['id', 'number', 'status', 'updatedAt', 'vehicle', 'client', 'parts', 'quote', 'risk', 'finalNotes']),
    customerFindings: safeCustomerFindings(order.findings || []),
  };
}

function clientTokenUrl(tokenValue, baseUrl = '') {
  const path = `/?mode=client&token=${encodeURIComponent(tokenValue)}`;
  const cleanBase = String(baseUrl || '').trim().replace(/\/$/, '');
  return cleanBase ? `${cleanBase}${path}` : path;
}

function safeCustomerFindings(findings = []) {
  return findings.filter((finding) => finding && finding.quoteMode !== 'no_cotizar').map((finding) => {
    const severity = finding.severity || 'medio';
    const result = finding.result || 'falla';
    return {
      id: String(finding.id || ''),
      area: String(finding.area || 'General'),
      severity,
      severityLabel: findingSeverityLabel(severity),
      result,
      resultLabel: findingResultLabel(result),
      summary: String(finding.symptom || finding.description || 'Hallazgo registrado por el taller.'),
      recommendation: String(finding.recommendation || 'El taller indicara el siguiente paso recomendado.'),
      risk: String(finding.customerRisk || customerRiskFallback(severity)),
      quoteStatus: quoteModeLabel(finding.quoteMode || 'cotizar'),
      safetyImpact: finding.safetyImpact || 'none',
    };
  });
}

function findingSeverityLabel(severity) {
  return ({ bajo: 'Bajo', medio: 'Medio', alto: 'Alto', critico: 'No circular' })[severity] || 'Medio';
}

function findingResultLabel(result) {
  return ({ ok: 'OK', observacion: 'Observacion', falla: 'Falla', no_revisado: 'No revisado' })[result] || 'Falla';
}

function quoteModeLabel(mode) {
  return ({ cotizar: 'Incluido en cotización', incluido: 'Incluido', recomendado: 'Recomendado', no_cotizar: 'Solo informativo' })[mode] || 'Incluido en cotización';
}

function customerRiskFallback(severity) {
  if (severity === 'critico') return 'No recomendamos circular ni encender si existe riesgo de daño mayor.';
  if (severity === 'alto') return 'Puede causar una falla mayor o dejar el vehículo detenido.';
  if (severity === 'medio') return 'Conviene resolverlo para evitar desgaste o una segunda visita.';
  return 'Riesgo bajo, mantener observado.';
}

async function tryLocalAi(task, order, context = {}) {
  try {
    const { localAi } = await import('../src/aiService.js');
    return localAi(task, order, context);
  } catch {
    return '';
  }
}

function buildAiPrompt(task, order, context = {}) {
  if (task === 'part_sheet') {
    return [
      'Eres un especialista tecnico en identificacion de repuestos automotrices para un taller en Chile.',
      'Genera una ficha de cotizacion en texto plano para que el usuario pueda pedir la pieza correcta en mostrador.',
      'Reglas anti-alucinacion:',
      '- Usa los datos estructurados del software como fuente principal.',
      '- No inventes codigos OEM, equivalencias, medidas, presiones, temperaturas, voltajes ni resistencias.',
      '- Si un dato no esta confirmado, escribe NO CONFIRMADO.',
      '- Advierte sobre gemelos visuales y parametros internos si aplica.',
      '- VIN, codigo OEM y catalogo oficial tienen prioridad sobre inferencias.',
      '- Devuelve solo la ficha final en texto plano, sin markdown.',
      `Orden JSON: ${JSON.stringify(order)}`,
      `Repuesto objetivo JSON: ${JSON.stringify(context.part || {})}`,
      'Secciones obligatorias: identificacion del vehiculo, repuesto solicitado, nivel de confianza, codigos, parametros criticos, medidas fisicas, vehiculos hermanos/busqueda alternativa, advertencias finales.',
    ].join('\n');
  }
  return [
    'Eres un asistente operativo para un taller mecánico en Chile.',
    'No reemplazas al mecánico; ordenas información y redactas mensajes claros.',
    `Tarea: ${task}.`,
    `Orden JSON: ${JSON.stringify(order)}`,
    'Devuelve solo texto util, sin inventar datos tecnicos ausentes.',
  ].join('\n');
}

function sanitizeFilename(filename) {
  const name = basename(String(filename || 'upload.bin')).replace(/[^a-zA-Z0-9._-]/g, '_');
  return name || 'upload.bin';
}

function normalizeMime(mime = '') {
  return String(mime || '').trim().toLowerCase();
}

function decodeDataUrlPayload(payload, base64) {
  try {
    if (!base64) return Buffer.from(decodeURIComponent(payload), 'utf8');
    if (!/^[a-zA-Z0-9+/=\s]+$/.test(payload) || payload.replace(/\s/g, '').length % 4 !== 0) {
      throw httpError(400, 'dataUrl base64 invalido.');
    }
    return Buffer.from(payload, 'base64');
  } catch (error) {
    if (error.status) throw error;
    throw httpError(400, 'dataUrl invalido.');
  }
}

function validateUploadBuffer(buffer, mime) {
  if (!buffer.length) throw httpError(400, 'Archivo vacio.');
  if (buffer.length > maxUploadBytes) throw httpError(413, 'Archivo demasiado grande.');
  if (mime === 'image/png' && !buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw httpError(400, 'Contenido PNG invalido.');
  }
  if (mime === 'image/jpeg' && !(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9)) {
    throw httpError(400, 'Contenido JPEG invalido.');
  }
  if (mime === 'image/webp' && !(buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP')) {
    throw httpError(400, 'Contenido WEBP invalido.');
  }
  if (mime === 'application/pdf' && buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw httpError(400, 'Contenido PDF invalido.');
  }
}

function safeUploadExtension(filename, mime) {
  const ext = extname(filename).toLowerCase();
  const expected = extensionForMime(mime);
  if (!ext) return expected;
  const allowed = mimeExtensions(mime);
  return allowed.includes(ext) ? ext : expected;
}

function extensionForMime(mime = '') {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
  };
  return map[mime] || '.bin';
}

function mimeExtensions(mime = '') {
  const map = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
  };
  return map[mime] || [];
}

function mimeForExt(ext) {
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

async function activeSessions(sessionsPath) {
  const sessions = await readJson(sessionsPath, []);
  const active = sessions.filter((session) => !session.expiresAt || Date.parse(session.expiresAt) > Date.now());
  if (active.length !== sessions.length) await writeJson(sessionsPath, active);
  return active;
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

async function hashPassword(password, salt = randomBytes(16).toString('base64url')) {
  const derived = await scrypt(String(password), salt, 64);
  return `scrypt:${salt}:${Buffer.from(derived).toString('base64url')}`;
}

async function verifyPassword(password, storedHash) {
  const [scheme, salt, expected] = String(storedHash || '').split(':');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const derived = await scrypt(String(password), salt, 64);
  const actualBuffer = Buffer.from(derived);
  const expectedBuffer = Buffer.from(expected, 'base64url');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function demoSaltForUser(userId, env = process.env) {
  const secret = env.AUTH_PASSWORD_SALT || 'mecanicok-auth-mvp';
  return createHash('sha256').update(`${secret}:${userId}`).digest('base64url');
}

function hashBearerToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

function loginRateKey(userId = '', req = null, env = process.env) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const remote = env.TRUST_PROXY === 'true' && forwarded ? forwarded : req?.socket?.remoteAddress || 'local';
  return `${remote}:${userId || 'unknown'}`;
}

function assertLoginRate(key) {
  const attempt = loginAttempts.get(key);
  if (!attempt) return;
  if (Date.now() - attempt.firstAt > loginRateWindowMs) {
    loginAttempts.delete(key);
    return;
  }
  if (attempt.count >= loginRateMaxAttempts) {
    throw httpError(429, 'Demasiados intentos de login. Espera unos minutos e intenta nuevamente.');
  }
}

function recordFailedLogin(key) {
  const attempt = loginAttempts.get(key);
  if (!attempt || Date.now() - attempt.firstAt > loginRateWindowMs) {
    loginAttempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  loginAttempts.set(key, { ...attempt, count: attempt.count + 1 });
}

function publicAuthUser(user) {
  const authUser = pick(user, ['id', 'workshopId', 'email', 'name', 'role', 'roleLabel', 'focus', 'phone', 'active']);
  return { ...authUser, permissions: permissionsForRole(authUser.role) };
}

function assertObject(value, message) {
  if (!isObject(value)) throw httpError(400, message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pick(source, keys) {
  if (!isObject(source)) return {};
  return keys.reduce((acc, key) => {
    if (key in source) acc[key] = source[key];
    return acc;
  }, {});
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
