# Plan de 4 sprints - MecanicOK

## Regla IA

- Modelo remoto permitido: `gemini-3-flash-preview`.
- No se usa otro modelo remoto ni fallback remoto.
- La API key se configura fuera del repo como variable server-side `GEMINI_API_KEY`.
- No usar `VITE_GEMINI_API_KEY` en piloto: exponer la key al frontend es obsoleto y no aceptable para VPS.
- El modelo remoto queda fijado por el backend en `gemini-3-flash-preview`.
- Si no hay key configurada, el MVP conserva reglas locales para demo y muestra estado de IA no configurada.

## Sprint 1 - Navegacion y workflow entendible

Objetivo: que la app se entienda como sistema operativo, no como formulario por pasos.

Alcance:
- Sidebar global: Dashboard, Trabajos, Clientes, Historial, Pendientes.
- Vista Trabajos con cards por orden activa.
- Detalle de trabajo con stepper interno.
- Wizard de primera visita dentro del detalle.
- Estados visibles por trabajo y proxima accion.

Criterios de aceptacion:
- El sidebar no muestra pasos internos.
- Un trabajo se abre desde una card.
- El flujo Vehiculo -> Diagnostico -> Fotos recepcion -> Fotos detalle -> Cliente -> Revision -> Cotizacion -> Repuestos -> Ejecucion -> Entrega vive dentro del trabajo.

## Sprint 2 - Usabilidad de terreno

Objetivo: hacer que el mecanico pueda trabajar con cliente al lado.

Alcance:
- Wizard mobile-first.
- Acciones claras: procesar IA, aplicar datos, siguiente, guardar y salir.
- Fotos por recepcion, repuestos y ejecucion.
- Modo cliente restringido.
- Validaciones para no ejecutar/cerrar sin datos clave.

Criterios de aceptacion:
- La primera visita se puede completar sin navegar por el sidebar.
- El cliente no ve informacion interna.
- Las tareas bloqueadas explican que falta.

## Sprint 3 - IA operativa con Gemini

Objetivo: pasar de reglas locales a IA operativa controlada.

Alcance:
- `aiService` centralizado.
- Llamadas remotas solo a `gemini-3-flash-preview`.
- Prompts estructurados por tarea: recepcion, revision, cotizacion, repuestos, cierre.
- Reglas locales como demo cuando no hay API key.
- Mensajes siempre incluyen marca, modelo, ano, motor/cilindrada y patente.

Criterios de aceptacion:
- Ninguna llamada remota usa otro modelo.
- La key no esta hardcodeada.
- Si falta configuracion, la UI no falla.

## Sprint 4 - QA, calidad y preparacion piloto

Objetivo: dejar el MVP listo para piloto controlado.

Alcance:
- Tests de dominio.
- Smoke test en navegador.
- Revision mobile/responsive.
- Estado claro de limites: localStorage, fotos locales, WhatsApp via link.
- Preparar siguiente paso: backend, storage y tokens para cliente.

Criterios de aceptacion:
- `npm test` pasa.
- `npm run build` pasa.
- Flujo navegador completo pasa.
- README documenta uso, IA y limites.

## Sprint Pre-VPS - Piloto V1 controlado

Objetivo: dejar MecanicOK operable en un VPS para pruebas reales controladas, con
configuracion reproducible, verificacion objetiva, backup y salida rapida ante incidentes.

Alcance:
- Checklist operativo de deploy y validacion posterior.
- Variables de entorno de produccion documentadas y sin secretos reales en repo.
- Politica minima de CORS, HTTPS, persistencia y secretos.
- Procedimiento de backup/restauracion del volumen `/data`.
- Smoke test documentado contra dominio o IP del VPS.
- Rollback documentado para volver a la imagen/version anterior.
- Registro de revisiones por rol: DevOps, QA, Seguridad y Operaciones.

Criterios de aceptacion:
- `docs/deploy-vps.md` permite ejecutar el deploy sin asumir conocimiento del codigo.
- No queda documentacion vigente que recomiende `VITE_GEMINI_API_KEY`.
- El operador sabe que `/data` es el activo critico y debe persistirse.
- El volumen persistente oficial se llama `mecanic-ok-data`.
- El smoke cubre login, orden, revision, upload, portal cliente y healthcheck.
- El rollback no depende de borrar datos productivos.
- La salida a VPS queda clasificada como piloto controlado, no produccion comercial completa.

## Revision multiagente del sprint pre-VPS

DevOps:
- Debe existir una unica fuente operativa para deploy: `docs/deploy-vps.md`.
- El deploy debe exponer solo HTTP local detras de proxy HTTPS.
- El contenedor debe reiniciarse automaticamente y conservar `/data`.

QA:
- El smoke minimo debe ejecutarse despues de cada deploy y antes de entregar el link a usuarios.
- Si falla login, creacion de orden, upload o portal cliente, el deploy no pasa.
- Todo hallazgo debe anotarse con fecha, version/imagen y paso fallido.

Seguridad:
- `WORKSHOP_DEMO_PASSWORD`, `AUTH_PASSWORD_SALT` y `GEMINI_API_KEY` deben generarse fuera del repo.
- `CORS_ORIGIN` debe apuntar al dominio final; no usar `*` en piloto.
- La key de Gemini queda solo en backend mediante `GEMINI_API_KEY`.
- El smoke post-deploy debe pasar `SMOKE_PASSWORD`; npm no carga `.env.production` automaticamente.

Operaciones:
- El backup minimo cubre `/data` completo.
- Antes de actualizar, se toma backup manual verificable.
- El rollback usa imagen/version anterior y reutiliza el mismo volumen persistente.
