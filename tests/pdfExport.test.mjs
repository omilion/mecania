import test from 'node:test';
import assert from 'node:assert/strict';
import { plainTextPdfBlob } from '../src/pdfExport.js';

test('plainTextPdfBlob creates a PDF payload from text', async () => {
  const blob = plainTextPdfBlob('Ficha repuesto', 'Linea uno\nLinea dos');
  const text = Buffer.from(await blob.arrayBuffer()).toString('latin1');

  assert.equal(blob.type, 'application/pdf');
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/Type \/Catalog/);
  assert.match(text, /xref/);
});
