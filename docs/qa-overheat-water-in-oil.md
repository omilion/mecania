# QA simulado: camioneta recalentada con agua en aceite

Fecha: 2026-05-20  
Orden creada en API local: `MO-059690`  
Cliente simulado: Marcelo Araya  
Vehiculo: Chevrolet D-Max 2.5 diesel 2014, 238.000 km aprox.

## Escenario

Cliente usa la camioneta para trabajo diario. Venia consumiendo agua hace dos semanas,
rellenaba con refrigerante barato y agua desmineralizada. En Vespucio con carga la
temperatura subio casi al rojo, salio vapor del capo y luego vio aceite color cafe con
leche en la varilla. Quiere diagnostico claro antes de comprar piezas o autorizar una
reparacion mayor.

## Criterio tecnico del mecanico senior

- No encender el motor si hay aceite emulsionado o sospecha de refrigerante en aceite.
- Documentar aceite, tapa, deposito, tablero, fugas y mangueras antes de intervenir.
- Descartar enfriador de aceite/EGR antes de condenar culata.
- Recomendar grua si se confirma contaminacion o riesgo de dano interno.
- Cotizar por etapas: diagnostico, traslado/taller, desmontaje, rectificadora, armado.

## Datos cargados en la app

- 11 evidencias/fotos simuladas:
  frontal, trasera, laterales, patente, odometro, tablero, varilla de aceite, tapa de
  aceite, deposito refrigerante y zona motor.
- 4 hallazgos:
  lubricacion/aceite, culata/empaquetadura, sistema refrigeracion, enfriador aceite/EGR.
- 13 items de cotizacion entre mano de obra, repuestos y extras.
- 5 repuestos/insumos a cotizar/confirmar.
- 3 tareas internas:
  confirmar VIN/codigo motor, no encender motor, coordinar grua/traslado.

## Resultado smoke

La orden quedo en `quote_sent`. El bloqueo de ejecucion funciono:

- Cliente registrado: OK.
- Vehiculo identificado: OK.
- Hallazgos documentados: OK.
- Cotizacion aprobada: pendiente.
- Repuestos listos o sin bloqueo: pendiente.

Total mano de obra/extras inicial: `$760.000` sin repuestos confirmados.

## Gaps detectados

1. El portal cliente abre correctamente, pero el resumen cliente deberia mostrar una
   seccion clara de hallazgos/riesgos en lenguaje simple para casos graves.
2. El link de cliente devuelto por API puede ser relativo si no se pasa `clientBaseUrl`;
   en VPS conviene forzar `PUBLIC_APP_URL`.
3. Falta campo explicito `noEncenderMotor` o `riskLevel=critical` para que la UI destaque
   motores con riesgo de dano interno.
4. Faltan tareas con destino de paso (`targetStep`) para que "confirmar VIN" abra Vehiculo
   y "coordinar grua" abra Repuestos/Coordinacion.
5. La cotizacion por etapas funciona con notas, pero deberia existir estructura nativa:
   diagnostico, traslado, reparacion probable, adicionales condicionados.

## Veredicto

El MVP soporta cargar y bloquear un caso complejo de motor, pero para piloto con mecanicos
conviene mejorar la comunicacion de riesgo critico y la cotizacion por etapas antes de usar
casos reales de culata/motor.
