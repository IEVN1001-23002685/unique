import { Routes } from '@angular/router';

/** Rutas de M15 · Inventario de materia prima, montadas bajo /inventario-mp (§10). */
export const INVENTARIO_RUTAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Existencias · UNIQUE',
    loadComponent: () =>
      import('./paginas/existencias/existencias').then((c) => c.Existencias),
  },
  {
    path: 'lotes',
    title: 'Lotes de material · UNIQUE',
    loadComponent: () => import('./paginas/lotes/lotes').then((c) => c.Lotes),
  },
  {
    path: 'kardex',
    title: 'Kardex de materiales · UNIQUE',
    loadComponent: () => import('./paginas/kardex/kardex').then((c) => c.Kardex),
  },
  {
    path: 'ajuste',
    title: 'Ajuste y conteo · UNIQUE',
    loadComponent: () => import('./paginas/ajuste/ajuste').then((c) => c.Ajuste),
  },
  {
    path: 'catalogo',
    pathMatch: 'full',
    title: 'Catálogo de materiales · UNIQUE',
    data: { modo: 'listado' },
    loadComponent: () =>
      import('./paginas/catalogo-materiales/catalogo-materiales').then(
        (c) => c.CatalogoMateriales,
      ),
  },
  {
    path: 'catalogo/nuevo',
    title: 'Alta de material · UNIQUE',
    data: { modo: 'nuevo' },
    loadComponent: () =>
      import('./paginas/catalogo-materiales/catalogo-materiales').then(
        (c) => c.CatalogoMateriales,
      ),
  },
  {
    path: 'catalogo/:id/editar',
    title: 'Editar material · UNIQUE',
    data: { modo: 'editar' },
    loadComponent: () =>
      import('./paginas/catalogo-materiales/catalogo-materiales').then(
        (c) => c.CatalogoMateriales,
      ),
  },
  {
    path: 'politicas',
    title: 'Políticas de reposición · UNIQUE',
    loadComponent: () => import('./paginas/politicas/politicas').then((c) => c.Politicas),
  },
  { path: '**', redirectTo: '' },
];
