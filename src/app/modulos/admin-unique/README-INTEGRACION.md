# UNIQUE — paquete Angular independiente M18–M22

Este paquete vive en `src/app/modulos/admin-unique/`. No reemplaza ni modifica `app.ts`, servicios existentes ni componentes de otros integrantes.

## Contenido

- M18 Preparación
- M19 Entregas (incluye repartidores y código postal)
- M20 Dashboard gerencial
- M21 Centro de alertas
- M22 Administración del sistema
- Servicios HTTP y sesión propios del paquete
- Rutas `ADMIN_UNIQUE_ROUTES`

## Integración mínima (cuando el equipo autorice tocar el archivo compartido de rutas)

En el `app.routes.ts` existente, agrega el import:

```ts
import { ADMIN_UNIQUE_ROUTES } from './modulos/admin-unique/admin.routes';
```

Y agrega `...ADMIN_UNIQUE_ROUTES` dentro del arreglo `routes`, sin borrar ni reemplazar las rutas actuales. Las URL del paquete serán `/login-admin` y `/panel-admin/...`.

Si el equipo no autoriza editar `app.routes.ts`, el paquete queda aislado y no será navegable desde la aplicación hasta que se agregue esa única conexión.

## Backend pendiente

La API Flask debe implementar los endpoints usados por `ApiAdminService` y protegerlos también por token y rol. Los guards de Angular son controles de navegación, no sustituyen la autorización del servidor.

Base URL actual: `http://127.0.0.1:5000/api`.

## Estado actual

`app.ts` ya fue corregido por el equipo y no presenta esos errores. El paquete se compila con el resto de la aplicación, pero sus rutas siguen sin registrarse en `app.routes.ts` para no introducir autenticación JWT ni llamadas a un backend que todavía no existe. Solo debe enlazarse cuando Flask esté disponible y se autorice simultáneamente `provideHttpClient()` y `withInterceptors([authInterceptor])` en `app.config.ts`.
