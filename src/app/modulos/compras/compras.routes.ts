import { Routes } from '@angular/router';

/** Rutas de M14 · Compras, montadas bajo /compras para el Administrador. */
export const COMPRAS_RUTAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Requisiciones · UNIQUE',
    loadComponent: () =>
      import('./paginas/requisiciones/requisiciones').then((c) => c.Requisiciones),
  },
  {
    path: 'requisiciones/nueva',
    title: 'Nueva requisición · UNIQUE',
    loadComponent: () =>
      import('./paginas/formulario-requisicion/formulario-requisicion').then(
        (c) => c.FormularioRequisicion,
      ),
  },
  {
    path: 'requisiciones/:id/editar',
    title: 'Editar requisición · UNIQUE',
    loadComponent: () =>
      import('./paginas/formulario-requisicion/formulario-requisicion').then(
        (c) => c.FormularioRequisicion,
      ),
  },
  {
    path: 'cotizaciones',
    title: 'Cotizaciones · UNIQUE',
    loadComponent: () => import('./paginas/cotizaciones/cotizaciones').then((c) => c.Cotizaciones),
  },
  {
    path: 'ordenes',
    title: 'Órdenes de compra · UNIQUE',
    loadComponent: () => import('./paginas/ordenes/ordenes').then((c) => c.Ordenes),
  },
  {
    path: 'ordenes/:id/editar',
    title: 'Editar orden de compra · UNIQUE',
    loadComponent: () =>
      import('./paginas/formulario-orden/formulario-orden').then((c) => c.FormularioOrden),
  },
  { path: '**', redirectTo: '' },
];
