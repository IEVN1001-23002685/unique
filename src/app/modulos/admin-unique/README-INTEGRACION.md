# UNIQUE — paquete Angular independiente M18–M22

Este paquete se agrega como una carpeta nueva `src/app/admin-unique/`. No reemplaza ni modifica `app.ts`, `app.routes.ts`, servicios existentes ni componentes de otros integrantes.

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
import { ADMIN_UNIQUE_ROUTES } from './admin-unique/admin.routes';
```

Y agrega `...ADMIN_UNIQUE_ROUTES` dentro del arreglo `routes`, sin borrar ni reemplazar las rutas actuales. Las URL del paquete serán `/login-admin` y `/panel-admin/...`.

Si el equipo no autoriza editar `app.routes.ts`, el paquete queda aislado y no será navegable desde la aplicación hasta que se agregue esa única conexión.

## Backend pendiente
La API Flask debe implementar los endpoints usados por `ApiAdminService` y protegerlos también por token y rol. Los guards de Angular son controles de navegación, no sustituyen la autorización del servidor.

Base URL actual: `http://127.0.0.1:5000/api`.

## Nota de compilación del proyecto recibido
El ZIP original contiene errores fuera de este paquete en `src/app/app.ts` (sintaxis, dos clases `App`, importaciones a módulos inexistentes y `signal` sin importar). No se modificó ese archivo para respetar el trabajo del equipo. Por eso este paquete no puede hacer que el proyecto completo compile mientras esos errores preexistentes sigan ahí.
