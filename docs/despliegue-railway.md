# Despliegue del frontend UNIQUE en Railway

Este documento describe el servicio **frontend** del proyecto. Debe convivir en el mismo
proyecto de Railway con el servicio **API** (`unique_api`) y el servicio **MySQL**. El frontend
no contiene secretos ni dominios fijos de producción: la URL de la API se entrega en tiempo de
ejecución.

## 1. Servicio en Railway

| Concepto | Valor |
|---|---|
| Repositorio | `unique` (independiente; rama de trabajo actual sin cambios de rama) |
| Build | Dockerfile del repositorio |
| Start | Automático desde el Dockerfile (Nginx) |
| Puerto | Railway inyecta `PORT`; Nginx escucha en ese puerto |
| Healthcheck Path | `/health` |
| Dominio público | El que asigne Railway; reemplazar `https://<dominio-real-del-frontend>` en este documento |
| Volumen | No requerido; el build es estático |

Variables de entorno del servicio frontend:

| Variable | Valor de producción | Obligatoria | Uso |
|---|---|---|---|
| `PORT` | Lo asigna Railway | Sí | `listen` de Nginx; no fijar manualmente |
| `API_BASE_URL` | `https://<dominio-real-de-la-api>/api/v1` | Sí | Se escribe en `/runtime-config.json` y se usa para CSP/connect-src |

`API_BASE_URL` **debe terminar exactamente en `/api/v1`** y ser HTTPS. El contenedor se detiene
con un error explícito si falta, no es HTTPS o no termina en ese sufijo. Para pruebas locales se
acepta `http://localhost:8001/api/v1` o `http://127.0.0.1:8001/api/v1`.

En desarrollo (`ng serve`) no se usa `API_BASE_URL`: `src/environments/environment.ts` conserva
`http://localhost:8001/api/v1`.

## 2. Qué hace el contenedor

1. Etapa de build con `node:24.15.0-alpine` y `npm@12.2.2` (coincidente con `packageManager`),
   `npm ci --include=dev` y `npm run build`. Angular 22 no es compatible con la imagen anterior
   `node:22-alpine`.
2. Imagen final solo con Nginx; no incluye Node ni dependencias de build.
3. Antes de arrancar Nginx, `docker-entrypoint.d/30-unique-config.sh`:
   - valida `PORT` y `API_BASE_URL`;
   - genera `/usr/share/nginx/html/runtime-config.json` sin caché;
   - renderiza `nginx.conf.template` con `PORT` y el origen derivado de `API_BASE_URL`;
   - renderiza la CSP con `img-src`/`connect-src` apuntando al origen real de la API.
4. `ApiConfigService` carga `/runtime-config.json` con `cache: 'no-store'` mediante
   `provideAppInitializer`, antes de hidratar la sesión. Si falla, la app muestra un banner de
   configuración en lugar de intentar peticiones con una base vacía.

## 3. Comportamiento HTTP

| Ruta | Respuesta |
|---|---|
| `GET /health` | `200 {"estado":"ok","servicio":"frontend"}`, sin depender de la API |
| `GET /runtime-config.json` | `200` con `{"apiBaseUrl":"..."}` y `Cache-Control: no-store` |
| `GET /assets/*` y bundles con hash | `200`, `Cache-Control: public, max-age=31536000, immutable` |
| Cualquier ruta Angular (`/catalogo`, `/micuenta`, ...) | `/index.html` mediante `try_files` |
| Archivo inexistente bajo `/assets` | `404`, sin caer en `index.html` |
| Recursos `/uploads/...` devueltos por Flask | El pipe `urlImagen` los resuelve contra el origen de `API_BASE_URL`; no se tocan `/prendas/...`, `blob:` ni `data:` |

Cabeceras añadidas: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy` y `Content-Security-Policy`. La CSP del frontend no usa `unsafe-eval` ni
orígenes comodín; el único origen externo permitido es el de la API más fuentes de fuentes
explícitas.

## 4. Primer deploy

1. Crear el servicio frontend desde este repositorio en el mismo proyecto Railway que la API y
   MySQL.
2. Definir `API_BASE_URL=https://<dominio-real-de-la-api>/api/v1`.
3. En la API, definir `CORS_ORIGINS=https://<dominio-real-del-frontend>` antes de probar el
   login. Si el frontend y la API están en sitios distintos, la API usa
   `JWT_COOKIE_SAMESITE=None`, `JWT_COOKIE_SECURE=true` y `JWT_COOKIE_CSRF_PROTECT=true`.
4. Desplegar. No hay comando Pre-Deploy ni migraciones en el frontend.
5. Verificar:

```bash
curl -i https://<dominio-real-del-frontend>/health
curl -i https://<dominio-real-del-frontend>/runtime-config.json
curl -i -o /dev/null -w '%{http_code}\n' https://<dominio-real-del-frontend>/catalogo
```

6. Abrir el frontend en el navegador y comprobar inicio de sesión real, catálogo y una imagen
   servida desde `/uploads/...` de la API. No debe aparecer el banner «UNIQUE no está
   configurado».

## 5. Deploys posteriores

- Cambiar `API_BASE_URL` requiere reiniciar el contenedor (o redeploy) para regenerar
  `/runtime-config.json` y la CSP.
- Un cambio de dominio de la API exige actualizar también `CORS_ORIGINS` en la API; si no, el
  navegador bloqueará las peticiones con credenciales.
- El build usa `npm ci`; no se edita `package-lock.json` a mano. Si cambia `packageManager`,
  debe actualizar también la versión global de npm instalada en el Dockerfile.
- No se necesita `NODE_ENV` ni variables de build adicionales.

## 6. Verificación local del contenedor

```bash
docker build -t unique-frontend:local .
docker run --rm -e PORT=4180 \
  -e API_BASE_URL=http://localhost:8001/api/v1 \
  -p 4180:4180 unique-frontend:local

curl -i http://127.0.0.1:4180/health
curl -i http://127.0.0.1:4180/runtime-config.json
curl -i -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4180/catalogo
```

## 7. Troubleshooting

| Síntoma | Causa probable | Acción |
|---|---|---|
| El contenedor no arranca y dice «API_BASE_URL debe terminar en /api/v1» | Variable incompleta | Corregir el valor y reiniciar |
| Banner «UNIQUE no está configurado» | `/runtime-config.json` ausente o inválido | Revisar logs de arranque y la variable `API_BASE_URL` |
| `401`/sin sesión después del login | `CORS_ORIGINS` o cookies `SameSite=None`/`Secure` mal configurados en la API | Corregir variables de la API |
| Imágenes `/uploads/...` no cargan | CSP sin el origen de la API o volumen de la API sin imágenes | Reiniciar frontend y revisar el volumen de la API |
| Rutas internas devuelven 404 | Nginx no usa el `try_files` actualizado | Verificar que el build usó el `nginx.conf.template` del repositorio |
| `/health` o `/runtime-config.json` devuelven `index.html` (`text/html`, mismo ETag que `/`) | El servicio está usando la configuración por defecto de Nginx, no el `Dockerfile` del repositorio | Configurar el builder de Railway como `Dockerfile`, forzar build sin caché y redeploy |
| Los logs no muestran `Launching /docker-entrypoint.d/30-unique-config.sh` | Falta el script de configuración en runtime en la imagen desplegada | Verificar que Railway construye desde el `Dockerfile` y no desde un builder automático estático |
| Las respuestas no incluyen `X-Content-Type-Options`, `X-Frame-Options` ni CSP | No se aplicó `nginx-seguridad.conf.template` | Reconstruir usando el `Dockerfile` actual |

No se han publicado dominios definitivos ni secretos en este documento; sustituir los marcadores
por los valores reales del proyecto Railway.
