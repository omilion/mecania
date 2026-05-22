import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apiUrl,
  ApiClientError,
  AUTH_TOKEN_STORAGE_KEY,
  DEFAULT_API_BASE_URL,
  createClientToken,
  deleteUpload,
  generateAiRemote,
  loadOrdersState,
  loadWorkshopUsers,
  loginInternal,
  logoutInternal,
  normalizeSyncError,
  pollClientOrder,
  refreshClientToken,
  saveOrder,
  uploadPhoto,
} from '../src/apiClient.js';
import { STORAGE_KEY, seedOrder } from '../src/domain.js';

test('apiUrl joins configured base URL and path', () => {
  assert.equal(DEFAULT_API_BASE_URL, '/api');
  assert.equal(apiUrl('/orders', { apiBaseUrl: 'https://api.example.com/v1/' }), 'https://api.example.com/v1/orders');
  assert.equal(apiUrl('orders/abc', { apiBaseUrl: '/api' }), '/api/orders/abc');
});

test('saveOrder sends a PUT request to the order endpoint', async () => {
  const order = seedOrder();
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse({ ...order, remote: true });
  };

  const saved = await saveOrder(order, { apiBaseUrl: 'https://api.example.com', fetch });

  assert.equal(saved.remote, true);
  assert.equal(calls[0].url, `https://api.example.com/orders/${order.id}`);
  assert.equal(calls[0].init.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].init.body), { order });
});

test('loginInternal stores the returned bearer token', async () => {
  const storage = memoryStorage();
  const session = await loginInternal({ email: 'admin@example.com', password: 'secret' }, {
    storage,
    fetch: async () => jsonResponse({
      token: 'token-123',
      user: { id: 'admin', name: 'Admin', role: 'admin' },
    }),
  });

  assert.equal(session.token, 'token-123');
  assert.equal(session.user.id, 'admin');
  assert.equal(storage.getItem(AUTH_TOKEN_STORAGE_KEY), 'token-123');
});

test('internal requests include Authorization bearer from storage', async () => {
  const order = seedOrder();
  const storage = memoryStorage({ [AUTH_TOKEN_STORAGE_KEY]: 'token-abc' });
  const calls = [];
  await saveOrder(order, {
    storage,
    apiBaseUrl: 'https://api.example.com',
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ order });
    },
  });

  assert.equal(calls[0].init.headers.Authorization, 'Bearer token-abc');
});

test('logoutInternal calls API and clears bearer token', async () => {
  const storage = memoryStorage({ [AUTH_TOKEN_STORAGE_KEY]: 'token-abc' });
  const calls = [];
  const result = await logoutInternal({
    storage,
    apiBaseUrl: 'https://api.example.com',
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ ok: true });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].url, 'https://api.example.com/auth/logout');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer token-abc');
  assert.equal(storage.getItem(AUTH_TOKEN_STORAGE_KEY), null);
});

test('401 internal requests do not fall back to local storage', async () => {
  await assert.rejects(
    () => loadOrdersState({
      storage: memoryStorage({ [STORAGE_KEY]: JSON.stringify({ orders: [seedOrder()], activeId: 'x' }) }),
      fetch: async () => jsonResponse({ error: 'Token bearer requerido.' }, { ok: false, status: 401 }),
    }),
    (error) => error.status === 401,
  );
});

test('403 internal requests do not fall back to local storage', async () => {
  await assert.rejects(
    () => saveOrder(seedOrder(), {
      storage: memoryStorage({ [STORAGE_KEY]: JSON.stringify({ orders: [seedOrder()], activeId: 'x' }) }),
      fetch: async () => jsonResponse({ error: 'Sin permiso.' }, { ok: false, status: 403 }),
    }),
    (error) => error.status === 403,
  );
});

test('loadWorkshopUsers reads team users from protected endpoint', async () => {
  const storage = memoryStorage({ [AUTH_TOKEN_STORAGE_KEY]: 'token-abc' });
  const calls = [];
  const users = await loadWorkshopUsers({
    storage,
    apiBaseUrl: 'https://api.example.com',
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ users: [{ id: 'mechanic', role: 'mechanic' }] });
    },
  });

  assert.equal(calls[0].url, 'https://api.example.com/workshop/users');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer token-abc');
  assert.deepEqual(users, [{ id: 'mechanic', role: 'mechanic' }]);
});

test('client portal requests do not include internal bearer token', async () => {
  const order = seedOrder();
  const storage = memoryStorage({ [AUTH_TOKEN_STORAGE_KEY]: 'token-abc' });
  const calls = [];
  await pollClientOrder('client-token', {
    storage,
    intervalMs: 1,
    timeoutMs: 20,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ order });
    },
  });

  assert.equal(calls[0].init.headers, undefined);
});

test('loadOrdersState falls back to local storage when API is unavailable', async () => {
  const order = seedOrder();
  const storage = memoryStorage({
    [STORAGE_KEY]: JSON.stringify({ orders: [order], activeId: order.id }),
  });
  const fetch = async () => {
    throw new Error('network down');
  };

  const state = await loadOrdersState({ fetch, storage });

  assert.equal(state.orders[0].id, order.id);
  assert.equal(state.activeId, order.id);
});

test('uploadPhoto validates dataUrl before calling API or fallback', async () => {
  await assert.rejects(
    () => uploadPhoto({ dataUrl: 'not-a-data-url' }, { fetch: async () => jsonResponse({}) }),
    ApiClientError,
  );
});

test('uploadPhoto returns a local photo record when upload endpoint is unavailable', async () => {
  const uploaded = await uploadPhoto(
    { dataUrl: 'data:image/png;base64,abc123', type: 'Patente', caption: 'vista' },
    { fetch: async () => { throw new Error('offline'); } },
  );

  assert.equal(uploaded.type, 'Patente');
  assert.equal(uploaded.caption, 'vista');
  assert.equal(uploaded.url, 'data:image/png;base64,abc123');
  assert.ok(uploaded.id);
});

test('createClientToken creates a deterministic local token fallback', async () => {
  const token = await createClientToken('order-1', {
    clientBaseUrl: 'https://demo.example.com',
    fetch: async () => { throw new Error('offline'); },
  });

  assert.equal(token.token, 'local-order-1');
  assert.equal(token.url, 'https://demo.example.com/?mode=client&token=local-order-1');
});

test('refreshClientToken uses refresh endpoint when backend supports it', async () => {
  const calls = [];
  const token = await refreshClientToken('order-1', {
    apiBaseUrl: 'https://api.example.com',
    clientBaseUrl: 'https://demo.example.com',
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ token: 'fresh-token', url: '/client/fresh-token' });
    },
  });

  assert.equal(calls[0].url, 'https://api.example.com/orders/order-1/client-token/refresh');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(token.token, 'fresh-token');
  assert.equal(token.url, 'https://demo.example.com/?mode=client&token=fresh-token');
});

test('refreshClientToken falls back locally when refresh endpoint is missing', async () => {
  const token = await refreshClientToken('order-1', {
    clientBaseUrl: 'https://demo.example.com',
    fetch: async () => jsonResponse({ error: 'not found' }, { ok: false, status: 404 }),
  });

  assert.equal(token.token, 'local-order-1');
  assert.equal(token.url, 'https://demo.example.com/?mode=client&token=local-order-1');
});

test('refreshClientToken uses stable token endpoint when only refresh endpoint is missing', async () => {
  let calls = 0;
  const token = await refreshClientToken('order-1', {
    throwOnApiError: true,
    clientBaseUrl: 'https://demo.example.com',
    fetch: async () => {
      calls += 1;
      return calls === 1
        ? jsonResponse({ error: 'missing refresh' }, { ok: false, status: 404 })
        : jsonResponse({ token: 'stable-token' });
    },
  });

  assert.equal(calls, 2);
  assert.equal(token.token, 'stable-token');
  assert.equal(token.url, 'https://demo.example.com/?mode=client&token=stable-token');
});

test('pollClientOrder stops when shouldContinue returns false', async () => {
  const order = seedOrder();
  const updates = [];
  const result = await pollClientOrder('token-1', {
    intervalMs: 1,
    timeoutMs: 20,
    onUpdate: (next) => updates.push(next),
    shouldContinue: (next) => next?.status !== 'ready',
    fetch: async () => jsonResponse({ order: { ...order, status: 'ready' } }),
  });

  assert.equal(result.status, 'ready');
  assert.equal(updates.length, 1);
});

test('deleteUpload deletes remote upload by filename', async () => {
  const calls = [];
  const result = await deleteUpload('/uploads/photo-123.png?cache=1', {
    apiBaseUrl: 'https://api.example.com',
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ ok: true });
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0].url, 'https://api.example.com/uploads/photo-123.png');
  assert.equal(calls[0].init.method, 'DELETE');
});

test('deleteUpload removes matching local photo when API is unavailable', async () => {
  const order = { ...seedOrder(), photos: [{ id: 'photo-1', url: '/uploads/photo-1.png', dataUrl: 'data:image/png;base64,abc' }] };
  const storage = memoryStorage({
    [STORAGE_KEY]: JSON.stringify({ orders: [order], activeId: order.id }),
  });

  const result = await deleteUpload({ id: 'photo-1', url: '/uploads/photo-1.png' }, {
    storage,
    fetch: async () => { throw new Error('offline'); },
  });
  const state = JSON.parse(storage.getItem(STORAGE_KEY));

  assert.equal(result.source, 'local');
  assert.equal(state.orders[0].photos.length, 0);
});

test('generateAiRemote falls back to local AI text', async () => {
  const result = await generateAiRemote('quote', seedOrder(), {
    fetch: async () => { throw new Error('offline'); },
  });

  assert.equal(result.source, 'local');
  assert.match(result.text, /Datos para compatibilidad/);
});

test('generateAiRemote sends part context to the API', async () => {
  const order = seedOrder();
  const part = order.parts[0];
  const result = await generateAiRemote('part_sheet', order, {
    context: { part },
    fetch: async (url, options) => {
      assert.match(url, /\/api\/ai\/generate$/);
      const body = JSON.parse(options.body);
      assert.equal(body.task, 'part_sheet');
      assert.equal(body.context.part.name, part.name);
      return jsonResponse({ text: 'ficha remota' });
    },
  });

  assert.equal(result.text, 'ficha remota');
});

test('remote API errors can be surfaced when throwOnApiError is enabled', async () => {
  await assert.rejects(
    () => loadOrdersState({
      throwOnApiError: true,
      fetch: async () => jsonResponse({ message: 'broken' }, { ok: false, status: 503 }),
    }),
    /broken \(503\)/,
  );
});

test('normalizeSyncError prefers structured API error details', () => {
  const error = new ApiClientError('API error 409', {
    status: 409,
    body: { error: 'sync conflict' },
  });

  assert.equal(normalizeSyncError(error), 'sync conflict (409)');
  assert.equal(normalizeSyncError(null), 'No se pudo sincronizar con la API.');
});

test('normalizeSyncError does not duplicate an existing status suffix', () => {
  const error = new ApiClientError('API error 404 (404)', { status: 404 });

  assert.equal(normalizeSyncError(error), 'API error 404 (404)');
});

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
  };
}

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}
