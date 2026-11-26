import { Routes } from '@angular/router';

export const CATALOGO_RUTAS: Routes = [
  {
    path: '',
    title: 'Catálogo · UNIQUE',
    loadComponent: () => import('./paginas/catalogo/catalogo').then((c) => c.Catalogo),
  },
  {
    // El detalle público se resuelve por identificador de producto.
    path: 'producto/:productoId',
    title: 'Detalle de producto · UNIQUE',
    loadComponent: () =>
      import('./paginas/detalle-producto/detalle-producto').then((c) => c.DetalleProducto),
  },
];
