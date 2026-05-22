const base = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const password = process.env.SMOKE_PASSWORD || process.env.WORKSHOP_DEMO_PASSWORD || 'mecanicok-demo';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

const post = (path, body, headers = {}) => fetch(base + path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const patch = (path, body, headers = {}) => fetch(base + path, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const get = (path, headers = {}) => fetch(base + path, { headers });
const del = (path, headers = {}) => fetch(base + path, { method: 'DELETE', headers });
const json = async (res) => ({ status: res.status, body: await res.json().catch(() => null) });

async function main() {
  const login = await json(await post('/api/auth/login', { email: 'admin@mecanicok.local', password }));
  if (login.status !== 200) throw new Error(`Login fallo ${login.status}`);
  const auth = { Authorization: `Bearer ${login.body.token}` };

  const photos = [];
  for (const type of ['Frontal', 'Trasera', 'Lateral izquierdo', 'Lateral derecho', 'Patente', 'Odometro', 'Tablero', 'Varilla aceite', 'Tapa aceite', 'Deposito refrigerante', 'Zona a revisar']) {
    const upload = await json(await post('/api/uploads', { filename: `${type}.png`, kind: 'photo', dataUrl: png }, auth));
    if (upload.status !== 201) throw new Error(`Upload fallo ${type}`);
    photos.push({
      id: crypto.randomUUID(),
      type,
      caption: `Smoke complejo: ${type}`,
      dataUrl: upload.body.dataUrl || upload.body.url,
      url: upload.body.url,
      filename: upload.body.filename,
      createdAt: new Date().toISOString(),
    });
  }

  const created = await json(await post('/api/orders', {
    status: 'quote_sent',
    priority: 'urgent',
    intakeText: 'Chevrolet D-Max 2.5 diesel 2014 se calento fuerte, consumia agua y el aceite aparece cafe con leche. No encender motor. Cliente pide diagnostico por etapas antes de comprar repuestos.',
    aiIntake: 'Riesgo critico de motor: posible refrigerante en aceite. No encender. Descartar culata, enfriador aceite/EGR y causa de sobrecalentamiento.',
    vehicle: { plate: 'QA-DM-14', brand: 'Chevrolet', model: 'D-Max', year: '2014', engine: '2.5 diesel', mileage: '238000', fuel: 'Diesel', transmission: 'Manual' },
    client: { name: 'Marcelo Araya', phone: '+56911112222', email: 'marcelo.araya@example.com', address: 'Maipu, Santiago', contactConsent: true },
    photos,
    risk: {
      level: 'critical',
      noStart: true,
      summary: 'Posible agua/refrigerante en aceite tras recalentamiento. No encender hasta diagnostico y liberacion tecnica.',
      customerMessage: 'Por seguridad no recomendamos encender ni trasladar andando la camioneta hasta completar el diagnostico.',
    },
    findings: [
      { id: crypto.randomUUID(), area: 'Lubricacion', severity: 'critico', safetyImpact: 'no_start', safetyReason: 'coolant_in_oil', safetyStatus: 'confirmed', description: 'Aceite con aspecto cafe con leche.', recommendation: 'No encender; evaluar contaminacion y presion de aceite.', customerRisk: 'Puede destruir cojinetes o agravar dano interno si se arranca.' },
      { id: crypto.randomUUID(), area: 'Culata', severity: 'critico', safetyImpact: 'no_start', safetyReason: 'overheat', safetyStatus: 'suspected', description: 'Sobrecalentamiento severo con consumo de agua.', recommendation: 'Descartar empaquetadura, deformacion/fisura y enviar culata a prueba si se desmonta.', customerRisk: 'Puede requerir reparacion mayor si se sigue usando.' },
      { id: crypto.randomUUID(), area: 'Refrigeracion', severity: 'alto', description: 'Causa primaria no confirmada.', recommendation: 'Probar presion, termostato, bomba, radiador, tapa y ventiladores.' },
      { id: crypto.randomUUID(), area: 'Enfriador aceite/EGR', severity: 'alto', description: 'En diesel puede mezclar fluidos.', recommendation: 'Descartar antes de condenar culata.' },
    ],
    quote: {
      labor: [
        { id: crypto.randomUUID(), name: 'Diagnostico critico sin encender motor', amount: 55000 },
        { id: crypto.randomUUID(), name: 'Prueba presion refrigeracion + scanner + informe', amount: 45000 },
        { id: crypto.randomUUID(), name: 'Desmontaje/montaje culata diesel 2.5', amount: 480000 },
        { id: crypto.randomUUID(), name: 'Limpieza circuito + purga + doble cambio aceite', amount: 120000 },
      ],
      parts: [
        { id: crypto.randomUUID(), name: 'Empaquetadura culata segun VIN', amount: 0 },
        { id: crypto.randomUUID(), name: 'Pernos culata', amount: 0 },
        { id: crypto.randomUUID(), name: 'Aceite diesel + filtros', amount: 0 },
        { id: crypto.randomUUID(), name: 'Refrigerante compatible', amount: 0 },
      ],
      extras: [{ id: crypto.randomUUID(), name: 'Gestion rectificadora/repuestos', amount: 25000 }],
      note: 'Cotizacion por etapas. No encender ni trasladar andando. Repuestos por confirmar con VIN y pruebas.',
      sent: true,
      approved: false,
      rejected: false,
      customerComment: 'Cliente necesita claridad antes de autorizar reparacion mayor.',
      decidedAt: '',
    },
    parts: [
      { id: crypto.randomUUID(), name: 'Empaquetadura culata segun VIN', owner: 'mechanic', status: 'mechanic_quote', dueDate: 'cotizar tras VIN', notes: 'No comprar aun.' },
      { id: crypto.randomUUID(), name: 'Aceite diesel + filtros', owner: 'mechanic', status: 'pending', dueDate: '', notes: 'Considerar segundo cambio corto.' },
      { id: crypto.randomUUID(), name: 'Refrigerante compatible', owner: 'mechanic', status: 'pending', dueDate: '', notes: 'No entregar con agua.' },
    ],
    tasks: [
      { id: crypto.randomUUID(), title: 'Confirmar VIN/codigo motor', status: 'open', priority: 'urgent', targetStep: 'vehicle', assignedUserId: 'coordinator', createdByUserId: 'admin', dueDate: 'hoy' },
      { id: crypto.randomUUID(), title: 'No encender motor', status: 'open', priority: 'urgent', targetStep: 'inspection', assignedUserId: 'mechanic', createdByUserId: 'admin', dueDate: 'hoy' },
    ],
  }, auth));
  if (created.status !== 201) throw new Error(`Crear orden fallo ${created.status}`);

  const order = created.body.order;
  const token = await json(await post(`/api/orders/${order.id}/client-token`, {}, auth));
  const client = await json(await get(`/api/client/orders/${token.body.token}`));
  if (client.status !== 200 || client.body.order.client.name !== 'Marcelo Araya') throw new Error('Portal cliente fallo');

  const { engineSafetyStatus, executionGate, prepScore, quoteTotal, readinessBadge } = await import('../src/domain.js');
  const execution = executionGate(order);
  if (execution.ok) throw new Error('La ejecucion no deberia estar habilitada');
  if (engineSafetyStatus(order).state !== 'critical') throw new Error('El motor deberia quedar critico/no encender');
  if (readinessBadge(order).label !== 'No encender') throw new Error('El badge deberia decir No encender');
  if (!execution.blockers.includes('Cotizacion aprobada')) throw new Error('Falta bloqueo por cotizacion');
  if (!execution.blockers.some((blocker) => blocker.includes('Motor seguro'))) throw new Error('Falta bloqueo de seguridad motor');
  if (prepScore(order).state === 'green') throw new Error('Repuestos no deberian estar listos');

  if (process.env.SMOKE_KEEP_ORDER !== '1') {
    await del(`/api/orders/${order.id}`, auth);
    for (const photo of photos) {
      const file = photo.url?.split('/').at(-1);
      if (file) await del(`/api/uploads/${encodeURIComponent(file)}`, auth);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    order: order.number,
    kept: process.env.SMOKE_KEEP_ORDER === '1',
    photos: order.photos.length,
    findings: order.findings.length,
    quoteTotal: quoteTotal(order.quote),
    blockers: execution.blockers,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
