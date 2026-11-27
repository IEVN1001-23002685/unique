#!/bin/sh
# Genera la configuración de ejecución del frontend antes de que Nginx atienda peticiones.
set -eu

PORT="${PORT:-80}"
API_BASE_URL="${API_BASE_URL:-}"

case "$PORT" in
  ''|*[!0-9]*) echo "PORT debe ser un número de puerto válido" >&2; exit 1 ;;
esac

case "$API_BASE_URL" in
  *'"'*|*'\'*|*'<'*|*'>'*)
    echo "API_BASE_URL contiene caracteres no permitidos" >&2
    exit 1
    ;;
esac

case "$API_BASE_URL" in
  https://*|http://localhost/*|http://localhost:*/*|http://127.0.0.1/*|http://127.0.0.1:*/*) ;;
  *) echo "API_BASE_URL debe ser HTTPS (o HTTP de localhost para pruebas)" >&2; exit 1 ;;
esac

case "$API_BASE_URL" in
  */api/v1) ;;
  *) echo "API_BASE_URL debe terminar en /api/v1" >&2; exit 1 ;;
esac

API_ORIGIN=$(printf '%s' "$API_BASE_URL" | sed -E 's#^(https?://[^/]+).*#\1#')
export PORT API_BASE_URL API_ORIGIN

printf '{"apiBaseUrl":"%s"}\n' "$API_BASE_URL" > /usr/share/nginx/html/runtime-config.json
envsubst '${PORT} ${API_ORIGIN} ${API_BASE_URL}' \
  < /etc/nginx/unique.conf.template > /etc/nginx/conf.d/default.conf
envsubst '${API_ORIGIN}' \
  < /etc/nginx/snippets/seguridad.conf.template > /etc/nginx/snippets/seguridad.conf
