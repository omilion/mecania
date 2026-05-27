import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addOrderComment,
  assignOrder,
  createOrderTask,
  engineSafetyStatus,
  executionGate,
  createPhotoRecord,
  extractVehicleHints,
  generateInspection,
  generateIntake,
  generatePartsMessage,
  generateQuoteMessage,
  materializeQuoteParts,
  newOrder,
  normalizeOrder,
  normalizeQuoteAmount,
  normalizeWhatsAppPhone,
  prepScore,
  quotePartItems,
  quoteStages,
  quoteTotal,
  readinessBadge,
  reconcileOrderEvents,
  seedOrder,
  updateOrderTask,
  vehicleSpec,
  workflowStepResponsibilities,
  workflowTargetSteps,
  workshopUsers,
} from '../src/domain.js';

test('extractVehicleHints detects vehicle data from free text', () => {
  const hints = extractVehicleHints('Chevrolet Sail 2016 1.4 patente AB-CD-12 se calienta');
  assert.equal(hints.brand, 'Chevrolet');
  assert.equal(hints.model, 'Sail');
  assert.equal(hints.year, '2016');
  assert.equal(hints.engine, '1.4');
  assert.equal(hints.plate, 'AB-CD-12');
});

test('AI intake includes compatibility rule and vehicle spec', () => {
  const order = seedOrder();
  const message = generateIntake(order);
  assert.match(message, /marca Chevrolet/);
  assert.match(message, /modelo Sail/);
  assert.match(message, /motor\/cilindrada 1.4/);
  assert.match(message, /validar marca, modelo, año, motor\/cilindrada y patente/);
});

test('inspection suggestions include related work for cooling jobs', () => {
  const message = generateInspection(seedOrder());
  assert.match(message, /refrigerante nuevo/);
  assert.match(message, /correa asociada/);
  assert.match(message, /Purgar sistema/);
});

test('quote and parts messages preserve vehicle compatibility data', () => {
  const order = seedOrder();
  assert.match(generateQuoteMessage(order), /Datos para compatibilidad: marca Chevrolet, modelo Sail, año 2016, motor\/cilindrada 1.4/);
  assert.match(generateQuoteMessage(order), /4 cilindros/);
  assert.match(generateQuoteMessage(order), /transmision Manual 5-spd/);
  assert.match(generatePartsMessage(order), /Compatibilidad: marca Chevrolet, modelo Sail, año 2016, motor\/cilindrada 1.4/);
  assert.match(generatePartsMessage(order), /patente AB-CD-12/);
});

test('quoteTotal sums labor, parts and extras', () => {
  assert.equal(quoteTotal(seedOrder().quote), 53000);
});

test('quote amounts are clamped to non-negative finite values', () => {
  assert.equal(normalizeQuoteAmount('-100'), 0);
  assert.equal(normalizeQuoteAmount('abc'), 0);
  assert.equal(quoteTotal({ labor: [{ id: 'l1', name: 'Trabajo', amount: -10 }], parts: [{ id: 'p1', name: 'Pieza', amount: Number.NaN }], extras: [{ id: 'e1', name: 'Extra', amount: 5000 }] }), 5000);
});

test('critical quote and close transitions record timestamps and events', () => {
  const base = normalizeOrder({ quote: { labor: [{ id: 'l1', name: 'Trabajo', amount: 1000 }], parts: [], extras: [] } });
  const sent = reconcileOrderEvents({ ...base, status: 'quote_sent' }, base, 'coordinator', '2026-05-20T10:00:00.000Z');
  assert.equal(sent.quote.sent, true);
  assert.equal(sent.quote.sentAt, '2026-05-20T10:00:00.000Z');
  assert.equal(sent.events.at(-1).type, 'quote_sent');

  const approved = reconcileOrderEvents({ ...sent, quote: { ...sent.quote, approved: true } }, sent, 'coordinator', '2026-05-20T10:05:00.000Z');
  assert.equal(approved.quote.decidedAt, '2026-05-20T10:05:00.000Z');
  assert.equal(approved.events.at(-1).type, 'quote_approved');

  const closed = reconcileOrderEvents({ ...approved, status: 'closed' }, approved, 'coordinator', '2026-05-20T11:00:00.000Z');
  assert.equal(closed.closedAt, '2026-05-20T11:00:00.000Z');
  assert.equal(closed.events.at(-1).type, 'order_closed');
});

test('quote stages are normalized without breaking legacy totals', () => {
  const order = normalizeOrder({
    quote: {
      stages: [
        {
          id: 'diagnostic',
          title: 'Diagnostico',
          status: 'required',
          items: [{ id: 'sl1', kind: 'labor', name: 'Diagnostico sin encender', amount: 55000 }],
        },
        {
          id: 'probable_repair',
          title: 'Reparacion probable',
          status: 'probable',
          items: [{ id: 'sp1', kind: 'part', name: 'Empaquetadura culata', amount: 0 }],
        },
      ],
      labor: [{ id: 'l1', name: 'Legacy', amount: 1 }],
      parts: [],
      extras: [],
    },
  });

  assert.equal(quoteStages(order.quote).length, 2);
  assert.equal(quoteTotal(order.quote), 55000);
  assert.deepEqual(quotePartItems(order.quote).map((item) => item.name), ['Empaquetadura culata']);
});

test('prepScore blocks missing client and pending parts', () => {
  const empty = newOrder();
  assert.equal(prepScore(empty).state, 'red');

  const order = seedOrder();
  assert.equal(prepScore(order).state, 'amber');

  const ready = {
    ...order,
    parts: order.parts.map((part) => ({ ...part, status: 'validated' })),
  };
  assert.equal(prepScore(ready).state, 'green');
});

test('prepScore blocks quote parts that have no tracking records', () => {
  const order = {
    ...seedOrder(),
    parts: [],
    quote: {
      ...seedOrder().quote,
      parts: [{ id: 'part-1', name: 'Bomba de agua', amount: 0 }],
    },
  };
  const score = prepScore(order);
  assert.equal(score.state, 'amber');
  assert.match(score.detail, /sin seguimiento/);
});

test('materializeQuoteParts preserves existing tracking data by id or name', () => {
  const parts = materializeQuoteParts(
    [
      { id: 'p1', name: 'Bomba de agua', amount: 12000 },
      { id: 'p2', name: 'Refrigerante', amount: 7000 },
    ],
    [{ id: 'p1', name: 'Bomba de agua', status: 'received', owner: 'client', dueDate: '2026-05-20' }],
  );
  assert.equal(parts[0].status, 'received');
  assert.equal(parts[0].dueDate, '2026-05-20');
  assert.equal(parts[1].status, 'pending');
  assert.equal(parts[1].price, 7000);
});

test('executionGate requires approval, vehicle identity and ready parts', () => {
  const blocked = seedOrder();
  const blockedGate = executionGate(blocked);
  assert.equal(blockedGate.ok, false);
  assert.ok(blockedGate.blockers.includes('Cotizacion aprobada'));
  assert.ok(blockedGate.blockers.includes('Repuestos listos o sin bloqueo'));

  const ready = {
    ...blocked,
    quote: { ...blocked.quote, approved: true },
    parts: blocked.parts.map((part) => ({ ...part, status: 'validated' })),
  };
  assert.equal(executionGate(ready).ok, true);
});

test('critical engine safety blocks readiness and execution until cleared', () => {
  const base = {
    ...seedOrder(),
    intakeText: 'Motor se calento y agua en aceite. No encender.',
    risk: { level: 'critical', noStart: true, summary: 'Agua/refrigerante en aceite tras recalentamiento.' },
    findings: seedOrder().findings.map((finding) => ({ ...finding, severity: 'alto' })),
    quote: { ...seedOrder().quote, approved: true },
    parts: seedOrder().parts.map((part) => ({ ...part, status: 'validated' })),
  };

  assert.equal(engineSafetyStatus(base).state, 'critical');
  assert.equal(readinessBadge(base).label, 'No encender');
  assert.equal(executionGate(base).ok, false);
  assert.ok(executionGate(base).blockers.some((blocker) => blocker.includes('Motor seguro')));

  const cleared = {
    ...base,
    risk: { ...base.risk, safetyStatus: 'cleared', clearanceNote: 'Aceite drenado sin agua y mecánico autoriza prueba controlada.' },
  };
  assert.equal(engineSafetyStatus(cleared).state, 'normal');
  assert.equal(executionGate(cleared).ok, true);
});

test('vehicleSpec reports missing data clearly', () => {
  assert.equal(vehicleSpec(newOrder()), 'faltan datos de vehículo');
});

test('normalizeWhatsAppPhone handles Chilean mobile numbers', () => {
  assert.equal(normalizeWhatsAppPhone('912345678'), '56912345678');
  assert.equal(normalizeWhatsAppPhone('+56 9 1234 5678'), '56912345678');
  assert.equal(normalizeWhatsAppPhone('12345'), '');
  assert.equal(normalizeWhatsAppPhone('1234567890'), '');
});

test('createPhotoRecord stores image metadata for local persistence', () => {
  const photo = createPhotoRecord('Patente', 'data:image/png;base64,abc123', 'vista inicial');
  assert.equal(photo.type, 'Patente');
  assert.equal(photo.dataUrl, 'data:image/png;base64,abc123');
  assert.equal(photo.caption, 'vista inicial');
  assert.ok(photo.id);
  assert.match(photo.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('closed orders are not shown as regular ready work', () => {
  const order = {
    ...seedOrder(),
    status: 'closed',
    quote: { ...seedOrder().quote, approved: true },
    parts: seedOrder().parts.map((part) => ({ ...part, status: 'validated' })),
  };
  assert.equal(readinessBadge(order).label, 'Cerrada');
});

test('normalizeOrder adds workshop defaults to existing legacy orders', () => {
  const legacy = normalizeOrder({
    id: 'legacy-1',
    number: 'MO-OLD',
    vehicle: { plate: 'AB-CD-12' },
    quote: { parts: [{ id: 'p1', name: 'Filtro' }] },
  });

  assert.equal(legacy.id, 'legacy-1');
  assert.equal(legacy.vehicle.plate, 'AB-CD-12');
  assert.equal(legacy.client.contactConsent, true);
  assert.equal(legacy.assignedTo, 'mechanic');
  assert.deepEqual(legacy.tasks, []);
  assert.deepEqual(legacy.comments, []);
  assert.deepEqual(legacy.events, []);
  assert.equal(legacy.quote.parts[0].name, 'Filtro');
});

test('assignOrder accepts only active workshop users and records an event', () => {
  assert.ok(workshopUsers.some((user) => user.id === 'mechanic'));

  const assigned = assignOrder(newOrder(), 'mechanic', 'coordinator');
  assert.equal(assigned.assignedTo, 'mechanic');
  assert.equal(assigned.assignedBy, 'coordinator');
  assert.equal(assigned.events.at(-1).type, 'order_assigned');

  assert.throws(() => assignOrder(newOrder(), 'usr-unknown', 'coordinator'), /Usuario asignado invalido/);
});

test('workflow responsibilities cover every step with owner and collaborators', () => {
  assert.deepEqual(Object.keys(workflowStepResponsibilities).sort(), Object.keys(workflowTargetSteps).sort());
  assert.equal(workflowStepResponsibilities.inspection.primary, 'mechanic');
  assert.equal(workflowStepResponsibilities.parts.primary, 'coordinator');
  assert.ok(workflowStepResponsibilities.quote.collaborators.includes('ai'));
});

test('tasks enforce valid status, assignee and completion rules', () => {
  const withTask = createOrderTask(newOrder(), {
    title: '  Revisar frenos  ',
    status: 'invalid',
    priority: 'urgent',
    assignedTo: 'mechanic',
    targetStep: 'parts',
    notes: '<b>sin ruido</b>',
  }, 'coordinator');

  const task = withTask.tasks[0];
  assert.equal(task.title, 'Revisar frenos');
  assert.equal(task.status, 'open');
  assert.equal(task.priority, 'urgent');
  assert.equal(task.assignedTo, 'mechanic');
  assert.equal(task.assignedUserId, 'mechanic');
  assert.equal(task.targetStep, 'parts');
  assert.ok(workflowTargetSteps[task.targetStep]);
  assert.equal(task.notes, 'sin ruido');
  assert.equal(withTask.events.at(-1).type, 'task_created');

  const completed = updateOrderTask(withTask, task.id, { status: 'done' }, 'mechanic');
  assert.equal(completed.tasks[0].status, 'done');
  assert.match(completed.tasks[0].completedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('internal comments are normalized and linked to valid users', () => {
  const commented = addOrderComment(newOrder(), { text: '  <i>cliente espera llamado</i>  ' }, 'coordinator');
  assert.equal(commented.comments[0].text, 'cliente espera llamado');
  assert.equal(commented.comments[0].userId, 'coordinator');
  assert.equal(commented.events.at(-1).type, 'comment_added');
});
