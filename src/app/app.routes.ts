import { Routes } from '@angular/router';
import { Tienda } from './plantillas/tienda/tienda';
import { Administracion } from './plantillas/administracion/administracion';
import { authGuard, roleGuard } from './core/auth/auth-session.service';
import { ADMIN_UNIQUE_ROUTES } from './modulos/admin-unique/admin.routes';

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
        path: 'carrito',
        canActivate: CLIENTE,
        data: { roles: ['CLIENTE'] },
        loadComponent: () => import('./modulos/carrito/carrito').then((c) => c.Carrito),
      },
      {
        path: 'pago',
        canActivate: CLIENTE,
        data: { roles: ['CLIENTE'] },
        loadComponent: () => import('./modulos/pago/pago').then((c) => c.Pago),
      },
      {
        path: 'cuenta',
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
        loadComponent: () =>
          import('./modulos/acceso-registro/paginas/inicio-sesion/inicio-sesion').then(
            (c) => c.InicioSesion,
          ),
      },
      {
        path: 'registro',
        loadComponent: () =>
          import('./modulos/acceso-registro/paginas/registro/registro').then((c) => c.Registro),
      },
      {
        path: 'recuperar',
        loadComponent: () =>
          import('./modulos/acceso-registro/paginas/recuperar-password/recuperar-password').then(
            (c) => c.RecuperarPassword,
          ),
      },
      {
        path: 'restablecer/:token',
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
    component: Administracion,
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
    component: Administracion,
    canActivate: OPERATIVO,
    data: { titulo: 'Pedidos', roles: ['ADMIN', 'OPERATIVO'] },
    loadChildren: () => import('./modulos/pedidos/pedidos.routes').then((m) => m.PEDIDOS_RUTAS),
  },
  {
    path: 'admin/productos',
    component: Administracion,
    canActivate: ADMINISTRADOR,
    data: { titulo: 'Productos', roles: ['ADMIN'] },
    loadChildren: () =>
      import('./modulos/productos/productos.routes').then((m) => m.PRODUCTOS_RUTAS),
  },
  { path: 'productos', redirectTo: 'admin/productos' },
  {
    path: 'admin/recetas',
    component: Administracion,
    canActivate: ADMINISTRADOR,
    data: { titulo: 'Recetas', roles: ['ADMIN'] },
    loadChildren: () => import('./modulos/recetas/recetas.routes').then((m) => m.RECETAS_RUTAS),
  },
  { path: 'recetas', redirectTo: 'admin/recetas' },
  {
    path: 'operacion/inventario-pt',
    component: Administracion,
    canActivate: OPERATIVO,
    data: { titulo: 'Inventario PT', roles: ['ADMIN', 'OPERATIVO'] },
    loadChildren: () =>
      import('./modulos/inventario-producto-terminado/inventario-producto-terminado.routes').then(
        (m) => m.INVENTARIO_PT_RUTAS,
      ),
  },
  { path: 'inventario-pt', redirectTo: 'operacion/inventario-pt' },
  { path: 'preparacion', redirectTo: 'panel-admin/preparacion' },
  { path: 'entregas', redirectTo: 'panel-admin/entregas' },
  { path: 'dashboard', redirectTo: 'panel-admin/dashboard' },
  { path: 'alertas', redirectTo: 'panel-admin/alertas' },
  { path: 'sistema', redirectTo: 'panel-admin/sistema' },
  {
    path: 'proveedores',
    component: Administracion,
    canActivate: ADMINISTRADOR,
    data: { titulo: 'Proveedores', roles: ['ADMIN'] },
    loadChildren: () =>
      import('./modulos/proveedores/proveedores.routes').then((m) => m.PROVEEDORES_RUTAS),
  },
  { path: 'admin/ventas', redirectTo: 'ventas' },
  {
    path: 'ventas',
    component: Administracion,
    canActivate: ADMINISTRADOR,
    data: { titulo: 'Ventas', roles: ['ADMIN'] },
    loadChildren: () => import('./modulos/ventas/ventas.routes').then((m) => m.VENTAS_RUTAS),
  },
  {
    path: 'compras',
    component: Administracion,
    canActivate: ADMINISTRADOR,
    data: { titulo: 'Compras', roles: ['ADMIN'] },
    loadChildren: () => import('./modulos/compras/compras.routes').then((m) => m.COMPRAS_RUTAS),
  },
  {
    path: 'recepciones',
    component: Administracion,
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
    component: Administracion,
    canActivate: OPERATIVO,
    data: { titulo: 'Inventario MP', roles: ['ADMIN', 'OPERATIVO'] },
    loadChildren: () => import('./modulos/inventario/inventario.routes').then((m) => m.INVENTARIO_RUTAS),
  },
  {
    path: 'produccion',
    component: Administracion,
    canActivate: OPERATIVO,
    data: { titulo: 'Producción', roles: ['ADMIN', 'OPERATIVO'] },
    loadChildren: () =>
      import('./modulos/produccion/produccion.routes').then((m) => m.PRODUCCION_RUTAS),
  },
  {
    path: 'mermas',
    component: Administracion,
    canActivate: OPERATIVO,
    data: { titulo: 'Mermas', roles: ['ADMIN', 'OPERATIVO'] },
    loadChildren: () => import('./modulos/mermas/mermas.routes').then((m) => m.MERMAS_RUTAS),
  },
  {
    path: 'operacion/devoluciones',
    component: Administracion,
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
