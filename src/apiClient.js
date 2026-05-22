import { createPhotoRecord, newOrder, STORAGE_KEY } from './domain.js';
import { localAi } from './aiService.js';

export const DEFAULT_API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api';
export const AUTH_TOKEN_STORAGE_KEY = 'mecanicok:authToken';
export const LOCAL_FALLBACK_DISABLED = import.meta.env?.PROD === true || import.meta.env?.VITE_DISABLE_LOCAL_FALLBACK === 'true';

const MEMORY_STORAGE = new Map();

export class ApiClientError extends Error {
  constructor(message, { status = 0, body = null, cause = null } = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.body = body;
    this.cause = cause;
  }
}

export async function loginInternal(credentials = {}, options = {}) {
  const response = await request('/auth/login', {
    method: 'POST',
    body: credentials,
    options: { ...options, authToken: false },
  });
  const session = normalizeAuthSession(response);
  if (session.token) setAuthToken(session.token, options);
  return session;
}

export async function loadAuthenticatedUser(options = {}) {
  const response = await request('/auth/me', { options });
  return normalizeAuthSession(response);
}

export async function loadWorkshopContext(options = {}) {
  return request('/workshop', { options });
}

export async function loadWorkshopUsers(options = {}) {
  const response = await request('/workshop/users', { options });
  return Array.isArray(response?.users) ? response.users : [];
}

export async function logoutInternal(options = {}) {
  try {
    await request('/auth/logout', { method: 'POST', options });
  } finally {
    clearAuthToken(options);
  }
  return { ok: true };
}

export function getAuthToken(options = {}) {
  return storage(options).getItem(AUTH_TOKEN_STORAGE_KEY) || '';
}

export function setAuthToken(token, options = {}) {
  if (!token) return clearAuthToken(options);
  storage(options).setItem(AUTH_TOKEN_STORAGE_KEY, token);
  return token;
}

export function clearAuthToken(options = {}) {
  storage(options).removeItem(AUTH_TOKEN_STORAGE_KEY);
  return '';
}

export async function loadOrdersState(options = {}) {
  return withLocalFallback(
    options,
    async () => {
      const remoteState = await request('/orders', { options });
      if (remoteState?.orders?.length) return remoteState;
      const localState = readLocalState(options);
      return localState.orders?.length ? { ...localState, source: 'local-empty-api' } : remoteState;
    },
    () => readLocalState(options),
  );
}

export async function saveOrder(order, options = {}) {
  requireValue(order?.id, 'order.id');
  return withLocalFallback(
    options,
    async () => {
      try {
        return unwrapOrder(await request(`/orders/${encodeURIComponent(order.id)}`, {
          method: 'PUT',
          body: { order },
          options,
        }));
      } catch (error) {
        if (error.status === 404) {
          return unwrapOrder(await request('/orders', {
            method: 'POST',
            body: { order },
            options,
          }));
        }
        throw error;
      }
    },
    () => upsertLocalOrder(order, options),
  );
}

export async function createOrder(order = newOrder(), options = {}) {
  return withLocalFallback(
    options,
    async () => unwrapOrder(await request('/orders', {
      method: 'POST',
      body: { order },
      options,
    })),
    () => insertLocalOrder(order, options),
  );
}

export async function deleteOrder(orderId, options = {}) {
  requireValue(orderId, 'orderId');
  return withLocalFallback(
    options,
    () => request(`/orders/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
      options,
    }),
    () => deleteLocalOrder(orderId, options),
  );
}

export async function createClientToken(orderId, options = {}) {
  requireValue(orderId, 'orderId');
  return withLocalFallback(
    options,
    async () => normalizeClientToken(await request(`/orders/${encodeURIComponent(orderId)}/client-token`, {
      method: 'POST',
      body: options.clientBaseUrl ? { clientBaseUrl: options.clientBaseUrl } : undefined,
      options,
    }), options),
    () => ({ token: `local-${orderId}`, url: clientUrl(`local-${orderId}`, options) }),
  );
}

export async function refreshClientToken(orderId, options = {}) {
  requireValue(orderId, 'orderId');
  return withLocalFallback(
    options,
    async () => {
      try {
        return normalizeClientToken(await request(`/orders/${encodeURIComponent(orderId)}/client-token/refresh`, {
          method: 'POST',
          body: options.clientBaseUrl ? { clientBaseUrl: options.clientBaseUrl } : undefined,
          options,
        }), options);
      } catch (error) {
        if (error.status === 404 || error.status === 405) return createClientToken(orderId, options);
        throw error;
      }
    },
    () => createClientToken(orderId, { ...options, fetch: async () => { throw new Error('local token refresh fallback'); } }),
  );
}

export async function loadClientOrder(token, options = {}) {
  requireValue(token, 'token');
  return withLocalFallback(
    options,
    async () => unwrapOrder(await request(`/client/orders/${encodeURIComponent(token)}`, { options: { ...options, authToken: false } })),
    () => {
      const orderId = decodeLocalToken(token);
      const state = readLocalState(options);
      const order = state.orders.find((item) => item.id === orderId);
      return order ? localClientOrderView(order) : null;
    },
  );
}

export async function pollClientOrder(token, options = {}) {
  requireValue(token, 'token');
  const {
    intervalMs = 3000,
    timeoutMs = 30000,
    signal,
    onUpdate,
    shouldContinue = () => false,
  } = options;
  const startedAt = Date.now();
  let latest = null;

  while (!signal?.aborted) {
    latest = await loadClientOrder(token, options);
    onUpdate?.(latest);
    if (!shouldContinue(latest)) return latest;
    if (Date.now() - startedAt >= timeoutMs) return latest;
    await delay(Math.min(intervalMs, Math.max(0, timeoutMs - (Date.now() - startedAt))), signal);
  }

  return latest;
}

export async function updateClientOrder(token, patch, options = {}) {
  requireValue(token, 'token');
  if (!patch || typeof patch !== 'object') throw new ApiClientError('patch debe ser un objeto.');

  return withLocalFallback(
    options,
    async () => unwrapOrder(await request(`/client/orders/${encodeURIComponent(token)}`, {
      method: 'PATCH',
      body: { patch },
      options: { ...options, authToken: false },
    })),
    () => {
      const orderId = decodeLocalToken(token);
      if (!orderId) return null;
      const state = readLocalState(options);
      const current = state.orders.find((order) => order.id === orderId);
      if (!current) return null;
      const updated = touchOrder({ ...current, ...patch });
      upsertLocalOrder(updated, options);
      return updated;
    },
  );
}

export async function deleteUpload(upload, options = {}) {
  const uploadRef = typeof upload === 'string' ? upload : upload?.url || upload?.dataUrl || upload?.id;
  requireValue(uploadRef, 'upload');
  return withLocalFallback(
    options,
    () => request(`/uploads/${encodeURIComponent(uploadName(uploadRef))}`, {
      method: 'DELETE',
      options,
    }),
    () => {
      removeLocalUpload(upload, options);
      return { ok: true, deletedId: uploadRef, source: 'local' };
    },
  );
}

export async function uploadPhoto({ dataUrl, type = 'Foto', caption = '', orderId = '', target = 'photos' } = {}, options = {}) {
  requireDataUrl(dataUrl);
  return withLocalFallback(
    options,
    async () => normalizeUpload(await request('/uploads', {
      method: 'POST',
      body: { dataUrl, type, caption, orderId, target },
      options,
    }), options),
    () => {
      const photo = createPhotoRecord(type, dataUrl, caption);
      if (orderId) appendLocalPhoto(orderId, target, photo, options);
      return { ...photo, url: dataUrl };
    },
  );
}

export async function generateAiRemote(task, order, options = {}) {
  requireValue(task, 'task');
  return withLocalFallback(
    options,
    () => request('/ai/generate', {
      method: 'POST',
      body: { task, order },
      options,
    }),
    () => ({ text: localAi(task, order), source: 'local' }),
  );
}

export function normalizeSyncError(error, fallbackMessage = 'No se pudo sincronizar con la API.') {
  if (!error) return fallbackMessage;
  const body = error.body;
  const bodyMessage = typeof body === 'string'
    ? body
    : body?.message || body?.error || body?.detail;
  const message = bodyMessage || error.message || fallbackMessage;
  const status = error.status ? ` (${error.status})` : '';
  return String(message).endsWith(status) ? String(message) : `${message}${status}`;
}

export function apiUrl(path, options = {}) {
  const baseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!baseUrl) return cleanPath;
  return `${baseUrl.replace(/\/$/, '')}${cleanPath}`;
}

async function request(path, { method = 'GET', body, options = {} } = {}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  if (typeof fetcher !== 'function') {
    throw new ApiClientError('Fetch no disponible en este entorno.');
  }

  let response;
  const headers = requestHeaders(body, options);
  try {
    response = await fetcher(apiUrl(path, options), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new ApiClientError('API no disponible.', { cause: error });
  }

  const responseBody = await parseResponseBody(response);
  if (!response.ok) {
    const error = new ApiClientError(`API error ${response.status}`, {
      status: response.status,
      body: responseBody,
    });
    error.message = normalizeSyncError(error, `API error ${response.status}`);
    throw error;
  }
  return responseBody;
}

function requestHeaders(body, options = {}) {
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  const token = options.authToken === false
    ? ''
    : typeof options.authToken === 'string'
      ? options.authToken
      : getAuthToken(options);
  if (token) headers.Authorization = `Bearer ${token}`;
  return Object.keys(headers).length ? headers : undefined;
}

async function parseResponseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function unwrapOrder(responseBody) {
  return responseBody?.order || responseBody;
}

function normalizeClientToken(responseBody, options = {}) {
  if (!responseBody?.token) return responseBody;
  return {
    ...responseBody,
    url: responseBody.url?.startsWith('http')
      ? responseBody.url
      : clientUrl(responseBody.token, options),
  };
}

function normalizeUpload(responseBody, options = {}) {
  if (!responseBody?.url) return responseBody;
  return {
    ...responseBody,
    dataUrl: responseBody.dataUrl?.startsWith('/uploads/')
      ? absoluteFromApi(responseBody.dataUrl, options)
      : responseBody.dataUrl || absoluteFromApi(responseBody.url, options),
    url: absoluteFromApi(responseBody.url, options),
  };
}

function normalizeAuthSession(responseBody = {}) {
  const token = responseBody?.token || responseBody?.accessToken || responseBody?.access_token || '';
  const user = responseBody?.user || responseBody?.account || responseBody?.profile || null;
  const users = Array.isArray(responseBody?.users) ? responseBody.users : [];
  return {
    ...responseBody,
    token,
    user,
    users,
  };
}

function localClientOrderView(order = {}) {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    updatedAt: order.updatedAt,
    vehicle: order.vehicle,
    client: order.client,
    parts: order.parts || [],
    quote: order.quote,
    risk: order.risk || {},
    finalNotes: order.finalNotes || '',
    customerFindings: (order.findings || []).filter((finding) => finding.quoteMode !== 'no_cotizar').map((finding) => ({
      id: finding.id,
      area: finding.area || 'General',
      severity: finding.severity || 'medio',
      severityLabel: ({ bajo: 'Bajo', medio: 'Medio', alto: 'Alto', critico: 'No circular' })[finding.severity] || 'Medio',
      result: finding.result || 'falla',
      resultLabel: ({ ok: 'OK', observacion: 'Observacion', falla: 'Falla', no_revisado: 'No revisado' })[finding.result] || 'Falla',
      summary: finding.symptom || finding.description || 'Hallazgo registrado por el taller.',
      recommendation: finding.recommendation || 'El taller indicara el siguiente paso recomendado.',
      risk: finding.customerRisk || 'Riesgo por confirmar con el taller.',
      quoteStatus: ({ cotizar: 'Incluido en cotizacion', incluido: 'Incluido', recomendado: 'Recomendado', no_cotizar: 'Solo informativo' })[finding.quoteMode] || 'Incluido en cotizacion',
      safetyImpact: finding.safetyImpact || 'none',
    })),
  };
}

function absoluteFromApi(path, options = {}) {
  if (!path || path.startsWith('http') || path.startsWith('data:')) return path;
  const baseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  try {
    const apiUrlObject = new URL(baseUrl, globalThis.location?.origin || 'http://127.0.0.1:8787');
    return `${apiUrlObject.origin}${path.startsWith('/') ? path : `/${path}`}`;
  } catch {
    return path;
  }
}

async function withLocalFallback(options, remote, fallback) {
  try {
    return await remote();
  } catch (error) {
    if ([401, 403].includes(error.status) && options.authToken !== false) throw error;
    if (LOCAL_FALLBACK_DISABLED && options.allowLocalFallback !== true) throw error;
    if (options.throwOnApiError) throw error;
    return fallback(error);
  }
}

function readLocalState(options = {}) {
  try {
    const raw = storage(options).getItem(STORAGE_KEY);
    if (!raw) return { orders: [newOrder()], activeId: null };
    const parsed = JSON.parse(raw);
    return {
      orders: parsed.orders?.length ? parsed.orders : [newOrder()],
      activeId: parsed.activeId || parsed.orders?.[0]?.id || null,
    };
  } catch {
    return { orders: [newOrder()], activeId: null };
  }
}

function writeLocalState(state, options = {}) {
  storage(options).setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

function insertLocalOrder(order, options = {}) {
  const state = readLocalState(options);
  const nextOrder = touchOrder(order);
  writeLocalState({ orders: [nextOrder, ...state.orders], activeId: nextOrder.id }, options);
  return nextOrder;
}

function upsertLocalOrder(order, options = {}) {
  const state = readLocalState(options);
  const nextOrder = touchOrder(order);
  const exists = state.orders.some((item) => item.id === nextOrder.id);
  const orders = exists
    ? state.orders.map((item) => (item.id === nextOrder.id ? nextOrder : item))
    : [nextOrder, ...state.orders];
  writeLocalState({ orders, activeId: nextOrder.id }, options);
  return nextOrder;
}

function deleteLocalOrder(orderId, options = {}) {
  const state = readLocalState(options);
  const orders = state.orders.filter((order) => order.id !== orderId);
  const nextOrders = orders.length ? orders : [newOrder()];
  const activeId = state.activeId === orderId ? nextOrders[0]?.id || null : state.activeId;
  writeLocalState({ orders: nextOrders, activeId }, options);
  return { ok: true, deletedId: orderId, orders: nextOrders, activeId };
}

function appendLocalPhoto(orderId, target, photo, options = {}) {
  const state = readLocalState(options);
  const orders = state.orders.map((order) => {
    if (order.id !== orderId) return order;
    const list = Array.isArray(order[target]) ? order[target] : [];
    return touchOrder({ ...order, [target]: [...list, photo] });
  });
  writeLocalState({ ...state, orders }, options);
}

function removeLocalUpload(upload, options = {}) {
  const state = readLocalState(options);
  const refs = new Set([
    typeof upload === 'string' ? upload : '',
    upload?.id,
    upload?.url,
    upload?.dataUrl,
  ].filter(Boolean));
  const orders = state.orders.map((order) => {
    let changed = false;
    const nextOrder = { ...order };
    for (const key of ['photos', 'diagnosticPhotos', 'progressPhotos', 'handoffPhotos']) {
      if (!Array.isArray(nextOrder[key])) continue;
      const nextList = nextOrder[key].filter((photo) => !refs.has(photo?.id) && !refs.has(photo?.url) && !refs.has(photo?.dataUrl));
      if (nextList.length !== nextOrder[key].length) {
        nextOrder[key] = nextList;
        changed = true;
      }
    }
    return changed ? touchOrder(nextOrder) : order;
  });
  writeLocalState({ ...state, orders }, options);
}

function touchOrder(order) {
  const now = new Date().toISOString();
  return {
    ...order,
    updatedAt: now,
    statusChangedAt: order.statusChangedAt || now,
  };
}

function storage(options = {}) {
  if (options.storage) return options.storage;
  if (globalThis.localStorage) return globalThis.localStorage;
  return {
    getItem: (key) => MEMORY_STORAGE.get(key) ?? null,
    setItem: (key, value) => MEMORY_STORAGE.set(key, value),
    removeItem: (key) => MEMORY_STORAGE.delete(key),
  };
}

function clientUrl(token, options = {}) {
  const baseUrl = options.clientBaseUrl || globalThis.location?.origin || '';
  const path = `/?mode=client&token=${encodeURIComponent(token)}`;
  return baseUrl ? `${baseUrl}${path}` : path;
}

function decodeLocalToken(token) {
  return token?.startsWith('local-') ? token.slice(6) : '';
}

function uploadName(uploadRef) {
  if (!uploadRef) return '';
  const withoutQuery = String(uploadRef).split('?')[0];
  const parts = withoutQuery.split('/');
  return parts.at(-1) || withoutQuery;
}

function delay(ms, signal) {
  if (!ms || ms <= 0 || signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener?.('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

function requireValue(value, name) {
  if (!value) throw new ApiClientError(`Falta ${name}.`);
}

function requireDataUrl(dataUrl) {
  requireValue(dataUrl, 'dataUrl');
  if (!/^data:[^;]+;base64,/.test(dataUrl)) {
    throw new ApiClientError('dataUrl debe ser un data URL base64 valido.');
  }
}
