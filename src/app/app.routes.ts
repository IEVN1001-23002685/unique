import { Routes } from '@angular/router';
import { Tienda } from './plantillas/tienda/tienda';
import { Administracion } from './plantillas/administracion/administracion';

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
     
    ],
  },
  {
    path: 'panel',
    component: Administracion,
    // Contrato de acceso para futuros authGuard/roleGuard; sin bloqueos ficticios.
    data: { titulo: 'Panel', rol: 'Administrador', roles: ['Administrador', 'Operativo'] },
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
    // M09 se monta bajo /admin para no colisionar con /pedidos de M06 (cliente).
    path: 'admin/pedidos',
    component: Administracion,
    // Operativo consulta; Administrador además edita. Sin guards reales todavía.
    data: { titulo: 'Pedidos', rol: 'Administrador', roles: ['Administrador', 'Operativo'] },
    loadChildren: () => import('./modulos/pedidos/pedidos.routes').then((m) => m.PEDIDOS_RUTAS),
  },
  {
    // M10 es exclusivo del Administrador. Se mantiene /productos como alias del §10.
    path: 'admin/productos',
    component: Administracion,
    data: { titulo: 'Productos', rol: 'Administrador', roles: ['Administrador'] },
    loadChildren: () =>
      import('./modulos/productos/productos.routes').then((m) => m.PRODUCTOS_RUTAS),
  },
  {
    path: 'productos',
    redirectTo: 'admin/productos',
  },
  {
    // M11 es exclusivo del Administrador: dueño de recetas, versiones, hilos y costos.
    path: 'admin/recetas',
    component: Administracion,
    data: { titulo: 'Recetas', rol: 'Administrador', roles: ['Administrador'] },
    loadChildren: () => import('./modulos/recetas/recetas.routes').then((m) => m.RECETAS_RUTAS),
  },
  {
    path: 'recetas',
    redirectTo: 'admin/recetas',
  },
  {
    // M12 se monta bajo /operacion para no mezclarlo con catálogos de Administrador.
    // Operativo edita inventario; Administrador edita solo reglas (sin guards reales aún).
    path: 'operacion/inventario-pt',
    component: Administracion,
    data: { titulo: 'Inventario PT', rol: 'Operativo', roles: ['Administrador', 'Operativo'] },
    loadChildren: () =>
      import('./modulos/inventario-producto-terminado/inventario-producto-terminado.routes').then(
        (m) => m.INVENTARIO_PT_RUTAS,
      ),
  },
  {
    path: 'inventario-pt',
    redirectTo: 'operacion/inventario-pt',
  },
  {
    path: 'proveedores',
    component: Administracion,
    data: { titulo: 'Proveedores', rol: 'Administrador', roles: ['Administrador'] },
    loadChildren: () =>
      import('./modulos/proveedores/proveedores.routes').then((m) => m.PROVEEDORES_RUTAS),
  },
  {
    // Convención del repositorio: /ventas. Se conserva además la ruta del §10 del documento.
    path: 'admin/ventas',
    redirectTo: 'ventas',
  },
  {
    path: 'ventas',
    component: Administracion,
    // Contrato de acceso para futuros authGuard/roleGuard; sin bloqueos ficticios.
    data: { titulo: 'Ventas', rol: 'Administrador', roles: ['Administrador'] },
    loadChildren: () => import('./modulos/ventas/ventas.routes').then((m) => m.VENTAS_RUTAS),
  },
  { path: '**', redirectTo: 'catalogo' },
];
