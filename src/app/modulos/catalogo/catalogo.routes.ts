import { Routes } from '@angular/router';

export const CATALOGO_RUTAS: Routes = [
  {
    path: '',
    loadComponent: () => import('./paginas/catalogo/catalogo').then((c) => c.Catalogo),
  },
  {
    // Ruta por nombre de producto, por ejemplo: /catalogo/producto/sudadera
    path: 'producto/:slug',
    loadComponent: () =>
      import('./paginas/detalle-producto/detalle-producto').then((c) => c.DetalleProducto),
  },
];
