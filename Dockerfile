# Imagen reproducible: Angular 22 exige Node ^22.22.3, ^24.15.0 o >=26 y packageManager npm@12.2.2.
FROM node:24.15.0-alpine AS build
WORKDIR /app

# Iguala el npm declarado en package.json antes de instalar.
RUN npm install --global npm@12.2.2

# Railway define NODE_ENV=production; --include=dev evita omitir @angular/cli.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# @angular/build:application genera dist/<proyecto>/browser, no /app/browser.
COPY --from=build /app/dist/unique/browser /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/unique.conf.template
COPY nginx-seguridad.conf.template /etc/nginx/snippets/seguridad.conf.template
COPY docker-entrypoint-unique.sh /docker-entrypoint.d/30-unique-config.sh
RUN chmod +x /docker-entrypoint.d/30-unique-config.sh

# Railway inyecta PORT en tiempo de ejecución; 80 es el valor local por defecto.
ENV PORT=80
EXPOSE 80
