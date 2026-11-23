import { Routes } from '@angular/router';

/** Rutas de M11 · Recetas y bordados, montadas bajo /admin/recetas. */
export const RECETAS_RUTAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Biblioteca de recetas · UNIQUE',
    loadComponent: () =>
      import('./paginas/biblioteca-recetas/biblioteca-recetas').then((c) => c.BibliotecaRecetas),
  },
  {
    path: 'nuevo',
    title: 'Nueva receta · UNIQUE',
    loadComponent: () =>
      import('./paginas/editor-receta/editor-receta').then((c) => c.EditorReceta),
  },
  {
    path: 'editar/:id',
    title: 'Editor de receta · UNIQUE',
    loadComponent: () =>
      import('./paginas/editor-receta/editor-receta').then((c) => c.EditorReceta),
  },
  {
    path: 'historial',
    title: 'Historial de recetas · UNIQUE',
    loadComponent: () =>
      import('./paginas/historial-recetas/historial-recetas').then((c) => c.HistorialRecetas),
  },
  {
    path: 'disenos',
    title: 'Diseños de bordado · UNIQUE',
    loadComponent: () =>
      import('./paginas/disenos-bordado/disenos-bordado').then((c) => c.DisenosBordado),
  },
  {
    path: 'costeo',
    title: 'Costeo estándar · UNIQUE',
    loadComponent: () =>
      import('./paginas/costeo-estandar/costeo-estandar').then((c) => c.CosteoEstandar),
  },
  { path: '**', redirectTo: '' },
];
