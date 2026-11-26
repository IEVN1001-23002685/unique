# Despliegue de preproducción: compila Angular y sirve la SPA con nginx.

FROM node:22-alpine AS build
WORKDIR /app

# Railway define NODE_ENV=production; --include=dev evita omitir @angular/cli.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# @angular/build:application genera dist/<proyecto>/browser, no /app/browser.
COPY --from=build /app/dist/unique/browser /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Railway inyecta PORT en tiempo de ejecución; 80 es el valor local por defecto.
ENV PORT=80
EXPOSE 80
