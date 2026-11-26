import { Routes } from '@angular/router';
import { Tienda } from './plantillas/tienda/tienda';
import { invitadoGuard } from './modulos/acceso-registro/guards/invitado.guard';
import { PanelAdminComponent } from './modulos/admin-unique/preparacion/panel-admin.component';
import { authGuard, roleGuard } from './core/auth/auth-session.service';
import { ADMIN_UNIQUE_ROUTES } from './modulos/admin-unique/admin.routes';
import { checkoutGuard } from './modulos/carrito/guards/checkout.guard';

const CLIENTE = [authGuard, roleGuard];
const OPERATIVO = [authGuard, roleGuard];
const ADMINISTRADOR = [authGuard, roleGuard];

export const routes: Routes = [
  {
    path: '',
    component: Tienda,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'catalogo' },
      {
        path: 'catalogo',
        loadChildren: () =>
          import('./modulos/catalogo/catalogo.routes').then((m) => m.CATALOGO_RUTAS),
      },
      {
        // §10.2: M04 es pública; la sesión se exige al ir a pagar.
        path: 'carrito',
        title: 'Mi carrito · UNIQUE',
        loadComponent: () => import('./modulos/carrito/carrito').then((c) => c.Carrito),
      },
      {
        path: 'pago',
        title: 'Pago · UNIQUE',
        canActivate: [authGuard, checkoutGuard],
        loadComponent: () => import('./modulos/pago/pago').then((c) => c.Pago),
      },
      {
        path: 'cuenta',
        title: 'Mi cuenta · UNIQUE',
        canActivate: CLIENTE,
        data: { roles: ['CLIENTE'] },
        loadComponent: () => import('./modulos/micuenta/micuenta').then((c) => c.Micuenta),
      },
      {
        path: 'pedidos',
        canActivate: CLIENTE,
        data: { roles: ['CLIENTE'] },
        loadComponent: () => import('./modulos/mispedidos/mispedidos').then((c) => c.MisPedidos),
      },
      {
        path: 'devoluciones',
        canActivate: CLIENTE,
        data: { roles: ['CLIENTE'] },
        loadComponent: () =>
          import('./modulos/cambios-devoluciones/cambios-devoluciones').then(
            (c) => c.CambiosDevoluciones,
          ),
      },
      {
        path: 'login',
        title: 'Iniciar sesión · UNIQUE',
        canActivate: [invitadoGuard],
        loadComponent: () =>
          import('./modulos/acceso-registro/paginas/inicio-sesion/inicio-sesion').then(
            (c) => c.InicioSesion,
          ),
      },
      {
        path: 'registro',
        title: 'Crear cuenta · UNIQUE',
        canActivate: [invitadoGuard],
        loadComponent: () =>
          import('./modulos/acceso-registro/paginas/registro/registro').then((c) => c.Registro),
      },
      {
        path: 'recuperar',
        title: 'Recuperar contraseña · UNIQUE',
        canActivate: [invitadoGuard],
        loadComponent: () =>
          import('./modulos/acceso-registro/paginas/recuperar-password/recuperar-password').then(
            (c) => c.RecuperarPassword,
          ),
      },
      {
        path: 'restablecer/:token',
        title: 'Restablecer contraseña · UNIQUE',
        canActivate: [invitadoGuard],
        loadComponent: () =>
          import(
            './modulos/acceso-registro/paginas/restablecer-password/restablecer-password'
          ).then((c) => c.RestablecerPassword),
      },
    ],
  },
  {
    path: 'producto/:id',
    redirectTo: 'catalogo/producto/:id',
  },
  {
    path: 'sin-acceso',
    loadComponent: () =>
      import('./compartido/paginas/sin-acceso/sin-acceso').then((c) => c.SinAcceso),
  },
  {
    path: 'no-encontrado',
    loadComponent: () =>
      import('./compartido/paginas/no-encontrado/no-encontrado').then((c) => c.NoEncontrado),
  },
  {
    path: 'panel',
    component: PanelAdminComponent,
    canActivate: OPERATIVO,
    data: { titulo: 'Panel', roles: ['ADMIN', 'OPERATIVO'] },
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./plantillas/administracion/paginas/inicio-panel/inicio-panel').then(
            (c) => c.InicioPanel,
          ),
      },
    ],
  },
  {
    path: 'admin/pedidos',
    component: PanelAdminComponent,
    canActivate: OPERATIVO,
    data: { titulo: 'Pedidos', roles: ['ADMIN', 'OPERATIVO'] },
    loadChildren: () => import('./modulos/pedidos/pedidos.routes').then((m) => m.PEDIDOS_RUTAS),
  },
  {
    path: 'admin/productos',
    component: PanelAdminComponent,
    canActivate: ADMINISTRADOR,
    data: { titulo: 'Productos', roles: ['ADMIN'] },
    loadChildren: () =>
      import('./modulos/productos/productos.routes').then((m) => m.PRODUCTOS_RUTAS),
  },
  { path: 'productos', redirectTo: 'admin/productos' },
  {
    path: 'admin/recetas',
    component: PanelAdminComponent,
    canActivate: ADMINISTRADOR,
    data: { titulo: 'Recetas', roles: ['ADMIN'] },
    loadChildren: () => import('./modulos/recetas/recetas.routes').then((m) => m.RECETAS_RUTAS),
  },
  { path: 'recetas', redirectTo: 'admin/recetas' },
  {
    path: 'operacion/inventario-pt',
    component: PanelAdminComponent,
    canActivate: OPERATIVO,
    data: { titulo: 'Inventario PT', roles: ['ADMIN', 'OPERATIVO'] },
    loadChildren: () =>
      import('./modulos/inventario-producto-terminado/inventario-producto-terminado.routes').then(
        (m) => m.INVENTARIO_PT_RUTAS,
      ),
  },
  { path: 'inventario-pt', redirectTo: 'operacion/inventario-pt' },
  // Alias históricos: dirigen al panel canónico sin reactivar copias duplicadas.
  { path: 'preparacion/incidencias', redirectTo: 'panel-admin/preparacion/incidencias' },
  { path: 'preparacion/:folio', redirectTo: 'panel-admin/preparacion' },
  { path: 'preparacion', pathMatch: 'full', redirectTo: 'panel-admin/preparacion' },
  { path: 'entregas/hoja-reparto', redirectTo: 'panel-admin/entregas/hoja-reparto' },
  { path: 'entregas/seguimiento', redirectTo: 'panel-admin/entregas/seguimiento' },
  { path: 'entregas/productos-repartidos', redirectTo: 'panel-admin/entregas/productos-repartidos' },
  { path: 'entregas/repartidores', redirectTo: 'panel-admin/entregas/repartidores' },
  { path: 'entregas/:seccion', redirectTo: 'panel-admin/entregas' },
  { path: 'entregas', pathMatch: 'full', redirectTo: 'panel-admin/entregas' },
  { path: 'dashboard/resumen', redirectTo: 'panel-admin/dashboard/resumen' },
  { path: 'dashboard/ventas-productos', redirectTo: 'panel-admin/dashboard/ventas-productos' },
  { path: 'dashboard/produccion-merma', redirectTo: 'panel-admin/dashboard/produccion-merma' },
  { path: 'dashboard/abastecimiento', redirectTo: 'panel-admin/dashboard/abastecimiento' },
  { path: 'dashboard/logistica-devoluciones', redirectTo: 'panel-admin/dashboard/logistica-devoluciones' },
  { path: 'dashboard/:seccion', redirectTo: 'panel-admin/dashboard' },
  { path: 'dashboard', pathMatch: 'full', redirectTo: 'panel-admin/dashboard' },
  { path: 'alertas/bandeja', redirectTo: 'panel-admin/alertas/bandeja' },
  { path: 'alertas/resueltas', redirectTo: 'panel-admin/alertas/resueltas' },
  { path: 'alertas/reglas', redirectTo: 'panel-admin/alertas/reglas' },
  { path: 'alertas/:seccion', redirectTo: 'panel-admin/alertas' },
  { path: 'alertas', pathMatch: 'full', redirectTo: 'panel-admin/alertas' },
  { path: 'sistema/usuarios', redirectTo: 'panel-admin/sistema/usuarios' },
  { path: 'sistema/clientes', redirectTo: 'panel-admin/sistema/clientes' },
  { path: 'sistema/catalogos', redirectTo: 'panel-admin/sistema/catalogos' },
  { path: 'sistema/configuracion', redirectTo: 'panel-admin/sistema/configuracion' },
  { path: 'sistema/bitacora', redirectTo: 'panel-admin/sistema/bitacora' },
  { path: 'sistema/:seccion', redirectTo: 'panel-admin/sistema' },
  { path: 'sistema', pathMatch: 'full', redirectTo: 'panel-admin/sistema' },
  {
    path: 'proveedores',
    component: PanelAdminComponent,
    canActivate: ADMINISTRADOR,
    data: { titulo: 'Proveedores', roles: ['ADMIN'] },
    loadChildren: () =>
      import('./modulos/proveedores/proveedores.routes').then((m) => m.PROVEEDORES_RUTAS),
  },
  { path: 'admin/ventas', redirectTo: 'ventas' },
  {
    path: 'ventas',
    component: PanelAdminComponent,
    canActivate: ADMINISTRADOR,
    data: { titulo: 'Ventas', roles: ['ADMIN'] },
    loadChildren: () => import('./modulos/ventas/ventas.routes').then((m) => m.VENTAS_RUTAS),
  },
  {
    path: 'compras',
    component: PanelAdminComponent,
    canActivate: ADMINISTRADOR,
    data: { titulo: 'Compras', roles: ['ADMIN'] },
    loadChildren: () => import('./modulos/compras/compras.routes').then((m) => m.COMPRAS_RUTAS),
  },
  {
    path: 'recepciones',
    component: PanelAdminComponent,
    canActivate: OPERATIVO,
    data: { titulo: 'Recepciones', roles: ['ADMIN', 'OPERATIVO'] },
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./modulos/compras/paginas/recepciones/recepciones').then((c) => c.Recepciones),
      },
    ],
  },
  {
    path: 'inventario-mp',
    component: PanelAdminComponent,
    canActivate: OPERATIVO,
    data: { titulo: 'Inventario MP', roles: ['ADMIN', 'OPERATIVO'] },
    loadChildren: () => import('./modulos/inventario/inventario.routes').then((m) => m.INVENTARIO_RUTAS),
  },
  {
    path: 'produccion',
    component: PanelAdminComponent,
    canActivate: OPERATIVO,
    data: { titulo: 'Producción', roles: ['ADMIN', 'OPERATIVO'] },
    loadChildren: () =>
      import('./modulos/produccion/produccion.routes').then((m) => m.PRODUCCION_RUTAS),
  },
  {
    path: 'mermas',
    component: PanelAdminComponent,
    canActivate: OPERATIVO,
    data: { titulo: 'Mermas', roles: ['ADMIN', 'OPERATIVO'] },
    loadChildren: () => import('./modulos/mermas/mermas.routes').then((m) => m.MERMAS_RUTAS),
  },
  {
    path: 'operacion/devoluciones',
    component: PanelAdminComponent,
    canActivate: OPERATIVO,
    data: { titulo: 'Devoluciones', roles: ['ADMIN', 'OPERATIVO'] },
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./modulos/cambios-devoluciones/cambios-devoluciones').then(
            (c) => c.CambiosDevoluciones,
          ),
      },
    ],
  },
  { path: 'admin/devoluciones', redirectTo: 'operacion/devoluciones' },
  ...ADMIN_UNIQUE_ROUTES,
  { path: '**', redirectTo: 'no-encontrado' },
];
