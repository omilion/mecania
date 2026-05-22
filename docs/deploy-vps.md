# Deploy VPS MVP

Objetivo: correr frontend y API en un solo proceso Node. El servidor sirve `dist/`,
expone `/api/*`, `/health` y guarda datos en un volumen persistente.

Estado recomendado: apto para piloto V1 controlado en VPS, no produccion comercial
completa. El activo critico es el volumen `/data`: ahi quedan ordenes, sesiones,
tokens de cliente y uploads.

## Checklist pre-deploy

- Dominio o subdominio definido.
- Proxy HTTPS listo con Nginx, Caddy o equivalente.
- Puerto publico 80/443 abierto; puerto Node `8787` cerrado hacia internet si se usa proxy.
- Docker instalado y con reinicio automatico del servicio.
- Variables reales generadas fuera del repo.
- Volumen persistente creado para `/data`.
- Backup manual tomado antes de reemplazar una version existente.
- Smoke local aprobado: `npm test`, `npm run build` y flujo navegador/API.

## Variables minimas

Copiar `.env.production.example` a `.env.production` y cambiar los valores antes
de levantar el contenedor.

```bash
NODE_ENV=production
VITE_DISABLE_LOCAL_FALLBACK=true
HOST=0.0.0.0
PORT=8787
DATA_DIR=/data
UPLOADS_DIR=/data/uploads
PUBLIC_DIR=/app/dist
PUBLIC_APP_URL=https://tu-dominio.cl
CORS_ORIGIN=https://tu-dominio.cl
TRUST_PROXY=true
WORKSHOP_DEMO_PASSWORD=clave_temporal_segura
AUTH_PASSWORD_SALT=sal_larga_unica
GEMINI_API_KEY=tu_api_key
```

Notas:

- `WORKSHOP_DEMO_PASSWORD`: usar una clave temporal fuerte, distinta a cualquier clave personal.
- `AUTH_PASSWORD_SALT`: usar una cadena larga, unica e irrepetible para este VPS.
- `GEMINI_API_KEY`: variable server-side. No usar `VITE_GEMINI_API_KEY`.
- `PUBLIC_APP_URL`: debe apuntar al dominio HTTPS final cuando exista portal cliente.
- `CORS_ORIGIN`: debe ser el dominio HTTPS final. No usar `*` en piloto.
- `TRUST_PROXY=true`: usar solo cuando Node queda detras de Nginx/Caddy local.
- `VITE_DISABLE_LOCAL_FALLBACK=true`: en builds productivos evita guardar cambios solo en `localStorage` si la API falla.
- `DATA_DIR` y `UPLOADS_DIR`: deben vivir bajo el volumen persistente.
- Los links de portal cliente expiran por defecto despues de 72 horas.

## Deploy con Docker Compose

```bash
docker compose up -d --build
docker compose ps
docker logs -f mecanic-ok
```

El compose publica Node solo en `127.0.0.1:${APP_PORT:-8787}` para que Nginx/Caddy
sea la entrada publica con HTTPS.

## Deploy Docker directo

Usar solo si no se usa Compose. Evitar secretos inline en historial de shell;
preferir `--env-file .env.production`.

```bash
docker build -t mecanic-ok .
docker run -d \
  --name mecanic-ok \
  --restart unless-stopped \
  -p 127.0.0.1:8787:8787 \
  -v mecanic-ok-data:/data \
  --env-file .env.production \
  mecanic-ok
```

Verificacion inmediata:

```bash
curl http://127.0.0.1:8787/health
docker logs --tail 100 mecanic-ok
```

## Nginx basico

```nginx
server {
  server_name tu-dominio.cl;

  client_max_body_size 10m;

  location /api/auth/login {
    limit_req zone=mecanicok_login burst=10 nodelay;
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Definir la zona de rate limit en el bloque `http` de Nginx:

```nginx
limit_req_zone $binary_remote_addr zone=mecanicok_login:10m rate=10r/m;
```

## Smoke post-deploy

Ejecutar despues de levantar el contenedor y despues de activar HTTPS.

1. `curl http://127.0.0.1:8787/health` en el VPS debe responder OK.
2. `curl https://tu-dominio.cl/health` desde fuera debe responder OK.
3. Ejecutar `SMOKE_BASE_URL=https://tu-dominio.cl SMOKE_PASSWORD=clave_temporal_segura npm run smoke`.
4. Abrir `https://tu-dominio.cl` y hacer login de taller.
5. Crear una orden nueva con cliente, vehiculo y patente.
6. Cargar al menos una evidencia/upload.
7. Completar revision basica y generar link/token de cliente.
8. Abrir el portal cliente desde una ventana anonima o navegador separado.
9. Confirmar que el portal no muestra informacion interna del taller.
10. Revisar logs: `docker logs --tail 100 mecanic-ok`.
11. Si algun paso falla, no entregar el link a usuarios piloto.

## Backup

Frecuencia minima para piloto: backup diario y backup manual antes de cada deploy.

Backup manual del volumen Docker:

```bash
docker run --rm \
  -v mecanic-ok-data:/data:ro \
  -v "$PWD/backups:/backup" \
  alpine \
  tar -czf /backup/mecanic-ok-data-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

Verificacion minima del backup:

```bash
ls -lh backups
tar -tzf backups/mecanic-ok-data-YYYYMMDD-HHMMSS.tar.gz | head
```

Restauracion en VPS nuevo o volumen vacio:

```bash
docker volume create mecanic-ok-data
docker run --rm \
  -v mecanic-ok-data:/data \
  -v "$PWD/backups:/backup" \
  alpine \
  tar -xzf /backup/mecanic-ok-data-YYYYMMDD-HHMMSS.tar.gz -C /data
```

## Rollback

Antes de actualizar:

```bash
docker ps --filter name=mecanic-ok
docker image ls mecanic-ok
docker tag mecanic-ok:pilot mecanic-ok:prev
```

Procedimiento recomendado:

1. Tomar backup manual de `/data`.
2. Etiquetar la imagen actual antes de reemplazarla, por ejemplo `mecanic-ok:prev`.
3. Desplegar la nueva imagen.
4. Ejecutar smoke completo.
5. Si falla, detener el contenedor nuevo y volver a iniciar `mecanic-ok:prev` usando el mismo volumen `/data`.

Comandos base:

```bash
docker stop mecanic-ok
docker rm mecanic-ok
docker run -d \
  --name mecanic-ok \
  --restart unless-stopped \
  -p 127.0.0.1:8787:8787 \
  -v mecanic-ok-data:/data \
  --env-file .env.production \
  mecanic-ok:prev
```

Regla de rollback: no borrar el volumen `mecanic-ok-data` para corregir un deploy.
Si hay duda sobre corrupcion de datos, detener la app y restaurar desde backup verificado.

## Revisiones antes de abrir piloto

DevOps:
- Proxy HTTPS activo y healthcheck accesible por dominio.
- Reinicio automatico configurado.
- Logs revisados despues del smoke.

QA:
- Smoke completo aprobado contra el dominio final.
- Se registro version/imagen desplegada y fecha.
- Se valido portal cliente en sesion separada.

Seguridad:
- No hay secretos reales en repo.
- `CORS_ORIGIN` no usa wildcard.
- `GEMINI_API_KEY` esta solo como variable de entorno del servidor.

Operaciones:
- Backup manual creado y listado.
- Responsable de restauracion definido antes de entregar el piloto.
- Criterio de rollback acordado: cualquier falla en login, ordenes, uploads o portal cliente.
