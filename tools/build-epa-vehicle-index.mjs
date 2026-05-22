import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [input = 'tmp-epa/vehicles.csv', output = 'src/vehicleData.js'] = process.argv.slice(2);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function clean(value) {
  return String(value || '').trim();
}

const rows = parseCsv(readFileSync(input, 'utf8'));
const headers = rows.shift();
const indexByHeader = Object.fromEntries(headers.map((header, index) => [header, index]));
const catalog = new Map();

for (const row of rows) {
  const year = Number(row[indexByHeader.year]);
  const make = clean(row[indexByHeader.make]);
  const model = clean(row[indexByHeader.model]);
  if (!year || !make || !model) continue;

  const entry = {
    displ: clean(row[indexByHeader.displ]),
    cylinders: clean(row[indexByHeader.cylinders]),
    fuel: clean(row[indexByHeader.fuelType1]),
    transmission: clean(row[indexByHeader.trany]),
    drive: clean(row[indexByHeader.drive]),
    vehicleClass: clean(row[indexByHeader.VClass]),
  };
  const engine = [entry.displ, entry.cylinders, entry.fuel, entry.transmission, entry.drive, entry.vehicleClass].join('\t');
  const key = `${year}\t${make}\t${model}`;
  const current = catalog.get(key) || {
    year,
    make,
    model,
    baseModel: clean(row[indexByHeader.baseModel]) || model,
    engines: new Map(),
  };
  if (!current.engines.has(engine)) current.engines.set(engine, entry);
  catalog.set(key, current);
}

const vehicles = [...catalog.values()]
  .sort((a, b) => b.year - a.year || a.make.localeCompare(b.make) || a.model.localeCompare(b.model))
  .map((item) => ({
    ...item,
    engines: [...item.engines.values()].map((engine) => [
      engine.displ,
      engine.cylinders,
      engine.fuel,
      engine.transmission,
      engine.drive,
      engine.vehicleClass,
    ]),
  }));

const index = {};
for (const item of vehicles) {
  index[item.year] ||= {};
  index[item.year][item.make] ||= {};
  index[item.year][item.make][item.model] = [item.baseModel, item.engines];
}

const generated = `// Generated from EPA/FuelEconomy.gov vehicles.csv. Do not edit manually.\n` +
  `// Source: https://www.fueleconomy.gov/feg/download.shtml\n` +
  `export const EPA_VEHICLE_SOURCE = 'FuelEconomy.gov EPA vehicles.csv';\n` +
  `export const EPA_VEHICLE_SOURCE_URL = 'https://www.fueleconomy.gov/feg/download.shtml';\n` +
  `export const EPA_VEHICLE_INDEX = ${JSON.stringify(index)};\n`;

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, generated);

console.log(`Generated ${vehicles.length} vehicle records at ${output}`);
