import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHttpServer, GEMINI_MODEL, geminiUrl } from '../server/app.mjs';

async function withServer(fn, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'mecanicok-server-'));
  const server = createHttpServer({
    dataDir: join(root, 'data'),
    uploadsDir: join(root, 'uploads'),
    publicDir: options.publicDir,
    env: { WORKSHOP_DEMO_PASSWORD: 'test-demo-pass', ...(options.env || {}) },
    fetchImpl: options.fetchImpl,
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await fn({ baseUrl, root });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
}

async function login(baseUrl, userId = 'admin', password = 'test-demo-pass') {
  const { response, json } = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ userId, password }),
  });
  assert.equal(response.status, 200);
  return { Authorization: `Bearer ${json.token}` };
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const json = await response.json();
  return { response, json };
}

test('auth login returns a bearer token and /me resolves the internal user', async () => {
  await withServer(async ({ baseUrl }) => {
    const loggedIn = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId: 'admin', password: 'test-demo-pass' }),
    });
    assert.equal(loggedIn.response.status, 200);
    assert.match(loggedIn.json.token, /^auth_/);
    assert.equal(loggedIn.json.tokenType, 'Bearer');
    assert.equal(loggedIn.json.user.id, 'admin');
    assert.equal(loggedIn.json.user.email, 'admin@mecanicok.local');
    assert.equal(loggedIn.json.workshop.id, 'wrk-demo');
    assert.equal(loggedIn.json.permissions.deleteOrders, true);
    assert.deepEqual(loggedIn.json.users.map((user) => user.id), ['admin', 'coordinator', 'mechanic', 'mechanic2']);

    const me = await request(baseUrl, '/api/auth/me', {
      headers: { Authorization: `Bearer ${loggedIn.json.token}` },
    });
    assert.equal(me.response.status, 200);
    assert.equal(me.json.user.id, 'admin');
  });
});

test('workshop endpoint exposes current workshop, users and permissions', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl, 'coordinator');
    const context = await request(baseUrl, '/api/workshop', { headers: authHeaders });
    assert.equal(context.response.status, 200);
    assert.equal(context.json.workshop.id, 'wrk-demo');
    assert.equal(context.json.user.id, 'coordinator');
    assert.equal(context.json.permissions.createClientLinks, true);
    assert.equal(context.json.permissions.deleteOrders, false);
    assert.deepEqual(context.json.users.map((user) => user.email), [
      'admin@mecanicok.local',
      'coordinator@mecanicok.local',
      'mechanic@mecanicok.local',
      'mechanic2@mecanicok.local',
    ]);
  });
});

test('auth login accepts internal email aliases', async () => {
  await withServer(async ({ baseUrl }) => {
    const loggedIn = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'mechanic@mecanicok.local', password: 'test-demo-pass' }),
    });
    assert.equal(loggedIn.response.status, 200);
    assert.equal(loggedIn.json.user.id, 'mechanic');
  });
});

test('auth login accepts bare API paths for root API base URLs', async () => {
  await withServer(async ({ baseUrl }) => {
    const loggedIn = await request(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'mechanic@mecanicok.local', password: 'test-demo-pass' }),
    });
    assert.equal(loggedIn.response.status, 200);
    assert.equal(loggedIn.json.user.id, 'mechanic');

    const me = await request(baseUrl, '/auth/me', {
      headers: { Authorization: `Bearer ${loggedIn.json.token}` },
    });
    assert.equal(me.response.status, 200);
    assert.equal(me.json.user.id, 'mechanic');
  });
});

test('auth login rejects invalid credentials', async () => {
  await withServer(async ({ baseUrl }) => {
    const rejected = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId: 'admin', password: 'wrong-pass' }),
    });
    assert.equal(rejected.response.status, 401);
    assert.match(rejected.json.error, /Credenciales/);
  });
});

test('auth login rate limits repeated failures', async () => {
  await withServer(async ({ baseUrl }) => {
    let limited = null;
    for (let attempt = 0; attempt < 9; attempt += 1) {
      limited = await request(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ userId: 'rate-limit-user', password: 'wrong-pass' }),
      });
    }
    assert.equal(limited.response.status, 429);
    assert.match(limited.json.error, /Demasiados intentos/);
  });
});

test('internal routes reject requests without a bearer token', async () => {
  await withServer(async ({ baseUrl }) => {
    const routes = [
      ['/api/orders', { method: 'GET' }],
      ['/api/workshop/users', { method: 'GET' }],
      ['/api/uploads', { method: 'POST', body: JSON.stringify({}) }],
      ['/api/ai', { method: 'POST', body: JSON.stringify({ task: 'inspection', order: {} }) }],
    ];

    for (const [path, options] of routes) {
      const result = await request(baseUrl, path, options);
      assert.equal(result.response.status, 401, path);
      assert.match(result.json.error, /bearer/i);
    }
  });
});

test('server serves built frontend assets for VPS single-process deploy', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mecanicok-public-'));
  const publicDir = join(root, 'dist');
  await mkdir(join(publicDir, 'assets'), { recursive: true });
  await writeFile(join(publicDir, 'index.html'), '<main id="root">MecanicOK shell</main>', 'utf8');
  await writeFile(join(publicDir, 'assets', 'app.js'), 'console.log("ok");', 'utf8');

  try {
    await withServer(async ({ baseUrl }) => {
      const rootPage = await fetch(`${baseUrl}/`);
      assert.equal(rootPage.status, 200);
      assert.match(rootPage.headers.get('content-type'), /text\/html/);
      assert.match(await rootPage.text(), /MecanicOK shell/);
      assert.equal(rootPage.headers.get('cache-control'), 'no-cache');

      const asset = await fetch(`${baseUrl}/assets/app.js`);
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get('content-type'), /javascript/);
      assert.equal(await asset.text(), 'console.log("ok");');
      assert.match(asset.headers.get('cache-control'), /max-age/);

      const spa = await fetch(`${baseUrl}/trabajos/abc`);
      assert.equal(spa.status, 200);
      assert.match(await spa.text(), /MecanicOK shell/);
    }, { publicDir });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('client portal remains public when the order token is valid', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ client: { name: 'Portal Publico' } }),
    });
    assert.equal(created.response.status, 201);

    const clientView = await request(baseUrl, `/api/client/orders/${created.json.clientToken}`);
    assert.equal(clientView.response.status, 200);
    assert.equal(clientView.json.order.client.name, 'Portal Publico');
  });
});

test('orders CRUD persists orders and creates a stable client token', async () => {
  await withServer(async ({ baseUrl, root }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        client: { name: 'Ana' },
        vehicle: { plate: 'AB-CD-12' },
        parts: [{ id: 'p1', name: 'Bomba de agua', status: 'pending' }],
      }),
    });

    assert.equal(created.response.status, 201);
    assert.equal(created.json.order.client.name, 'Ana');
    assert.match(created.json.clientToken, /^cli_/);

    const id = created.json.order.id;
    const patched = await request(baseUrl, `/api/orders/${id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'waiting_parts', client: { phone: '+56912345678' } }),
    });
    assert.equal(patched.response.status, 200);
    assert.equal(patched.json.order.status, 'waiting_parts');
    assert.equal(patched.json.order.client.name, 'Ana');
    assert.equal(patched.json.order.client.phone, '+56912345678');

    const listed = await request(baseUrl, '/api/orders', { headers: authHeaders });
    assert.equal(listed.json.orders.length, 1);

    const persisted = JSON.parse(await readFile(join(root, 'data', 'orders.json'), 'utf8'));
    assert.equal(persisted[0].id, id);
  });
});

test('role permissions block sensitive order actions', async () => {
  await withServer(async ({ baseUrl }) => {
    const adminHeaders = await login(baseUrl, 'admin');
    const mechanicHeaders = await login(baseUrl, 'mechanic');
    const coordinatorHeaders = await login(baseUrl, 'coordinator');
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ client: { name: 'Permisos' } }),
    });
    const id = created.json.order.id;

    const mechanicDelete = await request(baseUrl, `/api/orders/${id}`, {
      method: 'DELETE',
      headers: mechanicHeaders,
    });
    assert.equal(mechanicDelete.response.status, 403);

    const coordinatorDelete = await request(baseUrl, `/api/orders/${id}`, {
      method: 'DELETE',
      headers: coordinatorHeaders,
    });
    assert.equal(coordinatorDelete.response.status, 403);

    const mechanicToken = await request(baseUrl, `/api/orders/${id}/client-token`, {
      method: 'POST',
      headers: mechanicHeaders,
    });
    assert.equal(mechanicToken.response.status, 403);

    const coordinatorToken = await request(baseUrl, `/api/orders/${id}/client-token`, {
      method: 'POST',
      headers: coordinatorHeaders,
    });
    assert.equal(coordinatorToken.response.status, 201);

    const adminDelete = await request(baseUrl, `/api/orders/${id}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert.equal(adminDelete.response.status, 200);
  });
});

test('client token endpoint reads and updates only client-facing fields', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        privateNote: 'no debe exponerse',
        client: { name: 'Luis' },
        parts: [{ id: 'p1', name: 'Filtro', owner: 'client', status: 'pending' }],
        quote: {
          labor: [{ id: 'l1', name: 'Mano de obra', amount: 1000 }],
          parts: [{ id: 'qp1', name: 'Filtro', amount: 2000 }],
          note: 'mantener',
          approved: false,
          rejected: false,
        },
      }),
    });
    const token = created.json.clientToken;

    const clientView = await request(baseUrl, `/api/client/${token}`);
    assert.equal(clientView.response.status, 200);
    assert.equal(clientView.json.order.client.name, 'Luis');
    assert.equal(clientView.json.order.privateNote, undefined);

    const updated = await request(baseUrl, `/api/client/${token}`, {
      method: 'PATCH',
      body: JSON.stringify({
        client: { email: 'luis@example.com', internalScore: 10 },
        parts: [
          { id: 'p1', name: 'Filtro premium', owner: 'mechanic', status: 'received' },
          { id: 'p2', name: 'Inyectado', status: 'received' },
        ],
        quote: { approved: true, labor: [], parts: [], note: 'sobrescribir' },
        privateNote: 'ignorar',
      }),
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.json.order.client.email, 'luis@example.com');
    assert.equal(updated.json.order.client.internalScore, undefined);
    assert.equal(updated.json.order.parts[0].status, 'received');
    assert.equal(updated.json.order.parts[0].name, 'Filtro');
    assert.equal(updated.json.order.parts[0].owner, 'client');
    assert.equal(updated.json.order.parts.length, 1);
    assert.equal(updated.json.order.quote.approved, true);
    assert.equal(updated.json.order.quote.note, 'mantener');
    assert.deepEqual(updated.json.order.quote.labor, [{ id: 'l1', name: 'Mano de obra', amount: 1000 }]);
    assert.deepEqual(updated.json.ignored, ['privateNote']);

    const order = await request(baseUrl, `/api/orders/${created.json.order.id}`, { headers: authHeaders });
    assert.equal(order.json.order.privateNote, 'no debe exponerse');
  });
});

test('client token endpoint can return PUBLIC_APP_URL links', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ client: { name: 'Link VPS' } }),
    });
    const token = await request(baseUrl, `/api/orders/${created.json.order.id}/client-token`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    assert.equal(token.response.status, 201);
    assert.match(token.json.url, /^https:\/\/mecanicok\.example\/piloto\/\?mode=client&token=cli_/);
    assert.equal(token.json.stable, true);
    assert.ok(Date.parse(token.json.expiresAt) > Date.now());
  }, { env: { PUBLIC_APP_URL: 'https://mecanicok.example/piloto/' } });
});

test('client portal exposes safe customer findings and hides internal fields', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        internalNotes: 'no mostrar',
        intakeText: 'texto interno',
        executionNotes: 'trabajo interno',
        client: { name: 'Cliente hallazgos' },
        findings: [
          {
            id: 'f1',
            area: 'Motor',
            severity: 'critico',
            symptom: 'Aceite cafe con leche',
            description: 'Detalle tecnico interno',
            recommendation: 'No encender hasta diagnostico.',
            customerRisk: '',
            laborRequired: 'desmontar',
            requiredParts: 'empaquetadura',
            supplies: 'aceite',
            safetyImpact: 'no_start',
          },
        ],
        tasks: [{ id: 't1', title: 'No mostrar', assignedUserId: 'mechanic' }],
      }),
    });
    const clientView = await request(baseUrl, `/api/client/orders/${created.json.clientToken}`);
    assert.equal(clientView.response.status, 200);
    assert.equal(clientView.json.order.customerFindings.length, 1);
    assert.equal(clientView.json.order.customerFindings[0].area, 'Motor');
    assert.equal(clientView.json.order.customerFindings[0].laborRequired, undefined);
    assert.equal(clientView.json.order.internalNotes, undefined);
    assert.equal(clientView.json.order.tasks, undefined);
    assert.equal(clientView.json.order.intakeText, undefined);
    assert.equal(clientView.json.order.executionNotes, undefined);
  });
});

test('workshop users endpoint exposes the internal test team', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const users = await request(baseUrl, '/api/workshop/users', { headers: authHeaders });
    assert.equal(users.response.status, 200);
    assert.deepEqual(users.json.users.map((user) => user.id), ['admin', 'coordinator', 'mechanic', 'mechanic2']);
    assert.ok(users.json.users.every((user) => user.active));
  });
});

test('order API normalizes assignment and sanitizes internal task payloads', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        assignedTo: 'usr-does-not-exist',
        assignedBy: 'coordinator',
        tasks: [
          {
            id: 'task-1',
            title: ' <b>Validar bujias</b> ',
            status: 'invalid',
            priority: 'urgent',
            targetStep: 'parts',
            assignedTo: 'mechanic',
            createdBy: 'admin',
            injected: 'no debe persistir',
            notes: '<script>alert(1)</script>usar codigo muestra',
          },
          { id: 'task-empty', status: 'done' },
        ],
        comments: [{ id: 'comment-1', userId: 'coordinator', text: '<i>llamar cliente</i>', private: true }],
        events: [{ id: 'event-1', type: 'custom', userId: 'admin', message: '<b>evento</b>', extra: true }],
      }),
    });

    assert.equal(created.response.status, 201);
    assert.equal(created.json.order.assignedTo, '');
    assert.equal(created.json.order.assignedBy, 'coordinator');
    assert.equal(created.json.order.tasks.length, 1);
    assert.equal(created.json.order.tasks[0].title, 'Validar bujias');
    assert.equal(created.json.order.tasks[0].status, 'open');
    assert.equal(created.json.order.tasks[0].assignedTo, 'mechanic');
    assert.equal(created.json.order.tasks[0].targetStep, 'parts');
    assert.equal(created.json.order.tasks[0].injected, undefined);
    assert.equal(created.json.order.tasks[0].notes, 'alert(1)usar codigo muestra');
    assert.equal(created.json.order.comments[0].text, 'llamar cliente');
    assert.equal(created.json.order.comments[0].private, undefined);
    assert.equal(created.json.order.events[0].message, 'evento');
    assert.equal(created.json.order.events[0].extra, undefined);

    const id = created.json.order.id;
    const rejected = await request(baseUrl, `/api/orders/${id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ tasks: { id: 'not-array' } }),
    });
    assert.equal(rejected.response.status, 400);
  });
});

test('upload endpoint stores data URLs under server uploads', async () => {
  await withServer(async ({ baseUrl, root }) => {
    const authHeaders = await login(baseUrl);
    const uploaded = await request(baseUrl, '/api/uploads', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        filename: 'foto prueba.txt',
        kind: 'photo',
        dataUrl: 'data:text/plain;base64,aG9sYQ==',
      }),
    });

    assert.equal(uploaded.response.status, 201);
    assert.equal(uploaded.json.size, 4);
    assert.match(uploaded.json.url, /^\/uploads\/photo-/);

    const stored = await readFile(join(root, 'uploads', uploaded.json.url.split('/').at(-1)), 'utf8');
    assert.equal(stored, 'hola');
  });
});

test('upload endpoint rejects disallowed MIME and deletes stored files', async () => {
  await withServer(async ({ baseUrl, root }) => {
    const authHeaders = await login(baseUrl);
    const rejected = await request(baseUrl, '/api/uploads', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        filename: 'payload.svg',
        kind: 'photo',
        dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
      }),
    });
    assert.equal(rejected.response.status, 415);

    const uploaded = await request(baseUrl, '/api/uploads', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        filename: 'comprobante.txt',
        kind: 'document',
        dataUrl: 'data:text/plain;base64,Y29tcHJvYmFudGU=',
      }),
    });
    assert.equal(uploaded.response.status, 201);
    const file = uploaded.json.url.split('/').at(-1);

    const deleted = await request(baseUrl, `/api/uploads/${file}`, { method: 'DELETE', headers: authHeaders });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.json.ok, true);
    await assert.rejects(() => readFile(join(root, 'uploads', file)), { code: 'ENOENT' });
  });
});

test('client order events endpoint returns portal timestamps metadata', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        number: 'MO-200',
        status: 'quote_sent',
        createdAt: '2026-05-19T10:00:00.000Z',
        updatedAt: '2026-05-19T10:30:00.000Z',
        statusChangedAt: '2026-05-19T10:20:00.000Z',
        quote: { sentAt: '2026-05-19T10:25:00.000Z', approved: false, rejected: false },
      }),
    });

    const events = await request(baseUrl, `/api/client/orders/${created.json.clientToken}/events`);
    assert.equal(events.response.status, 200);
    assert.equal(events.json.orderId, created.json.order.id);
    assert.equal(events.json.number, 'MO-200');
    assert.equal(events.json.status, 'quote_sent');
    assert.deepEqual(events.json.events.map((event) => event.type), ['created', 'status_changed', 'quote_sent', 'updated']);
  });
});

test('AI endpoint is pinned to Gemini 3 flash preview and calls server-side key', async () => {
  assert.equal(GEMINI_MODEL, 'gemini-3-flash-preview');
  assert.match(geminiUrl('abc 123'), /models\/gemini-3-flash-preview:generateContent/);

  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const result = await request(baseUrl, '/api/ai', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ task: 'inspection', order: { intakeText: 'ruido al frenar' } }),
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.json.model, 'gemini-3-flash-preview');
    assert.equal(result.json.fallback, false);
    assert.equal(result.json.text, 'respuesta remota');
  }, {
    env: { GEMINI_API_KEY: 'test-key' },
    fetchImpl: async (url, options) => {
      assert.match(url, /key=test-key$/);
      const body = JSON.parse(options.body);
      assert.match(body.contents[0].parts[0].text, /inspection/);
      return Response.json({
        candidates: [{ content: { parts: [{ text: 'respuesta remota' }] } }],
      });
    },
  });
});

test('AI endpoint uses local fallback when GEMINI_API_KEY is missing', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const result = await request(baseUrl, '/api/ai', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        task: 'parts',
        order: {
          intakeText: 'Chevrolet Sail 2016 se calienta',
          vehicle: { brand: 'Chevrolet', model: 'Sail', year: '2016', engine: '1.4', plate: 'AB-CD-12' },
          parts: [{ name: 'Bomba de agua', status: 'pending' }],
        },
      }),
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.json.model, 'gemini-3-flash-preview');
    assert.equal(result.json.fallback, true);
    assert.match(result.json.warning, /GEMINI_API_KEY/);
    assert.match(result.json.text, /Compatibilidad/);
  });
});

test('AI endpoint uses local fallback for part sheets when GEMINI_API_KEY is missing', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const result = await request(baseUrl, '/api/ai/generate', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        task: 'part_sheet',
        order: {
          number: 'MO-TEST',
          vehicle: { brand: 'Chevrolet', model: 'Sail', year: '2016', engine: '1.4', plate: 'AB-CD-12' },
          parts: [{ id: 'p1', name: 'Termostato', status: 'pending' }],
        },
        context: { part: { id: 'p1', name: 'Termostato' } },
      }),
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.json.fallback, true);
    assert.match(result.json.text, /FICHA DE COTIZACION/);
    assert.match(result.json.text, /Termostato/);
  });
});

test('AI endpoint builds part sheet prompts with target part context', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const result = await request(baseUrl, '/api/ai/generate', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        task: 'part_sheet',
        order: {
          number: 'MO-TEST',
          vehicle: { brand: 'Chevrolet', model: 'Sail', year: '2016', engine: '1.4', plate: 'AB-CD-12' },
          parts: [{ id: 'p1', name: 'Termostato', status: 'pending' }],
        },
        context: { part: { id: 'p1', name: 'Termostato', notes: 'Cliente pide ficha' } },
      }),
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.json.text, 'ficha remota');
  }, {
    env: { GEMINI_API_KEY: 'test-key' },
    fetchImpl: async (url, options) => {
      assert.match(url, /key=test-key$/);
      const body = JSON.parse(options.body);
      const prompt = body.contents[0].parts[0].text;
      assert.match(prompt, /partes|repuestos|repuesto/i);
      assert.match(prompt, /Termostato/);
      assert.match(prompt, /MO-TEST/);
      return Response.json({
        candidates: [{ content: { parts: [{ text: 'ficha remota' }] } }],
      });
    },
  });
});
