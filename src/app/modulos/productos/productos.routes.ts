import { Routes } from '@angular/router';

/** Rutas de M10 · Productos y variantes, montadas bajo /admin/productos. */
export const PRODUCTOS_RUTAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Catálogo maestro de productos · UNIQUE',
    loadComponent: () =>
      import('./paginas/catalogo-maestro/catalogo-maestro').then((c) => c.CatalogoMaestro),
  },
  {
    path: 'nuevo',
    title: 'Nuevo producto · UNIQUE',
    loadComponent: () =>
      import('./paginas/formulario-producto/formulario-producto').then((c) => c.FormularioProducto),
  },
  {
    path: 'editar/:id',
    title: 'Editar producto · UNIQUE',
    loadComponent: () =>
      import('./paginas/formulario-producto/formulario-producto').then((c) => c.FormularioProducto),
  },
  {
    path: 'variantes',
    title: 'Variantes de producto · UNIQUE',
    loadComponent: () => import('./paginas/variantes/variantes').then((c) => c.Variantes),
  },
  { path: '**', redirectTo: '' },
];
