# Sprint pre-VPS V1 piloto

Objetivo: dejar MecanicOK en condiciones de correr una V1 de pruebas en un VPS con Docker, HTTPS, datos persistentes y verificacion operativa repetible.

## Alcance cerrado

- Deploy de un solo servicio Node que sirve frontend, API, uploads y `/health`.
- Docker Compose con volumen persistente para `/data`.
- Variables de produccion separadas del repo.
- Smoke test contra el dominio final.
- Checklist de backup y rollback.
- Guardrails para no arrancar produccion con clave demo o sal por defecto.

## Criterios de aceptacion

- `npm run check` pasa localmente.
- `docker compose up -d --build` deja el servicio healthy.
- `curl http://127.0.0.1:8787/health` responde `{"ok":true}` desde el VPS.
- `SMOKE_BASE_URL=https://tu-dominio.cl SMOKE_PASSWORD=clave_real npm run smoke` pasa desde una maquina con acceso al dominio.
- El volumen `mecanic-ok-data` existe y se incluye en backup.
- `CORS_ORIGIN` y `PUBLIC_APP_URL` apuntan al dominio HTTPS real.
- `VITE_DISABLE_LOCAL_FALLBACK=true` queda definido para evitar guardados locales silenciosos en produccion.
- La clave interna no es `mecanicok-demo` y `AUTH_PASSWORD_SALT` no usa el valor de ejemplo.
- El volumen Docker se llama oficialmente `mecanic-ok-data`.

## Checklist de ejecucion

1. Copiar `.env.production.example` a `.env.production` en el VPS.
2. Cambiar `WORKSHOP_DEMO_PASSWORD`, `AUTH_PASSWORD_SALT`, `PUBLIC_APP_URL`, `CORS_ORIGIN`, `SMOKE_BASE_URL` y `GEMINI_API_KEY`.
3. Ejecutar `docker compose up -d --build`.
4. Revisar `docker compose ps` y `docker logs -f mecanic-ok`.
5. Probar `curl http://127.0.0.1:8787/health`.
6. Configurar Nginx o Caddy con HTTPS hacia `127.0.0.1:8787`.
7. Ejecutar `SMOKE_BASE_URL=https://tu-dominio.cl SMOKE_PASSWORD=clave_real npm run smoke` contra el dominio.
8. Crear una orden real de prueba, generar link cliente y validar desde otro navegador/dispositivo.
9. Confirmar que los datos aparecen en `/data` dentro del volumen.
10. Programar backup diario del volumen antes de abrir el piloto.

## Backup minimo

Los datos criticos viven en el volumen Docker `mecanic-ok-data`, montado como `/data`:

- `orders.json`
- `client-tokens.json`
- `auth-sessions.json`
- `uploads/`

Comando manual de respaldo sugerido en VPS:

```bash
mkdir -p backups
docker run --rm \
  -v mecanic-ok-data:/data:ro \
  -v "$PWD/backups:/backup" \
  alpine sh -c 'tar czf /backup/mecanic-ok-data-$(date +%Y%m%d-%H%M%S).tgz -C /data .'
```

## Rollback minimo

1. Guardar el tag o commit desplegado antes de actualizar.
2. Antes de cambiar version, crear backup del volumen.
3. Si el smoke falla despues de desplegar, volver al tag anterior y levantar con `docker compose up -d --build`.
4. Si los datos quedan corruptos, detener el servicio y restaurar el ultimo backup validado del volumen.

## Fuera de alcance para este sprint

- Base de datos multi-taller.
- Recuperacion de contrasena e invitaciones.
- Storage externo para archivos.
- WhatsApp API oficial.
- Optimizacion del chunk grande del catalogo vehicular.
