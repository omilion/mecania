export const STORAGE_KEY = 'mecanicok:v1';
export const DEFAULT_WORKSHOP_ID = 'wrk-demo';

export const workshopRoles = {
  admin: 'Admin',
  coordinator: 'Coordinador',
  mechanic: 'Mecánico',
};

export const defaultWorkshop = {
  id: DEFAULT_WORKSHOP_ID,
  name: 'Taller Demo MecanicOK',
  plan: 'Piloto 4 usuarios',
  maxUsers: 4,
  timezone: 'America/Santiago',
};

export const rolePermissions = {
  admin: {
    viewTeam: true,
    assignOrders: true,
    manageTasks: true,
    createClientLinks: true,
    deleteOrders: true,
    useAi: true,
  },
  coordinator: {
    viewTeam: true,
    assignOrders: true,
    manageTasks: true,
    createClientLinks: true,
    deleteOrders: false,
    useAi: true,
  },
  mechanic: {
    viewTeam: true,
    assignOrders: false,
    manageTasks: false,
    createClientLinks: false,
    deleteOrders: false,
    useAi: true,
  },
};

export const workshopUsers = [
  { id: 'admin', workshopId: DEFAULT_WORKSHOP_ID, email: 'admin@mecanicok.local', name: 'Carolina Admin', role: 'admin', roleLabel: 'Admin', focus: 'Caja, carga global y bloqueos', phone: '+56911111111', active: true },
  { id: 'coordinator', workshopId: DEFAULT_WORKSHOP_ID, email: 'coordinator@mecanicok.local', name: 'Diego Coord.', role: 'coordinator', roleLabel: 'Coordinador', focus: 'Agenda, repuestos y traspasos', phone: '+56922222222', active: true },
  { id: 'mechanic', workshopId: DEFAULT_WORKSHOP_ID, email: 'mechanic@mecanicok.local', name: 'Luis Mecánico', role: 'mechanic', roleLabel: 'Mecánico', focus: 'Revisión, ejecución y evidencia', phone: '+56933333333', active: true },
  { id: 'mechanic2', workshopId: DEFAULT_WORKSHOP_ID, email: 'mechanic2@mecanicok.local', name: 'Ana Mecánica', role: 'mechanic', roleLabel: 'Mecánico', focus: 'Diagnóstico avanzado, frenos y tren delantero', phone: '+56944444444', active: true },
];

export const taskStatuses = {
  open: 'Pendiente',
  doing: 'En curso',
  blocked: 'Bloqueada',
  done: 'Lista',
};

export const taskPriorities = {
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export const workflowTargetSteps = {
  intake: 'Diagnóstico inicial',
  vehicle: 'Vehículo',
  reception_photos: 'Fotos recepción',
  detail_photos: 'Fotos detalle',
  client: 'Cliente',
  inspection: 'Revisión',
  quote: 'Cotización',
  parts: 'Repuestos',
  execution: 'Ejecución',
  handoff: 'Entrega',
};

export const workflowStepResponsibilities = {
  vehicle: {
    primary: 'mechanic',
    collaborators: ['coordinator', 'admin', 'ai'],
    summary: 'El mecánico identifica patente, marca, modelo, año, motor y kilometraje; coordinación/admin pueden completar datos antes o después del ingreso.',
  },
  intake: {
    primary: 'mechanic',
    collaborators: ['coordinator', 'admin', 'ai'],
    summary: 'El mecánico registra el relato inicial; la IA puede ordenar síntomas, faltantes y checklist sin reemplazar criterio técnico.',
  },
  reception_photos: {
    primary: 'mechanic',
    collaborators: ['ai'],
    summary: 'El mecánico documenta evidencia mínima de recepción: vistas, patente, odómetro y tablero.',
  },
  detail_photos: {
    primary: 'mechanic',
    collaborators: ['ai'],
    summary: 'El mecánico agrega fotos de zonas a revisar, daños previos, piezas y evidencia técnica.',
  },
  client: {
    primary: 'coordinator',
    collaborators: ['admin', 'mechanic', 'ai'],
    summary: 'Coordinación/admin formalizan datos y consentimiento; el mecánico puede capturarlos en primera visita cuando conversa con el cliente.',
  },
  inspection: {
    primary: 'mechanic',
    collaborators: ['ai'],
    summary: 'El mecánico registra hallazgos, severidad, riesgo y recomendación; la IA puede sugerir estructura y faltantes.',
  },
  quote: {
    primary: 'coordinator',
    collaborators: ['admin', 'mechanic', 'ai'],
    summary: 'Coordinación/admin preparan y envían cotización; el mecánico aporta diagnóstico, mano de obra, alcance técnico y repuestos probables.',
  },
  parts: {
    primary: 'coordinator',
    collaborators: ['mechanic', 'admin', 'ai'],
    summary: 'Coordinación gestiona solicitud y seguimiento; el mecánico valida compatibilidad técnica antes de instalar.',
  },
  execution: {
    primary: 'mechanic',
    collaborators: ['ai'],
    summary: 'El mecánico ejecuta, registra notas, evidencia y bloqueos de seguridad.',
  },
  handoff: {
    primary: 'coordinator',
    collaborators: ['mechanic', 'admin', 'ai'],
    summary: 'Coordinación/admin cierran comunicación y entrega; el mecánico deja resumen técnico final.',
  },
};

export const safetyImpacts = {
  none: 'Sin bloqueo',
  no_drive: 'No circular',
  no_start: 'No encender',
};

export const safetyReasons = {
  none: 'Sin motivo critico',
  overheat: 'Recalentamiento severo',
  coolant_in_oil: 'Agua/refrigerante en aceite',
  oil_pressure: 'Presion de aceite',
  hydrolock: 'Riesgo hidrolock',
  timing_failure: 'Distribución',
  fuel_leak: 'Fuga combustible',
  other: 'Otro',
};

export const quoteStageStatuses = {
  required: 'Incluida',
  probable: 'Probable',
  conditional: 'Condicionada',
  optional: 'Opcional',
  declined: 'No autorizada',
};

export const statusLabels = {
  intake: 'Recepcion',
  visual_record: 'Registro visual',
  client_data: 'Datos cliente',
  inspection: 'Revision',
  quote_draft: 'Cotizacion',
  quote_sent: 'Enviada',
  waiting_parts: 'Esperando repuestos',
  ready: 'Listo para trabajo',
  in_progress: 'En ejecución',
  ready_delivery: 'Listo para entrega',
  closed: 'Cerrada',
};

export const partStatuses = {
  pending: 'Pendiente',
  client_buying: 'Compra cliente',
  mechanic_quote: 'Cotiza mecánico',
  mechanic_buying: 'Compra mecánico',
  in_transit: 'En camino',
  delayed: 'Retrasado',
  received: 'Recibido',
  wrong: 'Incorrecto',
  validated: 'Validado',
};

export const photoTypes = [
  'Frontal',
  'Trasera',
  'Lateral izquierdo',
  'Lateral derecho',
  'Patente',
  'Odómetro',
  'Tablero',
  'Zona a revisar',
  'Daño previo',
];

export const progressPhotoTypes = [
  'Zona antes de intervenir',
  'Pieza retirada',
  'Pieza nueva',
  'Proceso',
  'Prueba final',
  'Entrega',
];

export const requiredReceptionPhotoTypes = ['Frontal', 'Trasera', 'Lateral izquierdo', 'Lateral derecho', 'Patente', 'Odómetro', 'Tablero'];

export function defaultQuoteStages() {
  return [
    { id: 'diagnostic', type: 'diagnostic', title: 'Diagnóstico', status: 'required', condition: '', note: '', items: [] },
    { id: 'transport', type: 'transport', title: 'Traslado', status: 'conditional', condition: 'Si el vehículo no puede circular', note: '', items: [] },
    { id: 'probable_repair', type: 'probable_repair', title: 'Reparación probable', status: 'probable', condition: '', note: '', items: [] },
    { id: 'conditional_additionals', type: 'conditional_additional', title: 'Adicionales condicionados', status: 'conditional', condition: 'Solo si se confirma al desmontar', note: '', items: [] },
  ];
}

export function createPhotoRecord(type, dataUrl, caption = '') {
  return {
    id: crypto.randomUUID(),
    type,
    dataUrl,
    caption,
    createdAt: new Date().toISOString(),
  };
}

export const newOrder = () => ({
  id: crypto.randomUUID(),
  number: `MO-${String(Date.now()).slice(-6)}`,
  workshopId: DEFAULT_WORKSHOP_ID,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  statusChangedAt: new Date().toISOString(),
  status: 'intake',
  priority: 'normal',
  promisedAt: '',
  createdByUserId: 'admin',
  updatedByUserId: 'admin',
  statusChangedByUserId: 'admin',
  coordinatorUserId: 'coordinator',
  assignedUserId: 'mechanic',
  assignments: {
    responsible: 'admin',
    coordinator: 'coordinator',
    mechanic: 'mechanic',
    updatedBy: 'admin',
    updatedAt: new Date().toISOString(),
  },
  internalNotes: '',
  tasks: [],
  intakeText: '',
  aiIntake: '',
  vehicle: {
    plate: '',
    brand: '',
    model: '',
    year: '',
    engine: '',
    engineLabel: '',
    cylinders: '',
    fuel: '',
    transmission: '',
    drive: '',
    vehicleClass: '',
    mileage: '',
    color: '',
  },
  client: {
    name: '',
    phone: '',
    email: '',
    address: '',
    contactConsent: true,
  },
  photos: [],
  findings: [],
  risk: {
    level: 'normal',
    noStart: false,
    summary: '',
    customerMessage: '',
    safetyStatus: '',
    clearanceNote: '',
    clearedByUserId: '',
    clearedAt: '',
  },
  quote: {
    schemaVersion: 2,
    stages: defaultQuoteStages(),
    labor: [{ id: crypto.randomUUID(), name: 'Diagnóstico y mano de obra', amount: 0 }],
    parts: [],
    extras: [],
    note: '',
    sent: false,
    approved: false,
    rejected: false,
    customerComment: '',
    decidedAt: '',
  },
  parts: [],
  executionNotes: '',
  progressPhotos: [],
  finalNotes: '',
  aiMessages: {},
  assignedTo: 'mechanic',
  assignedAt: '',
  assignedBy: 'coordinator',
  comments: [],
  events: [],
});

export function normalizeWorkshopOrder(order = {}) {
  const base = newOrder();
  return {
    ...base,
    ...order,
    workshopId: order.workshopId || DEFAULT_WORKSHOP_ID,
    priority: order.priority || 'normal',
    promisedAt: order.promisedAt || '',
    createdByUserId: order.createdByUserId || 'admin',
    updatedByUserId: order.updatedByUserId || order.createdByUserId || 'admin',
    statusChangedByUserId: order.statusChangedByUserId || order.updatedByUserId || 'admin',
    coordinatorUserId: order.coordinatorUserId || order.assignments?.coordinator || 'coordinator',
    assignedUserId: order.assignedUserId || order.assignments?.mechanic || 'mechanic',
    assignments: {
      responsible: order.assignments?.responsible || order.createdByUserId || 'admin',
      coordinator: order.assignments?.coordinator || order.coordinatorUserId || 'coordinator',
      mechanic: order.assignments?.mechanic || order.assignedUserId || 'mechanic',
      updatedBy: order.assignments?.updatedBy || order.updatedByUserId || 'admin',
      updatedAt: order.assignments?.updatedAt || order.updatedAt || new Date().toISOString(),
    },
    internalNotes: order.internalNotes || '',
    tasks: Array.isArray(order.tasks) ? order.tasks.map(normalizeTask) : [],
    vehicle: { ...base.vehicle, ...(order.vehicle || {}) },
    client: { ...base.client, ...(order.client || {}) },
    risk: normalizeRisk(order.risk),
    quote: normalizeQuote(order.quote || base.quote),
    photos: Array.isArray(order.photos) ? order.photos : [],
    findings: Array.isArray(order.findings) ? order.findings : [],
    parts: Array.isArray(order.parts) ? order.parts : [],
    progressPhotos: Array.isArray(order.progressPhotos) ? order.progressPhotos : [],
    aiMessages: order.aiMessages || {},
  };
}

export function createInternalTask({ title, assignedUserId = 'mechanic', createdByUserId = 'coordinator', dueDate = '', priority = 'normal', targetStep = 'execution' } = {}) {
  return normalizeTask({
    id: crypto.randomUUID(),
    title: title || 'Nueva tarea',
    assignedUserId,
    createdByUserId,
    dueDate,
    priority,
    targetStep,
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function normalizeTask(task = {}) {
  return {
    id: task.id || crypto.randomUUID(),
    title: task.title || 'Tarea sin titulo',
    assignedUserId: task.assignedUserId || 'mechanic',
    createdByUserId: task.createdByUserId || 'coordinator',
    dueDate: task.dueDate || '',
    priority: taskPriorities[task.priority] ? task.priority : 'normal',
    targetStep: workflowTargetSteps[task.targetStep] ? task.targetStep : 'execution',
    status: taskStatuses[task.status] ? task.status : 'open',
    notes: task.notes || '',
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString(),
    completedAt: task.completedAt || '',
  };
}

export function userById(userId, users = workshopUsers) {
  return users.find((user) => user.id === userId) || null;
}

export function userLabel(userId, users = workshopUsers) {
  const user = userById(userId, users);
  return user ? `${user.name} (${workshopRoles[user.role] || user.role})` : 'Sin asignar';
}

export function orderTasksSummary(order = {}) {
  const tasks = Array.isArray(order.tasks) ? order.tasks : [];
  const open = tasks.filter((task) => task.status !== 'done').length;
  const blocked = tasks.filter((task) => task.status === 'blocked').length;
  const urgent = tasks.filter((task) => task.priority === 'urgent' && task.status !== 'done').length;
  return {
    total: tasks.length,
    open,
    blocked,
    urgent,
    done: tasks.filter((task) => task.status === 'done').length,
  };
}

export function userOpenTasks(orders = [], userId = '') {
  return orders.flatMap((order) => (order.tasks || [])
    .filter((task) => task.assignedUserId === userId && task.status !== 'done')
    .map((task) => ({ ...task, orderId: order.id, orderNumber: order.number, vehicleName: vehicleName(order) })));
}

export function canManageWorkshop(user = {}) {
  return userCan(user, 'assignOrders');
}

export function permissionsForRole(role = '') {
  return { ...(rolePermissions[role] || rolePermissions.mechanic) };
}

export function userCan(user = {}, permission = '') {
  if (!permission) return false;
  const permissions = user.permissions || permissionsForRole(user.role);
  return permissions[permission] === true;
}

export const seedOrder = () => ({
  ...newOrder(),
  id: crypto.randomUUID(),
  number: 'MO-142300',
  status: 'waiting_parts',
  intakeText:
    'Cliente dice que se calienta en taco, ayer boto agua por abajo. Chevrolet Sail 2016. Revisar bomba de agua, mangueras y electroventilador.',
  aiIntake:
    'Sintoma principal: sobrecalentamiento. Sistema afectado: refrigeracion. Revisar bomba de agua, mangueras, radiador, tapa, termostato, electroventilador y nivel/tipo de refrigerante. Preguntar si uso agua o refrigerante y si encendio testigo de temperatura.',
  vehicle: {
    plate: 'AB-CD-12',
    brand: 'Chevrolet',
    model: 'Sail',
    year: '2016',
    engine: '1.4',
    engineLabel: '1.4L - 4 cil - Regular Gasoline - Manual 5-spd',
    cylinders: '4',
    fuel: 'Regular Gasoline',
    transmission: 'Manual 5-spd',
    drive: 'Front-Wheel Drive',
    vehicleClass: 'Compact Cars',
    mileage: '142300',
    color: 'Blanco',
  },
  client: {
    name: 'Juan Perez',
    phone: '+56912345678',
    email: 'juan@example.com',
    address: 'Las Condes',
    contactConsent: true,
  },
  findings: [
    {
      id: crypto.randomUUID(),
      area: 'Refrigeracion',
      severity: 'critico',
      description: 'Fuga visible en bomba de agua. Refrigerante bajo.',
      recommendation: 'Cambiar bomba de agua, rellenar refrigerante y purgar sistema.',
    },
    {
      id: crypto.randomUUID(),
      area: 'Correa',
      severity: 'medio',
      description: 'Correa con desgaste visible.',
      recommendation: 'Revisar y cambiar si el cliente aprueba.',
    },
  ],
  quote: {
    schemaVersion: 2,
    stages: defaultQuoteStages(),
    labor: [{ id: crypto.randomUUID(), name: 'Cambio bomba de agua', amount: 45000 }],
    parts: [
      { id: crypto.randomUUID(), name: 'Bomba de agua', amount: 0 },
      { id: crypto.randomUUID(), name: 'Refrigerante', amount: 0 },
    ],
    extras: [{ id: crypto.randomUUID(), name: 'Gestion de compra opcional', amount: 8000 }],
    note: 'Valor sujeto a que el repuesto comprado sea compatible.',
    sent: true,
    approved: false,
    rejected: false,
    customerComment: '',
    decidedAt: '',
  },
  parts: [
    {
      id: crypto.randomUUID(),
      name: 'Bomba de agua',
      owner: 'client',
      status: 'in_transit',
      dueDate: 'manana',
      notes: 'Cliente envio foto pendiente de validar.',
      price: '',
      photoDataUrl: '',
      validatedBy: '',
    },
    {
      id: crypto.randomUUID(),
      name: 'Refrigerante compatible',
      owner: 'client',
      status: 'pending',
      dueDate: '',
      notes: 'No agendar si no esta confirmado.',
      price: '',
      photoDataUrl: '',
      validatedBy: '',
    },
  ],
  assignedTo: 'mechanic',
  assignedAt: new Date().toISOString(),
  assignedBy: 'coordinator',
  tasks: [
    {
      id: crypto.randomUUID(),
      title: 'Validar compatibilidad de bomba de agua',
      status: 'open',
      priority: 'high',
      assignedTo: 'mechanic',
      assignedUserId: 'mechanic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'coordinator',
      createdByUserId: 'coordinator',
      completedAt: '',
      notes: '',
    },
  ],
  comments: [],
  events: [],
});

export const highQualitySeedOrder = () => {
  const now = new Date();
  const iso = (minutesAgo = 0) => new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString();
  const photo = (type, caption, color = '176b87') => ({
    id: crypto.randomUUID(),
    type,
    caption,
    createdAt: iso(180),
    dataUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 480'%3E%3Crect width='640' height='480' fill='%23${color}'/%3E%3Ctext x='40' y='245' fill='white' font-family='Arial' font-size='38' font-weight='700'%3E${encodeURIComponent(type)}%3C/text%3E%3Ctext x='40' y='295' fill='white' font-family='Arial' font-size='22'%3EMecanicOK demo%3C/text%3E%3C/svg%3E`,
  });
  const pumpFindingId = crypto.randomUUID();
  const beltFindingId = crypto.randomUUID();
  const coolantFindingId = crypto.randomUUID();

  return {
    ...newOrder(),
    id: crypto.randomUUID(),
    number: `MO-DEMO-${String(Date.now()).slice(-4)}`,
    workshopId: DEFAULT_WORKSHOP_ID,
    createdAt: iso(360),
    updatedAt: iso(8),
    statusChangedAt: iso(20),
    status: 'ready_delivery',
    priority: 'high',
    promisedAt: iso(-180),
    createdByUserId: 'admin',
    updatedByUserId: 'mechanic',
    statusChangedByUserId: 'mechanic',
    coordinatorUserId: 'coordinator',
    assignedUserId: 'mechanic',
    assignments: {
      responsible: 'admin',
      coordinator: 'coordinator',
      mechanic: 'mechanic',
      updatedBy: 'coordinator',
      updatedAt: iso(330),
    },
    internalNotes:
      'Caso dummy de alta calidad para QA navegador. Cubre recepción, fotos, datos cliente, revisión, cotización, repuestos, ejecución, entrega, tareas, comentarios y eventos.',
    intakeText:
      'Cliente reporta temperatura alta en tacos, olor a refrigerante y mancha bajo el motor después de estacionar. Indica que ayer rellenaron con agua y siguió circulando 6 km. Solicita diagnóstico, reparación y entrega hoy si hay repuestos.',
    aiIntake:
      'Síntoma principal: sobrecalentamiento con pérdida de refrigerante. Prioridad alta. No agendar ejecución sin validar bomba de agua, mangueras, tapa, termostato, electroventilador y compatibilidad exacta de repuestos usando patente, motor y muestra visual.',
    vehicle: {
      plate: 'JL-RK-48',
      brand: 'Chevrolet',
      model: 'Sail',
      year: '2016',
      engine: '1.4',
      engineLabel: '1.4L L4 gasolina - Manual 5 velocidades',
      cylinders: '4',
      fuel: 'Gasolina 93',
      transmission: 'Manual 5 velocidades',
      drive: 'Traccion delantera',
      vehicleClass: 'Sedan compacto',
      mileage: '142300',
      color: 'Blanco',
    },
    client: {
      name: 'Marisol Fuentes Rojas',
      phone: '+56984215567',
      email: 'marisol.fuentes@example.com',
      address: 'Av. Grecia 4120, Nunoa, Santiago',
      contactConsent: true,
    },
    photos: [
      photo('Frontal', 'Vista frontal de recepcion', '176b87'),
      photo('Trasera', 'Parachoques trasero sin daños visibles', '1f7a4d'),
      photo('Lateral izquierdo', 'Rayon menor puerta conductor informado', 'a76500'),
      photo('Lateral derecho', 'Sin daños relevantes', '176b87'),
      photo('Patente', 'Patente JLRK48 legible', '10232d'),
      photo('Odómetro', '142.300 km al ingreso', '1f7a4d'),
      photo('Tablero', 'Testigo temperatura reportado por cliente', 'b42318'),
      photo('Zona a revisar', 'Humedad bajo bomba de agua', 'a76500'),
    ],
    findings: [
      {
        id: pumpFindingId,
        area: 'Refrigeracion',
        severity: 'alto',
        result: 'falla',
        symptom: 'Perdida de refrigerante y temperatura alta en tacos.',
        description: 'Fuga activa en zona de bomba de agua. Se observan gotas y marca de refrigerante seco en carcasa.',
        recommendation: 'Cambiar bomba de agua, junta/sello, refrigerante y purgar sistema. Probar temperatura con electroventilador.',
        customerRisk: 'Si circula así puede volver a recalentar y provocar daño mayor de motor.',
        quoteMode: 'cotizar',
        safetyImpact: 'no_drive',
        safetyStatus: 'cleared',
        clearanceNote: 'Despues de reparacion y prueba estatica no presenta nueva fuga ni alza de temperatura.',
      },
      {
        id: beltFindingId,
        area: 'Correa auxiliar',
        severity: 'medio',
        result: 'observacion',
        symptom: 'Ruido leve al acelerar en frio.',
        description: 'Correa con desgaste superficial y brillo en cara de contacto.',
        recommendation: 'Cambiar correa auxiliar junto con bomba para evitar segunda visita.',
        customerRisk: 'Puede generar ruido, patinaje o perdida de carga si se deteriora.',
        quoteMode: 'recomendado',
        safetyImpact: 'none',
      },
      {
        id: coolantFindingId,
        area: 'Refrigerante',
        severity: 'medio',
        result: 'falla',
        symptom: 'Sistema fue rellenado con agua.',
        description: 'Mezcla diluida, color irregular y nivel bajo al ingreso.',
        recommendation: 'Vaciar, rellenar con refrigerante compatible y purgar el sistema.',
        customerRisk: 'El uso de agua acelera corrosion y reduce proteccion termica.',
        quoteMode: 'incluido',
        safetyImpact: 'none',
      },
    ],
    risk: {
      level: 'warning',
      noStart: false,
      summary: 'No circular hasta terminar reparacion y prueba de temperatura.',
      customerMessage: 'Recomendamos no usar el vehículo hasta validar la fuga y completar purga del sistema.',
      safetyStatus: 'cleared',
      clearanceNote: 'Temperatura estable tras 18 minutos en ralenti, electroventilador activa y no se detectan fugas visibles.',
      clearedByUserId: 'mechanic',
      clearedAt: iso(25),
    },
    quote: {
      schemaVersion: 2,
      stages: [
        {
          id: 'diagnostic',
          type: 'diagnostic',
          title: 'Diagnostico',
          status: 'required',
          condition: '',
          note: 'Prueba visual, presurizacion basica y validacion de electroventilador.',
          items: [{ id: crypto.randomUUID(), kind: 'labor', name: 'Diagnostico sistema refrigeracion', amount: 18000, required: true, sourceFindingId: pumpFindingId }],
        },
        {
          id: 'probable_repair',
          type: 'probable_repair',
          title: 'Reparacion aprobada',
          status: 'required',
          condition: '',
          note: 'Cliente aprueba cambio de bomba, correa y refrigerante.',
          items: [
            { id: crypto.randomUUID(), kind: 'labor', name: 'Cambio bomba de agua y purga', amount: 65000, required: true, sourceFindingId: pumpFindingId },
            { id: crypto.randomUUID(), kind: 'part', name: 'Bomba de agua Chevrolet Sail 1.4', amount: 38900, required: true, materializePart: true, sourceFindingId: pumpFindingId },
            { id: crypto.randomUUID(), kind: 'part', name: 'Correa auxiliar Sail 1.4', amount: 11900, required: true, materializePart: true, sourceFindingId: beltFindingId },
            { id: crypto.randomUUID(), kind: 'part', name: 'Refrigerante organico 5L', amount: 15900, required: true, materializePart: true, sourceFindingId: coolantFindingId },
          ],
        },
        {
          id: 'conditional_additionals',
          type: 'conditional_additional',
          title: 'Adicionales condicionados',
          status: 'conditional',
          condition: 'Solo si aparece fuga despues de prueba de presion.',
          note: 'No fue necesario cambiar mangueras.',
          items: [],
        },
      ],
      labor: [
        { id: crypto.randomUUID(), name: 'Diagnostico sistema refrigeracion', amount: 18000 },
        { id: crypto.randomUUID(), name: 'Cambio bomba de agua y purga', amount: 65000 },
      ],
      parts: [
        { id: crypto.randomUUID(), name: 'Bomba de agua Chevrolet Sail 1.4', amount: 38900 },
        { id: crypto.randomUUID(), name: 'Correa auxiliar Sail 1.4', amount: 11900 },
        { id: crypto.randomUUID(), name: 'Refrigerante organico 5L', amount: 15900 },
      ],
      extras: [{ id: crypto.randomUUID(), name: 'Gestion y retiro de repuestos', amount: 8000 }],
      note: 'Cotizacion aprobada por WhatsApp. Garantia sujeta a no circular con temperatura alta y a revisar nivel en 7 dias.',
      sent: true,
      sentAt: iso(250),
      approved: true,
      rejected: false,
      customerComment: 'Aprobado, favor avanzar y avisar cuando este listo.',
      decidedAt: iso(220),
    },
    parts: [
      {
        id: crypto.randomUUID(),
        name: 'Bomba de agua Chevrolet Sail 1.4',
        owner: 'mechanic',
        status: 'validated',
        dueDate: iso(120).slice(0, 10),
        notes: 'Validada por patente, muestra visual y cantidad de pernos. Incluye junta.',
        price: '38900',
        photoDataUrl: photo('Bomba validada', 'Repuesto correcto validado', '1f7a4d').dataUrl,
        validatedBy: 'mechanic',
        updatedAt: iso(115),
      },
      {
        id: crypto.randomUUID(),
        name: 'Correa auxiliar Sail 1.4',
        owner: 'mechanic',
        status: 'validated',
        dueDate: iso(120).slice(0, 10),
        notes: 'Medida validada contra correa retirada.',
        price: '11900',
        photoDataUrl: photo('Correa validada', 'Correa auxiliar compatible', '1f7a4d').dataUrl,
        validatedBy: 'mechanic',
        updatedAt: iso(110),
      },
      {
        id: crypto.randomUUID(),
        name: 'Refrigerante organico 5L',
        owner: 'mechanic',
        status: 'received',
        dueDate: iso(120).slice(0, 10),
        notes: 'Listo en taller. Se uso mezcla compatible.',
        price: '15900',
        photoDataUrl: photo('Refrigerante', 'Insumo recibido', '176b87').dataUrl,
        validatedBy: 'mechanic',
        updatedAt: iso(108),
      },
    ],
    executionNotes:
      'Se reemplaza bomba de agua con junta nueva, se cambia correa auxiliar, se rellena refrigerante organico y se purga sistema. Prueba estatica 18 minutos: temperatura estable, electroventilador activa correctamente, sin fugas visibles. Se deja recomendacion de revisar nivel en 7 dias.',
    progressPhotos: [
      photo('Zona antes de intervenir', 'Fuga visible antes de desmontar', 'a76500'),
      photo('Pieza retirada', 'Bomba antigua con fuga en eje', 'b42318'),
      photo('Pieza nueva', 'Bomba nueva instalada con junta', '1f7a4d'),
      photo('Prueba final', 'Temperatura estable despues de purga', '176b87'),
      photo('Entrega', 'Vehiculo listo para retiro', '10232d'),
    ],
    finalNotes:
      'Trabajo finalizado. Se cambio bomba de agua, correa auxiliar y refrigerante. No se detectan fugas posteriores. Recomendamos revisar nivel en frio durante la semana y volver si aparece olor a refrigerante, testigo de temperatura o perdida visible.',
    aiMessages: {
      intake:
        'IA detecto caso de refrigeracion con riesgo de recalentamiento. Solicitar patente, motor, kilometraje, foto de tablero y zona de fuga.',
      inspection:
        'IA estructuro hallazgos: fuga bomba de agua, correa con desgaste y refrigerante diluido. Riesgo cliente: no circular hasta prueba final.',
      quote:
        'Mensaje cliente: cotización clara con mano de obra, repuestos, condiciones y recomendación de no circular hasta reparar.',
      parts:
        'Mensaje proveedor: Chevrolet Sail 2016, motor 1.4, patente JL-RK-48. Confirmar bomba de agua con junta y correa compatible.',
      handoff:
        'Resumen final generado con trabajos realizados, prueba de temperatura y recomendacion de control de nivel.',
    },
    assignedTo: 'mechanic',
    assignedAt: iso(330),
    assignedBy: 'coordinator',
    tasks: [
      {
        id: crypto.randomUUID(),
        title: 'Validar compatibilidad de bomba de agua antes de instalar',
        status: 'done',
        priority: 'urgent',
        targetStep: 'parts',
        assignedTo: 'mechanic',
        assignedUserId: 'mechanic',
        createdAt: iso(240),
        updatedAt: iso(116),
        createdBy: 'coordinator',
        createdByUserId: 'coordinator',
        completedAt: iso(116),
        dueDate: iso(120).slice(0, 10),
        notes: 'Validada contra patente y muestra visual.',
      },
      {
        id: crypto.randomUUID(),
        title: 'Enviar aviso de retiro al cliente',
        status: 'open',
        priority: 'high',
        targetStep: 'handoff',
        assignedTo: 'coordinator',
        assignedUserId: 'coordinator',
        createdAt: iso(18),
        updatedAt: iso(18),
        createdBy: 'mechanic',
        createdByUserId: 'mechanic',
        completedAt: '',
        dueDate: iso(-180).slice(0, 10),
        notes: 'Avisar que debe revisar nivel en frio durante la semana.',
      },
    ],
    comments: [
      {
        id: crypto.randomUUID(),
        userId: 'coordinator',
        text: 'Cliente aprobo por WhatsApp. Prioridad alta porque necesita retiro hoy.',
        createdAt: iso(218),
      },
      {
        id: crypto.randomUUID(),
        userId: 'mechanic',
        text: 'Prueba final OK. No se observan fugas despues de purga.',
        createdAt: iso(22),
      },
    ],
    events: [
      { id: crypto.randomUUID(), type: 'created', userId: 'admin', message: 'Orden demo QA creada.', meta: {}, createdAt: iso(360) },
      { id: crypto.randomUUID(), type: 'quote_sent', userId: 'coordinator', message: 'Cotizacion enviada al cliente.', meta: { channel: 'whatsapp' }, createdAt: iso(250) },
      { id: crypto.randomUUID(), type: 'quote_approved', userId: 'coordinator', message: 'Cliente aprueba cotización.', meta: { channel: 'whatsapp' }, createdAt: iso(220) },
      { id: crypto.randomUUID(), type: 'parts_validated', userId: 'mechanic', message: 'Repuestos validados y listos.', meta: {}, createdAt: iso(110) },
      { id: crypto.randomUUID(), type: 'ready_delivery', userId: 'mechanic', message: 'Trabajo listo para entrega.', meta: {}, createdAt: iso(20) },
    ],
  };
};

export function normalizeOrder(order = {}) {
  const base = newOrder();
  const normalized = {
    ...base,
    ...order,
    vehicle: { ...base.vehicle, ...(isPlainObject(order.vehicle) ? order.vehicle : {}) },
    client: { ...base.client, ...(isPlainObject(order.client) ? order.client : {}) },
    quote: normalizeQuote(order.quote || base.quote),
    photos: asArray(order.photos),
    findings: asArray(order.findings),
    risk: normalizeRisk(order.risk),
    parts: asArray(order.parts),
    progressPhotos: asArray(order.progressPhotos),
    aiMessages: isPlainObject(order.aiMessages) ? order.aiMessages : {},
    assignedTo: validWorkshopUserId(order.assignedTo || order.assignedUserId || base.assignedTo) ? order.assignedTo || order.assignedUserId || base.assignedTo : '',
    assignedAt: order.assignedAt || '',
    assignedBy: validWorkshopUserId(order.assignedBy || order.updatedByUserId || base.assignedBy) ? order.assignedBy || order.updatedByUserId || base.assignedBy : '',
    tasks: asArray(order.tasks).map(normalizeOrderTask).filter(Boolean),
    comments: asArray(order.comments).map(normalizeComment).filter(Boolean),
    events: asArray(order.events).map(normalizeOrderEvent).filter(Boolean),
  };

  if (normalized.assignedTo && !normalized.assignedAt) normalized.assignedAt = normalized.updatedAt || normalized.createdAt || new Date().toISOString();
  return normalized;
}

export function assignOrder(order, assigneeId, actorId = '') {
  const current = normalizeOrder(order);
  if (assigneeId && !validWorkshopUserId(assigneeId)) throw new Error('Usuario asignado invalido.');
  if (actorId && !validWorkshopUserId(actorId)) throw new Error('Usuario actor invalido.');

  const now = new Date().toISOString();
  const next = {
    ...current,
    assignedTo: assigneeId || '',
    assignedBy: actorId || current.assignedBy || '',
    assignedAt: assigneeId ? now : '',
    updatedAt: now,
  };

  return appendOrderEvent(next, {
    type: assigneeId ? 'order_assigned' : 'order_unassigned',
    userId: actorId,
    message: assigneeId ? `Orden asignada a ${workshopUserName(assigneeId)}.` : 'Orden sin asignacion.',
    meta: { assignedTo: assigneeId || '' },
  });
}

export function createOrderTask(order, input = {}, actorId = '') {
  const current = normalizeOrder(order);
  const task = normalizeOrderTask({
    ...input,
    id: input.id || crypto.randomUUID(),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString(),
    createdBy: input.createdBy || actorId,
  });
  if (!task) throw new Error('Tarea invalida.');
  if (actorId && !validWorkshopUserId(actorId)) throw new Error('Usuario actor invalido.');

  return appendOrderEvent({
    ...current,
    tasks: [...current.tasks, task],
    updatedAt: task.updatedAt,
  }, {
    type: 'task_created',
    userId: actorId,
    message: `Tarea creada: ${task.title}.`,
    meta: { taskId: task.id },
  });
}

export function updateOrderTask(order, taskId, patch = {}, actorId = '') {
  const current = normalizeOrder(order);
  if (actorId && !validWorkshopUserId(actorId)) throw new Error('Usuario actor invalido.');
  const existing = current.tasks.find((task) => task.id === taskId);
  if (!existing) throw new Error('Tarea no encontrada.');

  const now = new Date().toISOString();
  const nextTask = normalizeOrderTask({
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    updatedAt: now,
    completedAt: patch.status === 'done' && existing.status !== 'done' ? now : patch.status && patch.status !== 'done' ? '' : existing.completedAt,
  });
  if (!nextTask) throw new Error('Tarea invalida.');

  return appendOrderEvent({
    ...current,
    tasks: current.tasks.map((task) => (task.id === taskId ? nextTask : task)),
    updatedAt: now,
  }, {
    type: 'task_updated',
    userId: actorId,
    message: `Tarea actualizada: ${nextTask.title}.`,
    meta: { taskId },
  });
}

export function addOrderComment(order, input = {}, actorId = '') {
  const current = normalizeOrder(order);
  const comment = normalizeComment({
    ...input,
    id: input.id || crypto.randomUUID(),
    userId: input.userId || actorId,
    createdAt: input.createdAt || new Date().toISOString(),
  });
  if (!comment) throw new Error('Comentario invalido.');

  return appendOrderEvent({
    ...current,
    comments: [...current.comments, comment],
    updatedAt: comment.createdAt,
  }, {
    type: 'comment_added',
    userId: comment.userId,
    message: 'Comentario interno agregado.',
    meta: { commentId: comment.id },
  });
}

export function extractVehicleHints(text = '') {
  const brands = ['Chevrolet', 'Hyundai', 'Kia', 'Toyota', 'Nissan', 'Suzuki', 'Peugeot', 'Citroen', 'Ford', 'Mazda', 'Volkswagen', 'Renault'];
  const brand = brands.find((item) => new RegExp(`\\b${item}\\b`, 'i').test(text)) || '';
  const year = text.match(/\b(19[8-9]\d|20[0-3]\d)\b/)?.[0] || '';
  const engine = text.match(/\b([0-9]\.[0-9])\b/)?.[1] || '';
  const plate = text.match(/\b([A-Z]{2}[- ]?[A-Z]{2}[- ]?\d{2}|[A-Z]{2}[- ]?\d{4}|[A-Z]{4}[- ]?\d{2})\b/i)?.[1]?.toUpperCase().replace(/\s/g, '-') || '';
  let model = '';
  if (brand) {
    const afterBrand = text.match(new RegExp(`${brand}\\s+([A-Za-z0-9-]+)`, 'i'))?.[1] || '';
    if (afterBrand && !/^(19|20)\d{2}$/.test(afterBrand)) model = titleCase(afterBrand);
  }
  return { brand, model, year, engine, plate };
}

export function generateIntake(order) {
  const text = order.intakeText || '';
  const lower = text.toLowerCase();
  const system = lower.includes('calienta') || lower.includes('agua') || lower.includes('refrigerante')
    ? 'Refrigeracion'
    : lower.includes('freno')
      ? 'Frenos'
      : lower.includes('bujia') || lower.includes('buj')
        ? 'Encendido'
        : 'Revision general';

  const checklist = {
    Refrigeracion: ['Bomba de agua', 'Mangueras', 'Radiador', 'Tapa', 'Termostato', 'Electroventilador', 'Refrigerante', 'Purga'],
    Frenos: ['Pastillas', 'Discos', 'Liquido de frenos', 'Mangueras', 'Sensores', 'Prueba de pedal'],
    Encendido: ['Bujias', 'Bobinas', 'Cables', 'Separacion', 'Codigo o muestra de pieza'],
    'Revision general': ['Sintoma declarado', 'Prueba visual', 'Prueba de funcionamiento', 'Fotos de evidencia'],
  }[system];

  return [
    `Vehículo base: ${vehicleSpec(order)}.`,
    'Regla de compatibilidad: validar marca, modelo, año, motor/cilindrada y patente antes de sugerir repuestos.',
    vehicleHintsText(text),
    '',
    `Sistema probable: ${system}.`,
    'Datos detectados:',
    text || 'Sin nota inicial.',
    '',
    'Checklist inicial:',
    ...checklist.map((item) => `- ${item}`),
    '',
    'Preguntas sugeridas:',
    '- ¿Cuándo ocurre la falla?',
    '- ¿Se encendió algún testigo?',
    '- ¿El vehículo siguió circulando?',
    '- ¿El cliente compró o comprará repuestos?',
  ].join('\n');
}

function vehicleHintsText(text) {
  const hints = extractVehicleHints(text);
  const entries = [
    hints.brand && `marca ${hints.brand}`,
    hints.model && `modelo ${hints.model}`,
    hints.year && `año ${hints.year}`,
    hints.engine && `motor/cilindrada ${hints.engine}`,
    hints.plate && `patente ${hints.plate}`,
  ].filter(Boolean);
  return entries.length ? `Datos detectables en texto libre: ${entries.join(', ')}.` : 'Datos detectables en texto libre: ninguno suficiente.';
}

export function generateInspection(order) {
  const lines = [
    `Vehículo considerado: ${vehicleSpec(order)}.`,
    'Sugerencias IA para la revisión:',
  ];
  const allText = `${order.intakeText} ${order.findings.map((finding) => `${finding.description} ${finding.recommendation}`).join(' ')}`.toLowerCase();
  if (criticalSafetyText(allText) || engineSafetyStatus(order).state === 'critical') {
    lines.push('- Si hay agua/refrigerante en aceite o aceite color mayonesa: no encender, no prueba de ruta.');
    lines.push('- Registrar muestra de varilla/tapa, evaluar contaminación, presión de sistema y daño interno antes de cualquier arranque.');
  }
  if (allText.includes('bomba') || allText.includes('refrigerante') || allText.includes('agua')) {
    lines.push('- Si cambia bomba de agua, incluir refrigerante nuevo.');
    lines.push('- Revisar correa asociada, tensor y estado de mangueras.');
    lines.push('- Purgar sistema y probar temperatura antes de entregar.');
    lines.push('- Validar si la bomba trae junta o sello.');
    lines.push('- Confirmar compatibilidad de bomba, correa y refrigerante con motor/cilindrada exacta.');
  }
  if (allText.includes('buj')) {
    lines.push('- Pedir muestra o codigo de bujia antes de comprar.');
    lines.push('- Revisar bobinas/cables si persiste falla de encendido.');
  }
  if (allText.includes('freno')) {
    lines.push('- Confirmar pastillas, discos y liquido de frenos.');
    lines.push('- Advertir asentamiento y prueba posterior.');
  }
  if (lines.length === 2) lines.push('- Completar hallazgos para generar recomendaciones especificas.');
  return lines.join('\n');
}

export function generateQuoteMessage(order) {
  const stages = quoteStages(order.quote);
  const visibleStages = stages.filter((stage) => stage.note || stage.condition || stage.status !== 'required');
  return [
    `Hola ${order.client.name || ''}, dejo cotización para ${vehicleName(order)}.`,
    `Datos para compatibilidad: ${vehicleSpec(order)}.`,
    visibleStages.length ? '' : '',
    visibleStages.length ? 'Etapas / condiciones:' : '',
    ...visibleStages.map((stage) => `- ${stage.title}: ${quoteStageStatuses[stage.status] || stage.status}${stage.condition ? ` (${stage.condition})` : ''}${stage.note ? `. ${stage.note}` : ''}`),
    '',
    'Trabajo / mano de obra:',
    ...order.quote.labor.map((item) => `- ${item.name}: ${money(item.amount)}`),
    '',
    'Repuestos e insumos:',
    ...(order.quote.parts.length ? order.quote.parts.map((item) => `- ${item.name}: ${item.amount ? money(item.amount) : 'por confirmar'}`) : ['- Por confirmar']),
    '',
    order.quote.extras.length ? 'Extras / gestion:' : '',
    ...order.quote.extras.map((item) => `- ${item.name}: ${money(item.amount)}`),
    '',
    `Total estimado: ${money(quoteTotal(order.quote))}`,
    order.quote.note ? `Condicion: ${order.quote.note}` : '',
    '',
    'Confirme si comprará los repuestos o si desea que los cotice/gestione el mecánico.',
    'Antes de comprar, validar que cada repuesto corresponda a marca, modelo, año y motor/cilindrada.',
  ].filter(Boolean).join('\n');
}

export function generatePartsMessage(order) {
  const parts = order.parts.length ? order.parts : order.quote.parts.map((item) => ({ ...item, status: 'pending', owner: 'client', dueDate: '', notes: '' }));
  return [
    `Seguimiento de repuestos para ${vehicleName(order)}:`,
    `Compatibilidad: ${vehicleSpec(order)}.`,
    '',
    ...parts.map((part) => `- ${part.name || 'Repuesto'}: ${partStatuses[part.status] || 'Pendiente'}${part.dueDate ? `, llega ${part.dueDate}` : ''}${part.notes ? `. ${part.notes}` : ''}`),
    '',
    'Por favor avise si alguno se retrasa, si no lo encuentra o si necesita que el mecánico lo cotice.',
    'Antes de agendar, envíe foto del repuesto para validar marca, modelo, año, motor/cilindrada y código si aplica.',
  ].join('\n');
}

export function generateDeliverySummary(order) {
  return [
    `Trabajo finalizado para ${vehicleName(order)}.`,
    `Vehículo: ${vehicleSpec(order)}.`,
    '',
    'Resumen:',
    order.executionNotes || '- Se realizo el trabajo documentado en la orden.',
    '',
    'Hallazgos principales:',
    ...(order.findings.length ? order.findings.map((finding) => `- ${finding.area}: ${finding.description}`) : ['- Sin hallazgos adicionales registrados.']),
    '',
    'Recomendación:',
    'Revisar el comportamiento del vehículo durante los próximos días y avisar si aparece ruido, fuga, testigo o temperatura fuera de rango.',
  ].join('\n');
}

export function clientDataMessage(order) {
  return `Hola, para completar la orden ${order.number} necesito tus datos de contacto y confirmar datos del vehículo. Puedes responder por aquí o completar el link enviado.`;
}

export function quoteTotal(quote) {
  const stagedItems = quoteStages(quote).flatMap((stage) => asArray(stage.items));
  if (stagedItems.length) return stagedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return [...asArray(quote.labor), ...asArray(quote.parts), ...asArray(quote.extras)].reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

export function materializeQuoteParts(quoteParts = [], existingParts = []) {
  const sourceParts = asArray(quoteParts).flatMap((item) => {
    if (isPlainObject(item) && Array.isArray(item.items)) {
      return item.items.filter((stageItem) => stageItem.kind === 'part' && stageItem.materializePart !== false);
    }
    return item;
  });
  const existingByKey = new Map(existingParts.map((part) => [part.id || (part.name || '').toLowerCase(), part]));
  return sourceParts.map((part) => {
    const current = existingByKey.get(part.id) || existingByKey.get((part.name || '').toLowerCase());
    return {
      id: current?.id || part.id || crypto.randomUUID(),
      name: current?.name || part.name,
      owner: current?.owner || 'client',
      status: current?.status || 'pending',
      dueDate: current?.dueDate || '',
      notes: current?.notes || '',
      price: current?.price || part.amount || '',
      photoDataUrl: current?.photoDataUrl || '',
      validatedBy: current?.validatedBy || '',
      updatedAt: current?.updatedAt || '',
    };
  });
}

export function prepScore(order) {
  const missingClient = !order.client.name || !order.client.phone;
  const quoteParts = quotePartItems(order.quote);
  const missingPartTracking = quoteParts.length > 0 && order.parts.length === 0;
  const delayed = order.parts.some((part) => ['delayed', 'wrong'].includes(part.status));
  const pending = order.parts.some((part) => ['pending', 'client_buying', 'mechanic_quote', 'mechanic_buying', 'in_transit'].includes(part.status));
  if (missingClient) return { state: 'red', label: 'Bloqueada', detail: 'Faltan datos del cliente.' };
  if (missingPartTracking) return { state: 'amber', label: 'Pendiente', detail: 'La cotización tiene repuestos sin seguimiento.' };
  if (delayed) return { state: 'red', label: 'Bloqueada', detail: 'Hay repuestos retrasados o incorrectos.' };
  if (pending) return { state: 'amber', label: 'Pendiente', detail: 'Falta confirmar uno o mas repuestos.' };
  return { state: 'green', label: 'Lista', detail: 'Cliente y repuestos listos para agendar.' };
}

export function readinessBadge(order) {
  if (order.status === 'closed') return { state: 'green', label: 'Cerrada', detail: 'Orden cerrada.' };
  if (order.status === 'ready_delivery') return { state: 'green', label: 'Lista entrega', detail: 'Trabajo listo para entregar.' };
  const safety = engineSafetyStatus(order);
  if (safety.state === 'critical') return { state: 'red', label: 'No encender', detail: safety.detail };
  if (safety.state === 'warning') return { state: 'amber', label: 'No circular', detail: safety.detail };
  return prepScore(order);
}

export function executionGate(order) {
  const safety = engineSafetyStatus(order);
  const checks = [
    { label: 'Cliente registrado', ok: Boolean(order.client.name && order.client.phone) },
    { label: 'Vehiculo identificado', ok: Boolean(order.vehicle.brand && order.vehicle.model && order.vehicle.year && order.vehicle.engine) },
    { label: 'Hallazgos documentados', ok: order.findings.length > 0 },
    { label: safety.state === 'critical' ? `Motor seguro para encender: ${safety.detail}` : 'Motor seguro para encender', ok: safety.state !== 'critical' },
    { label: 'Cotizacion aprobada', ok: Boolean(order.quote.approved) },
    { label: 'Repuestos listos o sin bloqueo', ok: prepScore(order).state === 'green' },
  ];
  return {
    checks,
    ok: checks.every((check) => check.ok),
    blockers: checks.filter((check) => !check.ok).map((check) => check.label),
  };
}

export function normalizeRisk(risk = {}) {
  const source = isPlainObject(risk) ? risk : {};
  const safetyStatus = source.safetyStatus === 'cleared' && cleanText(source.clearanceNote) ? 'cleared' : source.safetyStatus || '';
  return {
    level: ['normal', 'warning', 'critical'].includes(source.level) ? source.level : 'normal',
    noStart: Boolean(source.noStart),
    summary: cleanText(source.summary || ''),
    customerMessage: cleanText(source.customerMessage || ''),
    safetyStatus,
    clearanceNote: cleanText(source.clearanceNote || ''),
    clearedByUserId: validWorkshopUserId(source.clearedByUserId) ? source.clearedByUserId : '',
    clearedAt: source.clearedAt || '',
  };
}

export function engineSafetyStatus(order = {}) {
  const risk = normalizeRisk(order.risk);
  const released = risk.safetyStatus === 'cleared' && risk.clearanceNote;
  const findings = asArray(order.findings);
  const blockers = [];
  const warning = [];
  for (const finding of findings) {
    const status = finding.safetyStatus || '';
    if (status === 'cleared' && cleanText(finding.clearanceNote)) continue;
    if (finding.safetyImpact === 'no_start') blockers.push(finding.id || finding.area || 'hallazgo');
    if (finding.safetyImpact === 'no_drive' || finding.severity === 'critico') warning.push(finding.id || finding.area || 'hallazgo');
  }
  const text = `${order.intakeText || ''} ${findings.map((finding) => `${finding.symptom || ''} ${finding.description || ''} ${finding.recommendation || ''} ${finding.customerRisk || ''}`).join(' ')}`;
  if (!released && (risk.noStart || risk.level === 'critical' || blockers.length || criticalSafetyText(text))) {
    return {
      state: 'critical',
      label: 'No encender',
      detail: risk.summary || 'Posible contaminación de aceite/refrigerante o daño interno. No arrancar hasta liberar técnicamente.',
      blockers,
    };
  }
  if (risk.level === 'warning' || warning.length) {
    return {
      state: 'warning',
      label: 'No circular',
      detail: risk.summary || 'Hallazgo con riesgo operativo. Revisar antes de circular.',
      blockers: warning,
    };
  }
  return { state: 'normal', label: 'Sin bloqueo critico', detail: risk.summary || 'Sin bloqueo de seguridad registrado.', blockers: [] };
}

export function vehicleName(order) {
  const parts = [order.vehicle.brand, order.vehicle.model, order.vehicle.year, order.vehicle.plate].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Vehiculo sin identificar';
}

export function vehicleSpec(order) {
  const spec = [
    order.vehicle.brand && `marca ${order.vehicle.brand}`,
    order.vehicle.model && `modelo ${order.vehicle.model}`,
    order.vehicle.year && `año ${order.vehicle.year}`,
    order.vehicle.engine && `motor/cilindrada ${order.vehicle.engine}`,
    order.vehicle.cylinders && `${order.vehicle.cylinders} cilindros`,
    order.vehicle.fuel && `combustible ${order.vehicle.fuel}`,
    order.vehicle.transmission && `transmision ${order.vehicle.transmission}`,
    order.vehicle.plate && `patente ${order.vehicle.plate}`,
  ].filter(Boolean);
  return spec.length ? spec.join(', ') : 'faltan datos de vehículo';
}

export function money(value) {
  return Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

export function normalizeWhatsAppPhone(phone = '') {
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('569') && digits.length === 11) return digits;
  if (digits.length === 9 && digits.startsWith('9')) return `56${digits}`;
  return '';
}

function normalizeQuote(quote) {
  const base = newOrder().quote;
  const source = isPlainObject(quote) ? quote : {};
  return {
    ...base,
    ...source,
    schemaVersion: Number(source.schemaVersion || base.schemaVersion || 2),
    stages: normalizeQuoteStages(source.stages || base.stages),
    labor: asArray(source.labor),
    parts: asArray(source.parts),
    extras: asArray(source.extras),
  };
}

function normalizeQuoteStages(stages = []) {
  const sourceStages = asArray(stages);
  const byId = new Map(defaultQuoteStages().map((stage) => [stage.id, stage]));
  const merged = sourceStages.length ? sourceStages : defaultQuoteStages();
  return merged.map((stage) => {
    const template = byId.get(stage.id) || {};
    return {
      id: String(stage.id || crypto.randomUUID()),
      type: stage.type || template.type || 'custom',
      title: cleanText(stage.title || template.title || 'Etapa'),
      status: quoteStageStatuses[stage.status] ? stage.status : template.status || 'conditional',
      condition: cleanText(stage.condition || template.condition || ''),
      note: cleanText(stage.note || ''),
      items: asArray(stage.items).map(normalizeQuoteStageItem).filter(Boolean),
    };
  });
}

function normalizeQuoteStageItem(item = {}) {
  if (!isPlainObject(item)) return null;
  const name = cleanText(item.name || item.title || '');
  if (!name) return null;
  return {
    id: String(item.id || crypto.randomUUID()),
    kind: ['labor', 'part', 'extra'].includes(item.kind) ? item.kind : 'labor',
    name,
    amount: Number(item.amount || 0),
    required: item.required !== false,
    materializePart: item.materializePart !== false,
    sourceFindingId: item.sourceFindingId || '',
  };
}

export function quoteStages(quote = {}) {
  return normalizeQuote(quote).stages;
}

export function quotePartItems(quote = {}) {
  const staged = quoteStages(quote).flatMap((stage) => stage.items.filter((item) => item.kind === 'part' && item.materializePart !== false));
  return staged.length ? staged : asArray(quote.parts);
}

function criticalSafetyText(value = '') {
  const text = String(value || '').toLowerCase();
  return [
    'agua en aceite',
    'aceite con agua',
    'refrigerante en aceite',
    'aceite cafe con leche',
    'cafe con leche',
    'mayonesa',
    'no encender',
    'sin aceite',
    'golpe motor',
    'hidrolock',
  ].some((pattern) => text.includes(pattern));
}

function normalizeOrderTask(task) {
  if (!isPlainObject(task)) return null;
  const title = cleanText(task.title || task.name);
  if (!title) return null;
  const assignedTo = validWorkshopUserId(task.assignedTo || task.assignedUserId) ? task.assignedTo || task.assignedUserId : '';
  const createdBy = validWorkshopUserId(task.createdBy || task.createdByUserId) ? task.createdBy || task.createdByUserId : '';
  return {
    id: String(task.id || crypto.randomUUID()),
    title,
    status: taskStatuses[task.status] ? task.status : 'open',
    priority: taskPriorities[task.priority] ? task.priority : 'normal',
    targetStep: workflowTargetSteps[task.targetStep] ? task.targetStep : 'execution',
    assignedTo,
    assignedUserId: assignedTo,
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || task.createdAt || new Date().toISOString(),
    createdBy,
    createdByUserId: createdBy,
    dueDate: task.dueDate || '',
    completedAt: task.status === 'done' ? task.completedAt || new Date().toISOString() : '',
    notes: cleanText(task.notes || ''),
  };
}

function normalizeComment(comment) {
  if (!isPlainObject(comment)) return null;
  const text = cleanText(comment.text || comment.message);
  if (!text) return null;
  const userId = validWorkshopUserId(comment.userId) ? comment.userId : '';
  return {
    id: String(comment.id || crypto.randomUUID()),
    userId,
    text,
    createdAt: comment.createdAt || new Date().toISOString(),
  };
}

function appendOrderEvent(order, event) {
  const nextEvent = normalizeOrderEvent({
    id: event.id || crypto.randomUUID(),
    type: event.type,
    userId: event.userId,
    message: event.message,
    meta: event.meta,
    createdAt: event.createdAt || new Date().toISOString(),
  });
  return {
    ...order,
    events: nextEvent ? [...asArray(order.events), nextEvent] : asArray(order.events),
  };
}

function normalizeOrderEvent(event) {
  if (!isPlainObject(event)) return null;
  const type = cleanText(event.type);
  if (!type) return null;
  return {
    id: String(event.id || crypto.randomUUID()),
    type,
    userId: validWorkshopUserId(event.userId) ? event.userId : '',
    message: cleanText(event.message || ''),
    meta: isPlainObject(event.meta) ? event.meta : {},
    createdAt: event.createdAt || new Date().toISOString(),
  };
}

function validWorkshopUserId(userId) {
  return workshopUsers.some((user) => user.active && user.id === userId);
}

function workshopUserName(userId) {
  return workshopUsers.find((user) => user.id === userId)?.name || 'usuario';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  return String(value || '').replace(/<[^>]*>/g, '').trim().slice(0, 1000);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
