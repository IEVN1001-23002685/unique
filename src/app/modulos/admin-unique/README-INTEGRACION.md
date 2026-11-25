# UNIQUE — paquete Angular M18–M22

Este paquete vive en `src/app/modulos/admin-unique/`. Conserva las pantallas y estilos propios y usa la infraestructura canónica de la aplicación (`ApiService`, `AuthSessionService`, contratos `{ codigo, mensaje, detalle }` y paginación `items/total/pagina/por_pagina`).

## Contenido

- M18 Preparación: `GET /preparacion/cola`, `POST /preparacion/{pedido_id}/tomar`, `PATCH /preparacion/{id}/lineas`, incidencia, empaque y etiqueta PDF.
- M19 Entregas: `GET /entregas/por-asignar`, `POST /entregas`, salida, resultado, hoja de reparto PDF, productos repartidos y CRUD de `/repartidores`.
- M20 Dashboard: `resumen`, `ventas`, `produccion`, `abastecimiento`, `logistica` y `exportar` CSV; filtros `desde`/`hasta`.
- M21 Alertas: bandeja paginada, resueltas, acciones explícitas y reglas numéricas.
- M22 Administración: `/usuarios`, `/clientes`, seis catálogos, `/configuracion` y `/bitacora`.
- Servicios por módulo en `services/`; toda petición HTTP pasa por `ApiAdminService`.
- Rutas propias `ADMIN_UNIQUE_ROUTES` con guards locales que redirigen a `/login-admin` y `/sin-acceso-admin`.

## Integración mínima

En `app.routes.ts` se agrega el import y se inserta `...ADMIN_UNIQUE_ROUTES` sin reemplazar las rutas existentes:

```ts
import { ADMIN_UNIQUE_ROUTES } from './modulos/admin-unique/admin.routes';
```

Las URL del paquete son `/login-admin` y `/panel-admin/...`. La sesión se mantiene en memoria con cookie `httpOnly`; no se usa `localStorage` ni `sessionStorage`.

## Notas del contrato

- Base URL configurada en `src/environments/environment.ts` (`/api/v1`).
- Los componentes solo presentan datos y validan interacción; reglas y escrituras las ejecuta el backend.
- ADMIN hereda permisos de OPERATIVO. El catálogo de repartidores es ADMIN-only: los Operativos indican el ID del repartidor en los formularios.
- El backend no expone un listado general de entregas; la pestaña “Seguimiento” muestra las entregas asignadas durante la sesión.
- Los guards de Angular son controles de navegación y no sustituyen la autorización del servidor.
