# UNIQUE — paquete canónico Angular M18–M22

Este paquete en `src/app/modulos/admin-unique/` es la **única implementación activa** de M18–M22. Conserva las pantallas y estilos del panel actual y usa la infraestructura canónica (`ApiService`, `AuthSessionService`, contrato de errores `{ codigo, mensaje, detalle }` y respuestas `items/total/pagina/por_pagina`).

## Contenido

- M18 Preparación: cola, hoja de preparación y pestaña de incidencias derivada de las líneas devueltas por la API.
- M19 Entregas: por asignar, hoja de reparto, seguimiento de la sesión, productos repartidos y repartidores.
- M20 Dashboard: resumen, ventas, producción, abastecimiento, logística y exportación CSV.
- M21 Alertas: bandeja, resueltas, acciones y reglas numéricas.
- M22 Administración: usuarios, clientes, catálogos, configuración y bitácora.
- Toda petición HTTP pasa por `ApiAdminService`, que delega en `ApiService`.

## Shell y rutas canónicas

`PanelAdminComponent` es el único layout del panel: sustituye al antiguo componente `Administracion` también para los módulos M01–M17. Su menú incluye los enlaces autorizados por rol y el selector visual de perfil; los guards y Flask siguen siendo la autoridad real.

Las rutas del panel son `/panel-admin/{dashboard|preparacion|entregas|alertas|sistema}`. Cada módulo admite una subruta por sección:

| Módulo | Subrutas |
|---|---|
| M18 | `preparacion`, `preparacion/incidencias` |
| M19 | `entregas/por-asignar`, `hoja-reparto`, `seguimiento`, `productos-repartidos`, `repartidores` |
| M20 | `dashboard/resumen`, `ventas-productos`, `produccion-merma`, `abastecimiento`, `logistica-devoluciones` |
| M21 | `alertas/bandeja`, `resueltas`, `reglas` |
| M22 | `sistema/usuarios`, `clientes`, `catalogos`, `configuracion`, `bitacora` |

`app.routes.ts` conserva alias como `/preparacion/incidencias`, `/entregas/seguimiento`, `/dashboard/resumen`, `/alertas/bandeja` y `/sistema/usuarios`, redirigiéndolos al panel canónico. Ya no existen rutas huérfanas que caigan en `/no-encontrado`.

## Contrato verificado contra Flask

Se contrastaron las rutas y esquemas del repositorio `unique_api` (`main`) con los servicios de este paquete:

- Métodos y rutas: coinciden con los blueprints `preparacion`, `entregas`, `dashboard`, `alertas` y `admin`.
- Roles: ADMIN hereda OPERATIVO en `roles_requeridos`; `/repartidores`, `/alertas/reglas`, `/dashboard/resumen`, `/dashboard/ventas`, `/dashboard/exportar` y todo M22 son ADMIN-only. La interfaz refleja esa herencia y esas restricciones.
- **Filtros estrictos:** `/preparacion/cola`, `/entregas/por-asignar`, `/entregas/productos-repartidos`, `/repartidores`, `/alertas`, `/alertas/resueltas` y `/dashboard/*` cargan `request.args` directamente en un esquema Marshmallow, que rechaza campos no declarados. Por eso los servicios NO envían `pagina`/`por_pagina` a esos endpoints; la API responde con su paginación por defecto.
- `/catalogos/{recurso}` y `/bitacora` eliminan `pagina`/`por_pagina` antes de validar, pero el frontend tampoco los envía para depender solo del filtro declarado. Usuarios y clientes sí aceptan paginación porque esos endpoints la leen directamente.
- `/dashboard/resumen`, `/dashboard/ventas` y `/dashboard/exportar` son ADMIN-only; la UI oculta esas pestañas/acciones al perfil OPERATIVO. Los filtros de M20 envían solo `desde`/`hasta`; categoría, producto, color, talla y canal se aplican localmente al detalle de SKU/canal devuelto por `/dashboard/ventas`, sin inventar parámetros de API.
- M21 muestra cuatro pestañas de severidad con contador sobre la página devuelta por `/alertas`; tipo y severidad se filtran en cliente porque el esquema de Flask solo declara `estado`, `tipo` y `severidad`, sin paginación. Las alertas de catálogo con botón «Ver…» navegan al módulo de origen; solo `PT_AGOTADO_DEMANDA`, `PT_STOCK_MINIMO`, `MP_INSUFICIENTE` y `MP_REORDEN` ejecutan una acción de servicio. La ruta `/panel-admin/alertas/reglas` exige ADMIN, igual que el endpoint.
- M22 da de alta solo Operativo o Administrador (los clientes se registran solos). No se simula el restablecimiento de contraseña: el contrato verificado no expone ese endpoint y la interfaz lo indica. El código de color/talla usado en SKU se bloquea al editar; la baja del último ADMIN se impide en cliente cuando se cargó el directorio completo y Flask lo valida. Los parámetros marcados como propuesta en §11.5 se agrupan y etiquetan, sin cambiar sus valores. Catálogos y bitácora avisan cuando Flask entrega más registros que los mostrados, porque esos endpoints no aceptan paginación desde el frontend.
- `/entregas` no expone listado general; “Seguimiento” muestra las entregas asignadas durante la sesión.
- Las incidencias no tienen endpoint propio; la pestaña M18 deriva la información del campo `lineas[].incidencia`.

## Sesión y seguridad

La sesión se mantiene en memoria con cookie `httpOnly`; no se usa `localStorage` ni `sessionStorage`. Los guards de Angular son controles de navegación y no sustituyen la autorización definitiva de Flask.

## Duplicidad eliminada

Las copias antiguas en `modulos/preparacion`, `modulos/entregas`, `modulos/dashboard-gerencial`, `modulos/centro-alertas` y `modulos/administracion-sistema` no deben conservarse: usaban datos simulados y sus rutas nunca se montaron.
