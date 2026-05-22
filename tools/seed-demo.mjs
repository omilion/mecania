import { highQualitySeedOrder } from '../src/domain.js';

const baseUrl = (process.env.SEED_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const username = process.env.SEED_USER || 'admin';
const password = process.env.SEED_PASSWORD || process.env.WORKSHOP_DEMO_PASSWORD || 'mecanicok-demo';

async function main() {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { userId: username, username, email: username, password },
  });
  if (!login.token) throw new Error('Login no devolvio token.');

  const order = highQualitySeedOrder();
  const created = await request('/api/orders', {
    method: 'POST',
    token: login.token,
    body: { order },
  });

  const token = await request(`/api/orders/${encodeURIComponent(created.order.id)}/client-token`, {
    method: 'POST',
    token: login.token,
    body: { clientBaseUrl: process.env.SEED_PUBLIC_APP_URL || 'http://127.0.0.1:5173' },
  });

  console.log(`Seed creado: ${created.order.number}`);
  console.log(`Orden: ${created.order.id}`);
  console.log(`Portal cliente: ${token.url}`);
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
