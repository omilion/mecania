import test from 'node:test';
import assert from 'node:assert/strict';
import { loadVehicleCatalog } from '../src/vehicleCatalog.js';

test('EPA catalog exposes modern years, makes, models and engines', async () => {
  const catalog = await loadVehicleCatalog();
  const years = catalog.years();
  assert.ok(years.includes(2026));
  assert.ok(years.includes(1985));

  const makes = catalog.makes(2024);
  assert.ok(makes.includes('Toyota'));

  const models = catalog.models(2024, 'Toyota');
  assert.ok(models.some((model) => model.includes('4Runner')));

  const engines = catalog.engines(2024, 'Toyota', '4Runner 2WD');
  assert.ok(engines.some((engine) => engine.label.includes('4.0L')));
  assert.ok(engines.some((engine) => engine.transmission));
});

test('EPA catalog stats describe dataset coverage', async () => {
  const catalog = await loadVehicleCatalog();
  const stats = catalog.stats();
  assert.ok(stats.firstYear <= 1985);
  assert.ok(stats.lastYear >= 2026);
  assert.ok(stats.makeCount > 50);
  assert.ok(stats.modelCount > 20000);
});
