import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return structuredClone(fallback);
    if (error instanceof SyntaxError) {
      throw Object.assign(new Error(`JSON invalido en ${filePath}`), { status: 500 });
    }
    throw error;
  }
}

export async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tmpPath, filePath);
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId(prefix = '') {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return prefix ? `${prefix}_${id}` : id;
}
