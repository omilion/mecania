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

    const byPhone = await request(baseUrl, '/api/orders?search=912345678&limit=10&offset=0', { headers: authHeaders });
    assert.equal(byPhone.response.status, 200);
    assert.equal(byPhone.json.total, 1);
    assert.equal(byPhone.json.orders[0].id, id);

    const byPlate = await request(baseUrl, '/api/orders?search=abcd12&status=waiting_parts', { headers: authHeaders });
    assert.equal(byPlate.response.status, 200);
    assert.equal(byPlate.json.total, 1);
    assert.equal(byPlate.json.orders[0].vehicle.plate, 'AB-CD-12');

    const persisted = JSON.parse(await readFile(join(root, 'data', 'orders.json'), 'utf8'));
    assert.equal(persisted[0].id, id);
  });
});

test('clients API lists and updates client data across associated orders', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const first = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        number: 'MO-CLI-001',
        client: { name: 'Cliente Maestro', phone: '+56977777777', address: 'Direccion antigua' },
        vehicle: { plate: 'MA-11-11', vin: 'VIN123456789', oemCodes: 'OEM-A' },
      }),
    });
    const second = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        number: 'MO-CLI-002',
        client: { name: 'Cliente Maestro', phone: '+56977777777', address: 'Direccion antigua' },
        vehicle: { plate: 'MA-22-22' },
      }),
    });
    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 201);

    const listed = await request(baseUrl, '/api/clients?search=77777777&limit=10', { headers: authHeaders });
    assert.equal(listed.response.status, 200);
    assert.equal(listed.json.total, 1);
    assert.equal(listed.json.clients[0].orderIds.length, 2);
    assert.deepEqual(listed.json.clients[0].vehiclePlates.sort(), ['MA-11-11', 'MA-22-22']);

    const clientId = listed.json.clients[0].id;
    const patched = await request(baseUrl, `/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ client: { address: 'Direccion actualizada', email: 'cliente@example.com' } }),
    });
    assert.equal(patched.response.status, 200);
    assert.equal(patched.json.updatedOrders, 2);

    const updatedFirst = await request(baseUrl, `/api/orders/${first.json.order.id}`, { headers: authHeaders });
    const updatedSecond = await request(baseUrl, `/api/orders/${second.json.order.id}`, { headers: authHeaders });
    assert.equal(updatedFirst.json.order.client.address, 'Direccion actualizada');
    assert.equal(updatedSecond.json.order.client.email, 'cliente@example.com');

    const byVin = await request(baseUrl, '/api/orders?search=vin123456789', { headers: authHeaders });
    assert.equal(byVin.json.total, 1);
    assert.equal(byVin.json.orders[0].vehicle.oemCodes, 'OEM-A');
  });
});

test('delete order archives instead of removing from storage and hides archived from normal list', async () => {
  await withServer(async ({ baseUrl, root }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ client: { name: 'Archivo' }, vehicle: { plate: 'ZX-99-11' } }),
    });
    const id = created.json.order.id;

    const deleted = await request(baseUrl, `/api/orders/${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.json.archived, true);
    assert.equal(deleted.json.order.status, 'archived');

    const listed = await request(baseUrl, '/api/orders', { headers: authHeaders });
    assert.equal(listed.json.orders.length, 0);

    const archived = await request(baseUrl, '/api/orders?status=archived&search=zx9911', { headers: authHeaders });
    assert.equal(archived.json.total, 1);
    assert.equal(archived.json.orders[0].id, id);

    const persisted = JSON.parse(await readFile(join(root, 'data', 'orders.json'), 'utf8'));
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].id, id);
    assert.ok(persisted[0].archivedAt);
    assert.ok(persisted[0].events.some((event) => event.type === 'order_archived'));

    const clientMutation = await request(baseUrl, `/api/client/orders/${created.json.clientToken}`, {
      method: 'PATCH',
      body: JSON.stringify({ client: { email: 'archivado@example.com' } }),
    });
    assert.equal(clientMutation.response.status, 403);
  });
});

test('orders list supports search, status filters and bounded pagination', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const fixtures = [
      { number: 'MO-SEA-001', status: 'waiting_parts', client: { name: 'Ana Repuestos', phone: '+56911111111' }, vehicle: { plate: 'AA-BB-11', brand: 'Toyota', model: 'Yaris', year: '2020' } },
      {
        number: 'MO-SEA-002',
        status: 'closed',
        client: { name: 'Bruno Archivo', phone: '+56922222222' },
        vehicle: { plate: 'CC-DD-22', brand: 'Nissan', model: 'Versa', year: '2018', engine: '1.6' },
        findings: [{ id: 'f-closed', area: 'Motor', severity: 'bajo', description: 'Trabajo revisado' }],
        quote: { approved: true, labor: [], parts: [], extras: [] },
      },
      { number: 'MO-SEA-003', status: 'quote_sent', client: { name: 'Carla Cotiza', email: 'carla@example.com' }, vehicle: { plate: 'EE-FF-33', brand: 'Chevrolet', model: 'Sail', year: '2016', engine: '1.4' } },
    ];

    for (const order of fixtures) {
      const created = await request(baseUrl, '/api/orders', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(order),
      });
      assert.equal(created.response.status, 201);
    }

    const searched = await request(baseUrl, '/api/orders?search=sail&status=quote_sent&limit=10', { headers: authHeaders });
    assert.equal(searched.response.status, 200);
    assert.equal(searched.json.total, 1);
    assert.deepEqual(searched.json.orders.map((order) => order.number), ['MO-SEA-003']);

    const closed = await request(baseUrl, '/api/orders?status=closed', { headers: authHeaders });
    assert.equal(closed.response.status, 200);
    assert.deepEqual(closed.json.orders.map((order) => order.number), ['MO-SEA-002']);

    const paged = await request(baseUrl, '/api/orders?limit=2&offset=1', { headers: authHeaders });
    assert.equal(paged.response.status, 200);
    assert.equal(paged.json.total, 3);
    assert.equal(paged.json.limit, 2);
    assert.equal(paged.json.offset, 1);
    assert.deepEqual(paged.json.orders.map((order) => order.number), ['MO-SEA-002', 'MO-SEA-003']);
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

test('backend permissions allow coordinators but not mechanics to create client links', async () => {
  await withServer(async ({ baseUrl }) => {
    const adminHeaders = await login(baseUrl, 'admin');
    const mechanicHeaders = await login(baseUrl, 'mechanic');
    const coordinatorHeaders = await login(baseUrl, 'coordinator');
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ client: { name: 'Links por rol' } }),
    });
    const id = created.json.order.id;

    const mechanicToken = await request(baseUrl, `/api/orders/${id}/client-token`, {
      method: 'POST',
      headers: mechanicHeaders,
    });
    assert.equal(mechanicToken.response.status, 403);
    assert.match(mechanicToken.json.error, /permiso/i);

    const coordinatorToken = await request(baseUrl, `/api/orders/${id}/client-token`, {
      method: 'POST',
      headers: coordinatorHeaders,
    });
    assert.equal(coordinatorToken.response.status, 201);
    assert.match(coordinatorToken.json.token, /^cli_/);
  });
});

test('mechanic order updates are limited to technical fields and assigned tasks', async () => {
  await withServer(async ({ baseUrl }) => {
    const adminHeaders = await login(baseUrl, 'admin');
    const mechanicHeaders = await login(baseUrl, 'mechanic');
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        status: 'inspection',
        client: { name: 'Permisos mecanico' },
        assignedTo: 'mechanic',
        assignedUserId: 'mechanic',
        quote: {
          labor: [{ id: 'l1', name: 'Diagnostico', amount: 1000 }],
          note: 'cotizacion original',
          approved: false,
        },
        tasks: [
          { id: 'task-mechanic', title: 'Registrar prueba', assignedUserId: 'mechanic', status: 'open' },
          { id: 'task-other', title: 'Gestion cliente', assignedUserId: 'coordinator', status: 'open' },
        ],
      }),
    });
    const id = created.json.order.id;

    const reassign = await request(baseUrl, `/api/orders/${id}`, {
      method: 'PATCH',
      headers: mechanicHeaders,
      body: JSON.stringify({ assignedTo: 'mechanic2', assignedUserId: 'mechanic2' }),
    });
    assert.equal(reassign.response.status, 403);

    const quote = await request(baseUrl, `/api/orders/${id}`, {
      method: 'PATCH',
      headers: mechanicHeaders,
      body: JSON.stringify({ quote: { note: 'rebaja no autorizada', labor: [] } }),
    });
    assert.equal(quote.response.status, 403);

    const close = await request(baseUrl, `/api/orders/${id}`, {
      method: 'PATCH',
      headers: mechanicHeaders,
      body: JSON.stringify({ status: 'closed' }),
    });
    assert.equal(close.response.status, 403);

    const replaceClose = await request(baseUrl, `/api/orders/${id}`, {
      method: 'PUT',
      headers: mechanicHeaders,
      body: JSON.stringify({ status: 'closed', quote: { approved: true } }),
    });
    assert.equal(replaceClose.response.status, 403);

    const technical = await request(baseUrl, `/api/orders/${id}`, {
      method: 'PATCH',
      headers: mechanicHeaders,
      body: JSON.stringify({
        status: 'in_progress',
        intakeText: 'Vibra al frenar en ruta',
        vehicle: { plate: 'ME-CH-01', mileage: '180000' },
        findings: [{ id: 'f1', area: 'Frenos', severity: 'medio', description: 'Disco alabeado' }],
        executionNotes: 'Se desmonta rueda delantera izquierda.',
        progressPhotos: [{ id: 'ph1', type: 'Proceso', dataUrl: '/uploads/progress-test.webp' }],
        tasks: [{ id: 'task-mechanic', status: 'done', notes: 'Prueba registrada' }],
      }),
    });
    assert.equal(technical.response.status, 200);
    assert.equal(technical.json.order.status, 'in_progress');
    assert.equal(technical.json.order.intakeText, 'Vibra al frenar en ruta');
    assert.equal(technical.json.order.vehicle.plate, 'ME-CH-01');
    assert.equal(technical.json.order.findings[0].area, 'Frenos');
    assert.equal(technical.json.order.executionNotes, 'Se desmonta rueda delantera izquierda.');
    assert.equal(technical.json.order.progressPhotos[0].id, 'ph1');
    assert.equal(technical.json.order.tasks.find((task) => task.id === 'task-mechanic').status, 'done');
    assert.equal(technical.json.order.tasks.find((task) => task.id === 'task-other').status, 'open');
    assert.equal(technical.json.order.assignedTo, 'mechanic');
    assert.equal(technical.json.order.assignedUserId, 'mechanic');
    assert.equal(technical.json.order.quote.note, 'cotizacion original');
  });
});

test('backend blocks ready delivery transitions until execution gate passes', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ client: { name: 'Gate incompleto' } }),
    });

    const blocked = await request(baseUrl, `/api/orders/${created.json.order.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'ready_delivery' }),
    });
    assert.equal(blocked.response.status, 409);
    assert.match(blocked.json.error, /lista para entrega/);

    const ready = await request(baseUrl, `/api/orders/${created.json.order.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'ready_delivery',
        client: { phone: '+56912345678' },
        vehicle: { brand: 'Toyota', model: 'Yaris', year: '2020', engine: '1.5' },
        findings: [{ id: 'f1', area: 'Frenos', severity: 'bajo', description: 'Pastillas reemplazadas' }],
        quote: { approved: true },
        parts: [],
      }),
    });
    assert.equal(ready.response.status, 200);
    assert.equal(ready.json.order.status, 'ready_delivery');
  });
});

test('order update API rejects direct event tampering', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ events: [{ id: 'seed-event', type: 'legacy', message: '<b>ok</b>', unsafe: true }] }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.json.order.events[0].message, 'ok');
    assert.equal(created.json.order.events[0].unsafe, undefined);

    const tampered = await request(baseUrl, `/api/orders/${created.json.order.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ events: [] }),
    });
    assert.equal(tampered.response.status, 403);
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

test('client portal can update parts derived from quote items without exposing unsafe mutations', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        client: { name: 'Cliente repuestos' },
        parts: [],
        quote: {
          labor: [],
          parts: [{ id: 'qp-derived', name: 'Termostato', amount: 18000 }],
          extras: [],
          approved: false,
          rejected: false,
        },
      }),
    });

    const updated = await request(baseUrl, `/api/client/orders/${created.json.clientToken}`, {
      method: 'PATCH',
      body: JSON.stringify({
        parts: [
          {
            id: 'qp-derived',
            name: 'Termostato alternativo',
            owner: 'mechanic',
            status: 'received',
            notes: 'Cliente adjunta foto',
            price: 19000,
            validatedBy: 'client',
          },
        ],
      }),
    });

    assert.equal(updated.response.status, 200);
    assert.equal(updated.json.order.parts.length, 1);
    assert.equal(updated.json.order.parts[0].id, 'qp-derived');
    assert.equal(updated.json.order.parts[0].name, 'Termostato');
    assert.equal(updated.json.order.parts[0].owner, 'client');
    assert.equal(updated.json.order.parts[0].status, 'received');
    assert.equal(updated.json.order.parts[0].notes, 'Cliente adjunta foto');
    assert.equal(updated.json.order.parts[0].validatedBy, '');

    const internal = await request(baseUrl, `/api/orders/${created.json.order.id}`, { headers: authHeaders });
    assert.equal(internal.json.order.parts[0].name, 'Termostato');
    assert.equal(internal.json.order.parts[0].owner, 'client');
  });
});

test('client quote confirmation records decidedAt and appears in portal events', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        number: 'MO-CONF-001',
        status: 'quote_sent',
        createdAt: '2026-05-19T10:00:00.000Z',
        updatedAt: '2026-05-19T10:10:00.000Z',
        statusChangedAt: '2026-05-19T10:05:00.000Z',
        quote: {
          sent: true,
          sentAt: '2026-05-19T10:06:00.000Z',
          approved: false,
          rejected: false,
        },
      }),
    });

    const confirmed = await request(baseUrl, `/api/client/orders/${created.json.clientToken}`, {
      method: 'PATCH',
      body: JSON.stringify({ quote: { approved: true, customerComment: 'Aprobado por portal' } }),
    });
    assert.equal(confirmed.response.status, 200);
    assert.equal(confirmed.json.order.quote.approved, true);
    assert.equal(confirmed.json.order.quote.rejected, false);
    assert.equal(confirmed.json.order.quote.customerComment, 'Aprobado por portal');
    assert.ok(Date.parse(confirmed.json.order.quote.decidedAt) > 0);

    const events = await request(baseUrl, `/api/client/orders/${created.json.clientToken}/events`);
    assert.equal(events.response.status, 200);
    assert.ok(events.json.events.some((event) => event.type === 'created'));
    const approvalEvent = events.json.events.find((event) => event.type === 'quote_approved');
    assert.equal(approvalEvent.source, 'client');
    assert.equal(approvalEvent.userId, '');
    assert.match(approvalEvent.message, /Cotizacion aprobada/);
  });
});

test('client tokens cannot mutate closed orders', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        client: { name: 'Cerrado', phone: '+56912345678' },
        vehicle: { brand: 'Toyota', model: 'Yaris', year: '2020', engine: '1.5' },
        findings: [{ id: 'f1', area: 'General', severity: 'bajo', description: 'Trabajo terminado' }],
        quote: { approved: true, labor: [], parts: [], extras: [] },
      }),
    });

    const closed = await request(baseUrl, `/api/orders/${created.json.order.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'closed' }),
    });
    assert.equal(closed.response.status, 200);

    const clientMutation = await request(baseUrl, `/api/client/orders/${created.json.clientToken}`, {
      method: 'PATCH',
      body: JSON.stringify({ client: { email: 'cerrado@example.com' } }),
    });
    assert.equal(clientMutation.response.status, 403);

    const clientRead = await request(baseUrl, `/api/client/orders/${created.json.clientToken}`);
    assert.equal(clientRead.response.status, 200);
    assert.equal(clientRead.json.order.status, 'closed');
  });
});

test('client token endpoint materializes quote parts before applying client updates', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        client: { name: 'Luis' },
        parts: [],
        quote: {
          labor: [],
          parts: [{ id: 'qp1', name: 'Filtro aceite', amount: 2000 }],
          extras: [],
          approved: true,
        },
      }),
    });

    const updated = await request(baseUrl, `/api/client/${created.json.clientToken}`, {
      method: 'PATCH',
      body: JSON.stringify({
        parts: [{
          id: 'qp1',
          name: 'Filtro premium',
          owner: 'mechanic',
          status: 'received',
          dueDate: '2026-05-30',
          notes: 'Comprado por cliente',
          price: 2500,
          photoDataUrl: 'data:image/png;base64,abc',
        }],
      }),
    });

    assert.equal(updated.response.status, 200);
    assert.equal(updated.json.order.parts.length, 1);
    assert.equal(updated.json.order.parts[0].name, 'Filtro aceite');
    assert.equal(updated.json.order.parts[0].owner, 'client');
    assert.equal(updated.json.order.parts[0].status, 'received');
    assert.equal(updated.json.order.parts[0].dueDate, '2026-05-30');
    assert.equal(updated.json.order.parts[0].notes, 'Comprado por cliente');
    assert.equal(updated.json.order.parts[0].price, 2500);
    assert.equal(updated.json.order.parts[0].photoDataUrl, 'data:image/png;base64,abc');
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
    assert.deepEqual(new Set(events.json.events.map((event) => event.type)), new Set(['created', 'status_changed', 'quote_sent', 'updated']));
    assert.ok(events.json.events.find((event) => event.type === 'quote_sent').message);
  });
});

test('order API persists critical quote decision and close events', async () => {
  await withServer(async ({ baseUrl }) => {
    const authHeaders = await login(baseUrl);
    const created = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        number: 'MO-EVENTS',
        client: { name: 'Eventos', phone: '+56912345678' },
        vehicle: { brand: 'Toyota', model: 'Yaris', year: '2020', engine: '1.5' },
        findings: [{ id: 'f1', area: 'General', severity: 'bajo', description: 'Trabajo terminado' }],
        quote: { labor: [{ id: 'l1', name: 'Mano de obra', amount: 1000 }], parts: [], extras: [] },
      }),
    });
    const id = created.json.order.id;

    const sent = await request(baseUrl, `/api/orders/${id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'quote_sent', quote: { sent: true } }),
    });
    assert.equal(sent.response.status, 200);
    assert.match(sent.json.order.quote.sentAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(sent.json.order.events.some((event) => event.type === 'quote_sent'));

    const approved = await request(baseUrl, `/api/orders/${id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ quote: { approved: true } }),
    });
    assert.equal(approved.response.status, 200);
    assert.match(approved.json.order.quote.decidedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(approved.json.order.events.some((event) => event.type === 'quote_approved'));

    const closed = await request(baseUrl, `/api/orders/${id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'closed' }),
    });
    assert.equal(closed.response.status, 200);
    assert.match(closed.json.order.closedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(closed.json.order.events.some((event) => event.type === 'order_closed'));
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
