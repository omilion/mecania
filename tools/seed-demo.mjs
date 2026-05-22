import { buildRichDemoOrders, demoSeedNumbers } from './demo-seed-data.mjs';

const baseUrl = (process.env.SEED_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const username = process.env.SEED_USER || 'admin';
const password = process.env.SEED_PASSWORD || process.env.WORKSHOP_DEMO_PASSWORD || 'mecanicok-demo';
const clientBaseUrl = process.env.SEED_PUBLIC_APP_URL || baseUrl;

async function main() {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { userId: username, username, email: username, password },
  });
  if (!login.token) throw new Error('Login no devolvio token.');

  const existing = await request('/api/orders', { token: login.token });
  const existingNumbers = new Set((existing.orders || []).map((order) => order.number));
  const seededNumbers = new Set(demoSeedNumbers());
  const orders = buildRichDemoOrders().filter((order) => !existingNumbers.has(order.number));

  if (!orders.length) {
    console.log(`Seed demo ya existe: ${[...existingNumbers].filter((number) => seededNumbers.has(number)).join(', ')}`);
    console.log('No se crearon ordenes nuevas.');
    return;
  }

  const created = [];
  for (const order of orders) {
    const response = await request('/api/orders', {
      method: 'POST',
      token: login.token,
      body: { order },
    });
    const token = await request(`/api/orders/${encodeURIComponent(response.order.id)}/client-token`, {
      method: 'POST',
      token: login.token,
      body: { clientBaseUrl },
    });
    created.push({ order: response.order, token });
  }

  console.log(`Seed demo creado: ${created.length} orden(es).`);
  for (const item of created) {
    const mechanic = item.order.assignments?.mechanic || item.order.assignedUserId || 'sin mecánico';
    console.log(`- ${item.order.number}: ${item.order.client.name} / ${item.order.vehicle.brand} ${item.order.vehicle.model} / ${item.order.status} / ${mechanic}`);
    console.log(`  Portal cliente: ${item.token.url}`);
  }
}

async function request(path, { method = 'GET', token = '', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} fallo ${response.status}: ${payload?.error || text}`);
  }
  return payload;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
