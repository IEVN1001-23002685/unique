import { Routes } from '@angular/router';

/** Rutas de M08 · Ventas, montadas bajo /ventas (alias /admin/ventas en app.routes.ts). */
export const VENTAS_RUTAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Registro de ventas · UNIQUE',
    loadComponent: () =>
      import('./paginas/registro-ventas/registro-ventas').then((c) => c.RegistroVentas),
  },
  {
    path: 'manual',
    title: 'Venta manual · UNIQUE',
    loadComponent: () => import('./paginas/venta-manual/venta-manual').then((c) => c.VentaManual),
  },
  {
    path: 'descuentos',
    pathMatch: 'full',
    title: 'Descuentos y cupones · UNIQUE',
    loadComponent: () =>
      import('./paginas/descuentos-cupones/descuentos-cupones').then(
        (c) => c.DescuentosCupones,
      ),
  },
  {
    path: 'descuentos/nuevo',
    title: 'Nuevo descuento · UNIQUE',
    loadComponent: () =>
      import('./paginas/formulario-descuento/formulario-descuento').then(
        (c) => c.FormularioDescuento,
      ),
  },
  {
    path: 'descuentos/:id/editar',
    title: 'Editar descuento · UNIQUE',
    loadComponent: () =>
      import('./paginas/formulario-descuento/formulario-descuento').then(
        (c) => c.FormularioDescuento,
      ),
  },
  {
    path: ':folio',
    title: 'Detalle de venta · UNIQUE',
    loadComponent: () =>
      import('./paginas/detalle-venta/detalle-venta').then((c) => c.DetalleVenta),
  },
  { path: '**', redirectTo: '' },
];
