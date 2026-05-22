export const EPA_VEHICLE_SOURCE = 'FuelEconomy.gov EPA vehicles.csv';
export const EPA_VEHICLE_SOURCE_URL = 'https://www.fueleconomy.gov/feg/download.shtml';

let catalogPromise;

export async function loadVehicleCatalog() {
  catalogPromise ||= import('./vehicleData.js').then((module) => createVehicleCatalog(module.EPA_VEHICLE_INDEX));
  return catalogPromise;
}

export function createVehicleCatalog(index) {
  return {
    years: () => vehicleYears(index),
    makes: (year) => vehicleMakes(index, year),
    models: (year, make) => vehicleModels(index, year, make),
    engines: (year, make, model) => vehicleEngineOptions(index, year, make, model),
    stats: () => vehicleCatalogStats(index),
  };
}

function vehicleYears(index) {
  return Object.keys(index)
    .map(Number)
    .sort((a, b) => b - a);
}

function vehicleMakes(index, year) {
  const byMake = index[String(year)] || {};
  return Object.keys(byMake).sort((a, b) => a.localeCompare(b));
}

function vehicleModels(index, year, make) {
  const byModel = index[String(year)]?.[make] || {};
  return Object.keys(byModel).sort((a, b) => a.localeCompare(b));
}

function vehicleEngineOptions(index, year, make, model) {
  const record = index[String(year)]?.[make]?.[model];
  if (!record) return [];
  return record[1].map((engine) => {
    const [displ, cylinders, fuel, transmission, drive, vehicleClass] = engine;
    return {
      label: engineLabel({ displ, cylinders, fuel, transmission }),
      displ,
      cylinders,
      fuel,
      transmission,
      drive,
      vehicleClass,
    };
  });
}

function vehicleCatalogStats(index) {
  const years = vehicleYears(index);
  const makes = new Set();
  let modelCount = 0;
  for (const year of years) {
    for (const make of vehicleMakes(index, year)) {
      makes.add(make);
      modelCount += vehicleModels(index, year, make).length;
    }
  }
  return {
    firstYear: Math.min(...years),
    lastYear: Math.max(...years),
    makeCount: makes.size,
    modelCount,
  };
}

export function engineLabel({ displ, cylinders, fuel, transmission }) {
  const parts = [
    displ && `${displ}L`,
    cylinders && `${cylinders} cil`,
    fuel,
    transmission,
  ].filter(Boolean);
  return parts.join(' - ') || 'Motor no especificado';
}
