# MecanicOK MVP

MVP React/Vite para validar un flujo de trabajo mecanico con IA en el medio:

- Recepcion con diagnostico libre.
- Registro visual del vehiculo.
- Modo cliente para capturar datos.
- Revision documentada con hallazgos.
- Cotizacion con mano de obra, repuestos e insumos.
- Seguimiento de repuestos y mensajes de WhatsApp.
- Ejecucion documentada.
- Entrega con resumen final e historial local.
- Modo cliente por link local con datos y estado de repuestos.
- Aprobacion/rechazo de cotizacion.
- Bloqueo de ejecucion si faltan cliente, vehiculo, hallazgos, aprobacion o repuestos.
- Fotos de recepcion, repuestos y ejecucion.

Regla clave del MVP: las respuestas de IA y los mensajes de repuestos siempre consideran
marca, modelo, ano, motor/cilindrada y patente cuando esos datos existen. La app advierte
que la compatibilidad debe validarse antes de comprar o agendar.

## Ejecutar

```bash
npm install
npm run server
npm run dev
```

La app usa la API por ruta relativa `/api`. En desarrollo Vite proxya `/api` y
`/uploads` a `http://127.0.0.1:8787`. Si la API no esta disponible, mantiene
fallback en `localStorage` para no romper la demo.

## Auth interno

El tablero interno exige login real contra la API local. Para el MVP existen usuarios
demo del taller:

- `admin` o `admin@mecanicok.local`
- `coordinator` o `coordinator@mecanicok.local`
- `mechanic` o `mechanic@mecanicok.local`
- `mechanic2` o `mechanic2@mecanicok.local`

La clave demo local es `mecanicok-demo`. Para cambiarla sin tocar codigo, define una
variable de entorno en el backend:

```bash
WORKSHOP_DEMO_PASSWORD=clave_segura
```

Tambien se acepta `AUTH_DEMO_PASSWORD`. Las sesiones usan bearer token, se guardan
hasheadas en `server/data/auth-sessions.json` y expiran despues de 12 horas. El portal
cliente sigue usando su link/token propio y no requiere login interno.

Permisos MVP:

- `admin`: administra taller, borra ordenes, crea links cliente, reasigna equipo y gestiona tareas.
- `coordinator`: coordina trabajos, reasigna equipo, gestiona tareas y crea links cliente; no borra ordenes.
- `mechanic`: trabaja ordenes y puede avanzar tareas asignadas; no borra ordenes, no reasigna equipo y no genera links cliente.

Responsabilidades por workflow:

- `Vehículo`, `Diagnóstico`, `Fotos`, `Revisión` y `Ejecución`: responsable principal `mechanic`; la IA puede asistir ordenando información o sugiriendo faltantes.
- `Cliente`, `Cotización`, `Repuestos` y `Entrega`: responsable principal `coordinator`; `admin` puede intervenir y el mecánico aporta datos técnicos.
- `Admin`: supervisa bloqueos, equipo asignado, tareas internas y acciones sensibles.
- Futuro `IA`: colaborador, no dueño de decisión; puede prellenar, sugerir y redactar, pero la validación final queda en el rol humano responsable.

La API expone el contexto del taller en `GET /api/workshop` y el equipo en
`GET /api/workshop/users`. El frontend usa el usuario autenticado como sesion real
y la lista del taller solo para asignaciones.

Datos backend:

- Ordenes: `server/data/orders.json`
- Tokens cliente: `server/data/client-tokens.json`
- Sesiones internas: `server/data/auth-sessions.json`
- Uploads: `server/uploads/`

En Docker/VPS esos datos viven en el volumen persistente montado como `/data`.

Sprint 2 dejo operativos los uploads contra la API local: el backend valida tipo
de archivo, tamano y firma basica de imagen/PDF, y permite borrar archivos
cuando una foto se quita desde la interfaz.

## IA Gemini

La IA remota corre server-side y usa exclusivamente `gemini-3-flash-preview`.
Configura `.env.local` o variables de entorno para el backend:

```bash
GEMINI_API_KEY=tu_api_key
```

La API key no debe quedar escrita en el codigo ni en variables `VITE_*`, porque
esas quedan expuestas al frontend.

## Selector de vehiculo

El MVP usa un indice local generado desde el CSV oficial de EPA/FuelEconomy.gov.
Permite seleccionar `ano -> marca -> modelo -> motor`, incluyendo cilindrada,
cilindros, combustible y transmision cuando el dato existe. La fuente cubre
vehiculos EPA/FuelEconomy.gov y puede regenerarse con:

```bash
npm run build:vehicles
```

El CSV bruto no se versiona. Para regenerar, descarga `vehicles.csv.zip` desde
`https://www.fueleconomy.gov/feg/download.shtml`, extrae `vehicles.csv` en
`tmp-epa/` y ejecuta el comando anterior.

## Pruebas

```bash
npm test
npm run build
npm run check
```

El MVP incluye pruebas de reglas de IA, compatibilidad de vehiculo, cotizacion,
seguimiento de repuestos, compuertas de ejecucion, API local, uploads y portal
cliente con token.

## Seed demo

Para cargar un taller demo con 2 mecanicos y 6 ordenes detalladas:

```bash
SEED_BASE_URL=https://mecania-test.onrender.com \
SEED_PUBLIC_APP_URL=https://mecania-test.onrender.com \
SEED_USER=admin \
SEED_PASSWORD=tu_clave_render \
npm run seed:demo
```

El seed crea casos en recepcion/revision, cotizacion, repuestos bloqueados,
ejecucion, entrega e historial cerrado. Cada orden incluye cliente, vehiculo,
hallazgos, cotizacion, repuestos, fotos placeholder, tareas, comentarios, eventos
y link de portal cliente. Si ya existen las ordenes `MO-DEMO-1001` a
`MO-DEMO-1006`, no las duplica.

## Limites conocidos

- El link con token funciona contra la API local y mantiene fallback demo en `localStorage` si la API no esta disponible.
- Para produccion falta base de datos multi-taller, invitaciones/restablecimiento de clave, HTTPS obligatorio, storage externo y cola de notificaciones.
- WhatsApp se abre con links generados; la API oficial queda para una siguiente etapa.

## Deploy VPS piloto

Usar `docker-compose.yml` y `.env.production.example` como base. La guia operativa
esta en `docs/deploy-vps.md` y el checklist de salida en `docs/VPS_PILOT_SPRINT.md`.
