# Revision UX y diseno responsive - MecanicOK

Fecha: 2026-05-19

## Diagnostico ejecutivo

La arquitectura de producto es correcta: el sidebar debe contener la operacion general
del taller y el proceso de atencion debe vivir dentro de `Trabajos`. La primera visita
tambien debe ser un wizard, porque el mecanico necesita foco, orden y compuertas claras.

El problema principal a resolver antes de seguir agregando funciones es responsive. El
usuario critico es el mecanico en terreno, probablemente con telefono, luz variable y
necesidad de capturar fotos rapido. En ese contexto la interfaz actual funciona, pero
todavia se siente como una app desktop comprimida.

## Principio de diseno

MecanicOK debe tener dos modos visuales:

1. **Modo gestion**: dashboard, trabajos, clientes, historial y pendientes. Sirve para
   revisar cartera, estados, atrasos y prioridades.
2. **Modo atencion**: primera visita / trabajo en proceso. Sirve para completar una sola
   tarea guiada, con minimo ruido visual y acciones principales siempre visibles.

La IA debe aparecer como copiloto contextual, no como pantalla aparte. Debe entrar despues
de que el mecanico ingresa datos y debe devolver: resumen, faltantes, riesgos y sugerencias
de oportunidad.

## Hallazgos por modulo

### Sidebar global

Estado actual: correcto para desktop. Contiene `Tablero`, `Trabajos`, `Clientes`,
`Historial`, `Pendientes`, `Nueva orden` y `Cargar ejemplo`.

Problema: en mobile el sidebar se apila arriba y consume mucho espacio antes de llegar al
trabajo. Eso perjudica el uso en terreno.

Recomendacion:

- Desktop: mantener sidebar fijo.
- Tablet: transformarlo en top nav compacto.
- Mobile: usar bottom navigation con 4 acciones maximas: `Tablero`, `Trabajos`,
  `Clientes`, `Pendientes`. `Historial` queda dentro de `Trabajos` o en menu secundario.
- En mobile, `Primera visita` debe ser un boton fijo/visible dentro de `Trabajos`, no una
  accion perdida bajo el header.

### Dashboard

Estado actual: util como resumen operativo.

Problema: muestra selector de orden activa en la parte superior, lo que mezcla gestion
general con trabajo puntual.

Recomendacion:

- Dashboard no deberia tener selector de orden activa como control principal.
- Debe priorizar: trabajos abiertos, esperando repuestos, cotizaciones pendientes,
  listos para trabajar y atrasados.
- Cada tarjeta debe llevar a una lista filtrada de `Trabajos`.

### Trabajos

Estado actual: ya esta alineado con la decision correcta: primer bloque `Primera visita`,
debajo `Trabajos en proceso` con filtros.

Mejoras necesarias:

- `Primera visita` debe ser el CTA mas fuerte del modulo.
- Las cards de trabajos deben mostrar siempre:
  - cliente
  - vehiculo
  - estado
  - siguiente accion
  - dias pendiente
  - fecha llegada repuesto si aplica
  - bloqueo principal si existe
- En mobile, cada card debe ser muy escaneable: titulo, estado, siguiente accion y una
  linea de alerta. El detalle secundario puede quedar comprimido.

### Primera visita / Wizard

Estado actual: el wizard existe y el orden general es bueno:
vehiculo, diagnostico, fotos recepcion, fotos detalle, cliente, revision, cotizacion,
repuestos, ejecucion, entrega.

Problemas UX:

- En desktop sigue conviviendo con sidebar global; para atencion deberia sentirse como
  modo foco.
- En mobile hay demasiados pasos visibles al mismo tiempo.
- El stepper horizontal de 10 pasos es correcto para desktop, pero pesado para telefono.
- La navegacion `Anterior/Siguiente` debe estar fija abajo en mobile.

Recomendacion:

- Desktop: wizard en modo foco dentro del workspace, con sidebar global visible pero
  secundario.
- Tablet/mobile: ocultar sidebar durante el wizard y mostrar una barra superior compacta:
  `MO-xxxxx`, vehiculo, estado, boton salir.
- Mobile: reemplazar stepper completo por `Paso 1 de 10 - Vehiculo`, con boton para abrir
  lista de pasos.
- Mobile: `Anterior/Siguiente` fijo abajo, siempre al alcance del pulgar.
- Cada paso debe tener una accion primaria clara y una sola decision principal.

### Captura de fotos

Estado actual: correcto como concepto, pero debe volverse mas fisico y rapido.

Recomendacion responsive:

- Desktop: grilla 3 columnas.
- Tablet: grilla 2 columnas.
- Mobile: botones grandes, 1 o 2 columnas segun ancho; texto corto; boton de camara
  dominante.
- Despues de capturar una foto, mostrar miniatura con tipo, fecha/hora y boton `Quitar`.
- En mobile, mantener visible el progreso: `3/7 fotos minimas`.

### Revision

Estado actual: funcional, pero aun parece formulario tecnico extenso.

Recomendacion:

- Convertir revision en bloques repetibles por sistema: sistema, sintoma, prueba, resultado,
  severidad, recomendacion, requiere cotizacion.
- En desktop puede ser formulario completo.
- En mobile debe ser una card por hallazgo, con campos colapsables.
- IA debe sugerir hallazgos relacionados y faltantes considerando marca, modelo, ano y motor.

### Cotizacion

Estado actual: toma campos de revision, que es correcto.

Regla UX:

La cotizacion debe nacer desde revision, no desde cero. Cada hallazgo marcado como
`cotizar` debe poder transformarse en mano de obra, repuesto, insumo o recomendacion.

Responsive:

- Desktop: tabla/listas de partidas.
- Mobile: cards editables por item, con total fijo visible al final.
- CTA primario: `Enviar cotizacion`.
- CTA secundario: `Guardar borrador`.

### Portal cliente

Estado actual: bien encaminado. Tiene vista separada y no muestra sidebar.

Mejoras:

- Debe ser mobile-first.
- Mostrar primero: numero de orden, vehiculo, estado y que accion se espera del cliente.
- Si hay repuestos, cada repuesto debe tener un estado simple: pendiente, comprado,
  en camino, retrasado, recibido, incorrecto.
- La aprobacion de cotizacion debe estar visualmente separada del seguimiento de repuestos.

## Diseno responsive propuesto

### Desktop ancho: 1200 px o mas

- Sidebar fijo de 280 px.
- Workspace con maximo ancho util por modulo.
- Dashboard con 4 metricas en una fila.
- Trabajos con hero de primera visita y cards en grilla.
- Wizard con stepper horizontal completo.
- Pasos complejos en dos columnas: formulario principal + panel IA/resumen.
- AI panel sticky opcional en pasos de diagnostico, revision y cotizacion.

### Tablet: 768 a 1199 px

- Sidebar pasa a top nav compacto.
- Dashboard en 2 columnas.
- Trabajos en cards de 2 columnas.
- Wizard mantiene stepper horizontal, pero con scroll.
- Formularios pasan a una columna cuando el contenido tenga selects largos.
- Fotos en 2 columnas.
- Panel IA se ubica debajo del formulario, no al lado.

### Mobile terreno: 360 a 767 px

- Bottom nav o top bar muy compacta; no sidebar alto.
- `Trabajos` abre con CTA grande `Primera visita`.
- Wizard en modo foco:
  - header sticky: orden, vehiculo, estado
  - progreso: `Paso n/10`
  - contenido en una columna
  - acciones sticky abajo: `Anterior` y `Siguiente`
- Foto-first:
  - botones de camara grandes
  - miniaturas compactas
  - contador de fotos minimas
- Inputs con alto minimo 44 px.
- Textareas no deben dominar la pantalla; usar altura menor inicial y expansion.
- IA colapsada como bloque `Sugerencia IA`, expandible.

### Mobile pequeno: 320 a 359 px

- Una columna estricta.
- Ocultar texto secundario largo.
- Cards con maximo 3 lineas visibles.
- Botones con texto corto.
- Stepper solo como texto de progreso.

## Prioridades antes del siguiente sprint funcional

1. Redisenar mobile navigation: evitar sidebar apilado en mobile.
2. Crear modo foco para primera visita/trabajo en proceso.
3. Cambiar stepper mobile a progreso compacto.
4. Hacer navegacion del wizard sticky abajo en mobile.
5. Ajustar cards de trabajo para mostrar siguiente accion y bloqueo con mas fuerza.
6. Convertir paneles IA a bloques contextuales colapsables en mobile.
7. Definir layout mobile del portal cliente separado del layout mecanico.

## Criterios de aceptacion UX

- En telefono, desde `Trabajos`, iniciar una primera visita debe requerir un solo tap claro.
- En wizard mobile, el mecanico nunca debe tener que volver arriba para avanzar.
- Cada pantalla debe responder: que estoy haciendo, que falta, cual es la siguiente accion.
- Una orden bloqueada debe explicar el bloqueo en la card y dentro del wizard.
- La IA nunca debe ocultar el formulario principal; debe asistirlo.
- El cliente debe poder entender su portal sin ver modulos internos del taller.

