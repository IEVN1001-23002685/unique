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
      {
        // M04 · Carrito de la tienda (solo demostración local, sin persistencia).
        path: 'carrito',
        loadComponent: () => import('./modulos/carrito/carrito').then((c) => c.Carrito),
      },
      {
        // M05 · Pago simulado; no se envía nada a una pasarela real.
        path: 'pago',
        loadComponent: () => import('./modulos/pago/pago').then((c) => c.Pago),
      },
      {
        // M02 · Mi cuenta del Cliente.
        path: 'cuenta',
        loadComponent: () => import('./modulos/micuenta/micuenta').then((c) => c.Micuenta),
      },
      {
        // M06 · Mis pedidos y seguimiento del Cliente.
        path: 'pedidos',
        loadComponent: () => import('./modulos/mispedidos/mispedidos').then((c) => c.MisPedidos),
      },
      {
        // M07 · Cambios y devoluciones del Cliente.
        path: 'devoluciones',
        loadComponent: () =>
          import('./modulos/cambios-devoluciones/cambios-devoluciones').then(
            (c) => c.CambiosDevoluciones,
          ),
      },
      {
        // M01 · Acceso (la fuente de verdad de roles será Flask).
        path: 'login',
        loadComponent: () =>
          import('./modulos/inicio-sesion/inicio-sesion').then((c) => c.InicioSesion),
      },
      {
        path: 'registro',
        loadComponent: () => import('./modulos/registro/registro').then((c) => c.Registro),
      },
      {
        path: 'recuperar',
        loadComponent: () =>
          import('./modulos/recuperar-password/recuperar-password').then(
            (c) => c.RecuperarPassword,
          ),
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
    // M18 se monta en /preparación según el mapa del §10. Operativo opera y Administrador también.
    path: 'preparacion',
    component: Administracion,
    data: { titulo: 'Preparación', rol: 'Operativo', roles: ['Administrador', 'Operativo'] },
    loadChildren: () =>
      import('./modulos/preparacion/preparacion.routes').then((m) => m.PREPARACION_RUTAS),
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
  {
    // M14: /compras es de Administrador según §10; las recepciones se montan aparte.
    path: 'compras',
    component: Administracion,
    data: { titulo: 'Compras', rol: 'Administrador', roles: ['Administrador'] },
    loadChildren: () => import('./modulos/compras/compras.routes').then((m) => m.COMPRAS_RUTAS),
  },
  {
    // Recepciones: Operativo o Administrador (§10). Ruta propia del §10 del documento.
    path: 'recepciones',
    component: Administracion,
    data: {
      titulo: 'Recepciones',
      rol: 'Operativo',
      roles: ['Administrador', 'Operativo'],
    },
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
    // M15: /inventario-mp según §10. Operativo consulta y ajusta; Administrador
    // además administra catálogo y políticas. Sin guards reales todavía.
    path: 'inventario-mp',
    component: Administracion,
    data: { titulo: 'Inventario MP', rol: 'Operativo', roles: ['Administrador', 'Operativo'] },
    loadChildren: () =>
      import('./modulos/inventario/inventario.routes').then((m) => m.INVENTARIO_RUTAS),
  },
  {
    // M16: /producción según §10 se normaliza a /produccion. Rol Operativo;
    // el Administrador también crea y supervisa. Sin guards reales todavía.
    path: 'produccion',
    component: Administracion,
    data: { titulo: 'Producción', rol: 'Operativo', roles: ['Administrador', 'Operativo'] },
    loadChildren: () =>
      import('./modulos/produccion/produccion.routes').then((m) => m.PRODUCCION_RUTAS),
  },
  {
    // M17: /mermas según §10. Operativo registra y consulta; el Administrador
    // además analiza costos y ejecuta reversas. Sin guards reales todavía.
    path: 'mermas',
    component: Administracion,
    data: { titulo: 'Mermas', rol: 'Operativo', roles: ['Administrador', 'Operativo'] },
    loadChildren: () => import('./modulos/mermas/mermas.routes').then((m) => m.MERMAS_RUTAS),
  },
  { path: '**', redirectTo: 'catalogo' },
];
