import test from 'node:test';
import assert from 'node:assert/strict';
import { createVehicleCatalogLoader, loadVehicleCatalog } from '../src/vehicleCatalog.js';

test('EPA catalog loader imports data lazily and caches the catalog', async () => {
  let importCount = 0;
  const loadCatalog = createVehicleCatalogLoader(async () => {
    importCount += 1;
    return {
      EPA_VEHICLE_INDEX: {
        2026: {
          Toyota: {
            '4Runner 2WD': ['4Runner', [['4.0', '6', 'Regular Gasoline', 'Automatic 5-spd', '2-Wheel Drive', 'SUV']]],
          },
        },
      },
    };
  });

  assert.equal(importCount, 0);

  const catalog = await loadCatalog();
  const cachedCatalog = await loadCatalog();

  assert.equal(importCount, 1);
  assert.equal(cachedCatalog, catalog);
  assert.deepEqual(catalog.years(), [2026]);
  assert.deepEqual(catalog.makes(2026), ['Toyota']);
  assert.deepEqual(catalog.models(2026, 'Toyota'), ['4Runner 2WD']);
});

test('EPA catalog exposes modern years, makes, models and engines', async () => {
  const catalog = await loadVehicleCatalog();
  const years = catalog.years();
  assert.ok(years.includes(2026));
  assert.ok(years.includes(1985));

  const makes = catalog.makes(2024);
  assert.ok(makes.includes('Toyota'));
  assert.ok(catalog.makes().includes('Toyota'));

  const models = catalog.models(2024, 'Toyota');
  assert.ok(models.some((model) => model.includes('4Runner')));
  assert.ok(catalog.models('', 'Toyota').some((model) => model.includes('4Runner')));
  assert.ok(catalog.yearsFor('Toyota', '4Runner 2WD').includes(2024));

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
