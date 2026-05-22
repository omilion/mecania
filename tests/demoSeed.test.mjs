import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRichDemoOrders, demoSeedNumbers } from '../tools/demo-seed-data.mjs';

test('rich demo seed covers a busy workshop with two mechanics', () => {
  const orders = buildRichDemoOrders();
  const byMechanic = orders.reduce((counts, order) => {
    const mechanic = order.assignments?.mechanic || order.assignedUserId;
    counts[mechanic] = (counts[mechanic] || 0) + 1;
    return counts;
  }, {});

  assert.deepEqual(orders.map((order) => order.number), demoSeedNumbers());
  assert.equal(orders.length, 6);
  assert.ok(byMechanic.mechanic >= 2);
  assert.ok(byMechanic.mechanic2 >= 2);
});

test('rich demo seed includes customer, vehicle, interactions and workflow detail', () => {
  const orders = buildRichDemoOrders();

  for (const order of orders) {
    assert.ok(order.client.name, order.number);
    assert.ok(order.client.phone, order.number);
    assert.ok(order.vehicle.plate, order.number);
    assert.ok(order.vehicle.brand, order.number);
    assert.ok(order.vehicle.model, order.number);
    assert.ok(order.vehicle.year, order.number);
    assert.ok(order.intakeText, order.number);
    assert.ok(order.findings.length >= 1, order.number);
    assert.ok(order.quote.stages.length >= 2, order.number);
    assert.ok(order.comments.length + order.events.length >= 3, order.number);
  }
});
