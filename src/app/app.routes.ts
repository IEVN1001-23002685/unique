import { Routes } from '@angular/router';
import { Tienda } from './plantillas/tienda/tienda';
import { Administracion } from './plantillas/administracion/administracion';
import { rolDemoGuard } from './nucleo/guards/rol-demo.guard';

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
        // M01 · Acceso y registro. Las URL se conservan; las viven en una sola carpeta.
        // La fuente de verdad de roles y sesión será Flask.
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
        // M01 · Restablecimiento con token de demostración (sin backend).
        // Se conserva la ruta y la interfaz ya existentes.
        path: 'restablecer/:token',
        loadComponent: () =>
          import('./modulos/recuperar-password/paginas/restablecer/restablecer').then(
            (c) => c.Restablecer,
          ),
      },
    ],
  },
  {
    // Alias del §10: /producto/:id resuelve al detalle por identificador o slug.
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
    canActivate: [rolDemoGuard],
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
    canActivate: [rolDemoGuard],
    // Operativo consulta; Administrador además edita. Sin guards reales todavía.
    data: { titulo: 'Pedidos', rol: 'Administrador', roles: ['Administrador', 'Operativo'] },
    loadChildren: () => import('./modulos/pedidos/pedidos.routes').then((m) => m.PEDIDOS_RUTAS),
  },
  {
    // M10 es exclusivo del Administrador. Se mantiene /productos como alias del §10.
    path: 'admin/productos',
    component: Administracion,
    canActivate: [rolDemoGuard],
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
    canActivate: [rolDemoGuard],
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
    canActivate: [rolDemoGuard],
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
    canActivate: [rolDemoGuard],
    data: { titulo: 'Preparación', rol: 'Operativo', roles: ['Administrador', 'Operativo'] },
    loadChildren: () =>
      import('./modulos/preparacion/preparacion.routes').then((m) => m.PREPARACION_RUTAS),
  },
  {
    // M19 se monta en /entregas según el mapa del §10. Operativo opera y Administrador también.
    path: 'entregas',
    component: Administracion,
    canActivate: [rolDemoGuard],
    data: { titulo: 'Entregas', rol: 'Operativo', roles: ['Administrador', 'Operativo'] },
    loadChildren: () => import('./modulos/entregas/entregas.routes').then((m) => m.ENTREGAS_RUTAS),
  },
  {
    // M20 se monta en /dashboard según el mapa del §10. El documento también
    // prevé una vista operativa sin ventas ni costos; el rol es demostrativo.
    path: 'dashboard',
    component: Administracion,
    canActivate: [rolDemoGuard],
    data: { titulo: 'Dashboard gerencial', rol: 'Administrador', roles: ['Administrador', 'Operativo'] },
    loadChildren: () =>
      import('./modulos/dashboard-gerencial/dashboard.routes').then((m) => m.DASHBOARD_RUTAS),
  },
  {
    // M21 se monta en /alertas según el mapa del §10. Cada rol ve las suyas;
    // el selector de rol de la pantalla es demostrativo, no un guard real.
    path: 'alertas',
    component: Administracion,
    canActivate: [rolDemoGuard],
    data: { titulo: 'Centro de alertas', rol: 'Administrador', roles: ['Administrador', 'Operativo'] },
    loadChildren: () => import('./modulos/centro-alertas/centro-alertas.routes').then((m) => m.ALERTAS_RUTAS),
  },
  {
    // M22 se monta en /sistema según el mapa del §10 y es exclusivo del Administrador.
    // Sin guards reales todavía: la etiqueta de rol es demostrativa.
    path: 'sistema',
    component: Administracion,
    canActivate: [rolDemoGuard],
    data: { titulo: 'Administración del sistema', rol: 'Administrador', roles: ['Administrador'] },
    loadChildren: () =>
      import('./modulos/administracion-sistema/administracion-sistema.routes').then(
        (m) => m.SISTEMA_RUTAS,
      ),
  },
  {
    path: 'proveedores',
    component: Administracion,
    canActivate: [rolDemoGuard],
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
    canActivate: [rolDemoGuard],
    // Contrato de acceso para futuros authGuard/roleGuard; sin bloqueos ficticios.
    data: { titulo: 'Ventas', rol: 'Administrador', roles: ['Administrador'] },
    loadChildren: () => import('./modulos/ventas/ventas.routes').then((m) => m.VENTAS_RUTAS),
  },
  {
    // M14: /compras es de Administrador según §10; las recepciones se montan aparte.
    path: 'compras',
    component: Administracion,
    canActivate: [rolDemoGuard],
    data: { titulo: 'Compras', rol: 'Administrador', roles: ['Administrador'] },
    loadChildren: () => import('./modulos/compras/compras.routes').then((m) => m.COMPRAS_RUTAS),
  },
  {
    // Recepciones: Operativo o Administrador (§10). Ruta propia del §10 del documento.
    path: 'recepciones',
    component: Administracion,
    canActivate: [rolDemoGuard],
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
    canActivate: [rolDemoGuard],
    data: { titulo: 'Inventario MP', rol: 'Operativo', roles: ['Administrador', 'Operativo'] },
    loadChildren: () =>
      import('./modulos/inventario/inventario.routes').then((m) => m.INVENTARIO_RUTAS),
  },
  {
    // M16: /producción según §10 se normaliza a /produccion. Rol Operativo;
    // el Administrador también crea y supervisa. Sin guards reales todavía.
    path: 'produccion',
    component: Administracion,
    canActivate: [rolDemoGuard],
    data: { titulo: 'Producción', rol: 'Operativo', roles: ['Administrador', 'Operativo'] },
    loadChildren: () =>
      import('./modulos/produccion/produccion.routes').then((m) => m.PRODUCCION_RUTAS),
  },
  {
    // M17: /mermas según §10. Operativo registra y consulta; el Administrador
    // además analiza costos y ejecuta reversas. Sin guards reales todavía.
    path: 'mermas',
    component: Administracion,
    canActivate: [rolDemoGuard],
    data: { titulo: 'Mermas', rol: 'Operativo', roles: ['Administrador', 'Operativo'] },
    loadChildren: () => import('./modulos/mermas/mermas.routes').then((m) => m.MERMAS_RUTAS),
  },
  { path: '**', redirectTo: 'no-encontrado' },
];
