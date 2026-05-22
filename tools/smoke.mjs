const baseUrl = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const username = process.env.SMOKE_USER || 'admin';
const password = process.env.SMOKE_PASSWORD || process.env.WORKSHOP_DEMO_PASSWORD || 'mecanicok-demo';

const summary = [];

async function main() {
  const root = await request('/', { expectJson: false });
  check(root.status === 200, 'frontend root responde 200');
  check(root.text.includes('MecanicOK'), 'frontend contiene MecanicOK');

  const health = await request('/health');
  check(health.status === 200 && health.body?.ok === true, 'health OK');

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: username, username, userId: username, password },
  });
  check(login.status === 200 && login.body?.token, 'login interno OK');
  const auth = { Authorization: `Bearer ${login.body.token}` };

  const workshop = await request('/api/workshop', { headers: auth });
  check(workshop.status === 200 && workshop.body?.users?.length >= 3, 'contexto taller con equipo');

  const created = await request('/api/orders', {
    method: 'POST',
    headers: auth,
    body: {
      client: { name: 'Smoke Cliente', phone: '+56911112222' },
      vehicle: { brand: 'Chevrolet', model: 'Sail', year: '2016', engine: '1.4' },
      intakeText: 'Smoke: se calienta y pierde refrigerante.',
    },
  });
  check(created.status === 201 && created.body?.order?.id, 'crear orden');
  const orderId = created.body.order.id;

  const patched = await request(`/api/orders/${orderId}`, {
    method: 'PATCH',
    headers: auth,
    body: {
      status: 'inspection',
      findings: [{
        id: 'smoke-finding',
        area: 'Refrigeracion',
        severity: 'alto',
        description: 'Fuga en bomba de agua',
        recommendation: 'Cambiar bomba y refrigerante compatible.',
      }],
    },
  });
  check(patched.status === 200 && patched.body?.order?.status === 'inspection', 'guardar revision');

  const uploaded = await request('/api/uploads', {
    method: 'POST',
    headers: auth,
    body: {
      filename: 'smoke.txt',
      kind: 'photo',
      dataUrl: 'data:text/plain;base64,aG9sYQ==',
    },
  });
  check(uploaded.status === 201 && uploaded.body?.url, 'upload archivo');

  const token = await request(`/api/orders/${orderId}/client-token`, { method: 'POST', headers: auth });
  check(token.status === 201 && token.body?.token, 'token cliente');

  const client = await request(`/api/client/orders/${token.body.token}`);
  check(client.status === 200 && client.body?.order?.client?.name === 'Smoke Cliente', 'portal cliente abre');

  if (uploaded.body?.url) {
    const file = uploaded.body.url.split('/').at(-1);
    await request(`/api/uploads/${encodeURIComponent(file)}`, { method: 'DELETE', headers: auth, allowFailure: true });
  }
  const deleted = await request(`/api/orders/${orderId}`, { method: 'DELETE', headers: auth });
  check(deleted.status === 200, 'limpieza orden smoke');

  console.log(summary.map((item) => `OK ${item}`).join('\n'));
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const body = options.expectJson === false ? null : parseJson(text);
  if (!options.allowFailure && response.status >= 500) {
    throw new Error(`${path} respondio ${response.status}: ${text}`);
  }
  return { status: response.status, body, text };
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function check(condition, label) {
  if (!condition) throw new Error(`Smoke fallo: ${label}`);
  summary.push(label);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
