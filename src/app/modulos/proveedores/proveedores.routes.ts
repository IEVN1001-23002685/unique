import { Routes } from '@angular/router';

/** Rutas de M13 · Proveedores, montadas bajo /proveedores. */
export const PROVEEDORES_RUTAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Padrón de proveedores · UNIQUE',
    loadComponent: () => import('./paginas/padron/padron').then((c) => c.Padron),
  },
  {
    path: 'nuevo',
    title: 'Nuevo proveedor · UNIQUE',
    loadComponent: () =>
      import('./paginas/formulario-proveedor/formulario-proveedor').then(
        (c) => c.FormularioProveedor,
      ),
  },
  {
    path: 'evaluacion',
    title: 'Evaluación de proveedores · UNIQUE',
    loadComponent: () => import('./paginas/evaluacion/evaluacion').then((c) => c.Evaluacion),
  },
  {
    path: ':id/editar',
    title: 'Editar proveedor · UNIQUE',
    loadComponent: () =>
      import('./paginas/formulario-proveedor/formulario-proveedor').then(
        (c) => c.FormularioProveedor,
      ),
  },
  {
    path: ':id/materiales',
    title: 'Catálogo del proveedor · UNIQUE',
    loadComponent: () =>
      import('./paginas/catalogo-proveedor/catalogo-proveedor').then(
        (c) => c.CatalogoProveedor,
      ),
  },
  { path: '**', redirectTo: '' },
];
