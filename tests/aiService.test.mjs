import test from 'node:test';
import assert from 'node:assert/strict';
import { aiConfigStatus, GEMINI_MODEL, geminiUrl, localAi } from '../src/aiService.js';
import { seedOrder } from '../src/domain.js';

test('ai service is pinned to gemini-3-flash-preview', () => {
  assert.equal(GEMINI_MODEL, 'gemini-3-flash-preview');
});

test('ai service reports missing key without switching models', () => {
  const status = aiConfigStatus();
  assert.equal(status.model, 'gemini-3-flash-preview');
  assert.equal(status.ok, false);
  assert.match(status.reason, /backend/);
});

test('local AI fallback preserves workflow text when Gemini is not configured', () => {
  const order = seedOrder();
  assert.match(localAi('parts', order), /Compatibilidad: marca Chevrolet/);
  assert.match(localAi('quote', order), /Datos para compatibilidad/);
});

test('geminiUrl only builds URLs for gemini-3-flash-preview', () => {
  const url = geminiUrl('test-key', 'gemini-3-flash-preview');
  assert.match(url, /models\/gemini-3-flash-preview:generateContent/);
  assert.match(url, /key=test-key$/);
  assert.throws(() => geminiUrl('test-key', 'otro-modelo'), /Modelo remoto no permitido/);
});
