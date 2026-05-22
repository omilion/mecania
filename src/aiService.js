import {
  generateDeliverySummary,
  generateInspection,
  generateIntake,
  generatePartIdentificationSheet,
  generatePartsMessage,
  generateQuoteMessage,
  vehicleSpec,
} from './domain.js';

export const GEMINI_MODEL = import.meta.env?.VITE_GEMINI_MODEL || 'gemini-3-flash-preview';
export const GEMINI_API_KEY = '';

export function aiConfigStatus() {
  if (GEMINI_MODEL !== 'gemini-3-flash-preview') {
    return {
      ok: false,
      reason: 'Modelo invalido. Configura VITE_GEMINI_MODEL=gemini-3-flash-preview.',
      model: GEMINI_MODEL,
    };
  }
  if (!GEMINI_API_KEY) {
    return {
      ok: false,
      reason: 'Gemini remoto corre en el backend con GEMINI_API_KEY. El frontend usa reglas locales si la API no esta disponible.',
      model: GEMINI_MODEL,
    };
  }
  return { ok: true, reason: 'Gemini configurado.', model: GEMINI_MODEL };
}

export function localAi(task, order, context = {}) {
  const local = {
    intake: generateIntake,
    inspection: generateInspection,
    quote: generateQuoteMessage,
    parts: generatePartsMessage,
    part_sheet: (sourceOrder) => generatePartIdentificationSheet(sourceOrder, context.part),
    handoff: generateDeliverySummary,
  }[task];
  return local ? local(order) : generateInspection(order);
}

export async function generateAiText(task, order, context = {}) {
  const status = aiConfigStatus();
  if (!status.ok) return localAi(task, order, context);

  const response = await fetch(
    geminiUrl(GEMINI_API_KEY, GEMINI_MODEL),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildPrompt(task, order, context) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: task === 'part_sheet' ? 2200 : 1200,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini error ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n').trim();
  if (!text) throw new Error('Gemini no devolvio texto util.');
  return text;
}

export function geminiUrl(apiKey, model = GEMINI_MODEL) {
  if (model !== 'gemini-3-flash-preview') {
    throw new Error('Modelo remoto no permitido.');
  }
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

function buildPrompt(task, order, context = {}) {
  if (task === 'part_sheet') return buildPartSheetPrompt(order, context.part);
  return [
    'Eres un asistente operativo para mecánicos. No reemplazas al mecánico; ordenas información, sugieres checklist, y redactas mensajes claros.',
    'Usa español chileno neutro, directo y profesional.',
    'Regla crítica: toda sugerencia de repuestos debe considerar marca, modelo, año, motor/cilindrada y patente. Si faltan datos, dilo.',
    `Tarea: ${task}.`,
    `Vehiculo: ${vehicleSpec(order)}.`,
    `Cliente: ${order.client?.name || 'sin registrar'}, WhatsApp: ${order.client?.phone || 'sin registrar'}.`,
    `Nota inicial: ${order.intakeText || 'sin nota'}.`,
    `Hallazgos: ${order.findings?.map((finding) => `${finding.area}: ${finding.description}. Recomendacion: ${finding.recommendation}`).join(' | ') || 'sin hallazgos'}.`,
    `Repuestos: ${order.parts?.map((part) => `${part.name}: ${part.status}, ${part.notes || 'sin notas'}`).join(' | ') || 'sin repuestos'}.`,
    `Cotización total: ${order.quote ? JSON.stringify(order.quote) : 'sin cotización'}.`,
    'Devuelve solo el texto final útil para el mecánico/cliente. No inventes datos técnicos específicos si no están disponibles.',
  ].join('\n');
}

function buildPartSheetPrompt(order, part = {}) {
  return [
    'Eres un especialista tecnico en identificacion de repuestos automotrices.',
    'Objetivo: generar una ficha de cotizacion en texto plano para comprar el repuesto correcto sin desarmar el vehiculo.',
    'Reglas estrictas:',
    '- Usa primero los datos estructurados del software.',
    '- No inventes codigos OEM, equivalencias, medidas, presiones, temperaturas, voltajes ni resistencias.',
    '- Si un dato no esta en el software o no estas seguro, escribe NO CONFIRMADO.',
    '- Advierte sobre gemelos visuales y parametros internos cuando el tipo de pieza lo requiera.',
    '- El VIN/codigo OEM/catalogo oficial manda sobre cualquier inferencia.',
    '- Devuelve solo la ficha final en texto plano, sin markdown.',
    '',
    `Vehiculo: ${vehicleSpec(order)}.`,
    `Orden JSON: ${JSON.stringify(order)}`,
    `Repuesto objetivo JSON: ${JSON.stringify(part || {})}`,
    '',
    'Formato obligatorio:',
    'FICHA DE COTIZACION - REPUESTO AUTOMOTRIZ',
    '1. IDENTIFICACION DEL VEHICULO',
    '2. REPUESTO SOLICITADO',
    '3. NIVEL DE CONFIANZA Y FALTANTES',
    '4. CODIGOS DE EQUIVALENCIA DIRECTA',
    '5. PARAMETROS CRITICOS',
    '6. MEDIDAS FISICAS PARA MOSTRADOR',
    '7. VEHICULOS HERMANOS / BUSQUEDA ALTERNATIVA',
    '8. ADVERTENCIAS Y VALIDACION FINAL',
  ].join('\n');
}
