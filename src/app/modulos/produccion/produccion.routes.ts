import { Routes } from '@angular/router';

/** Rutas de M16 · Producción, montadas bajo /produccion (§10 del documento). */
export const PRODUCCION_RUTAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Tablero de producción · UNIQUE',
    loadComponent: () => import('./paginas/tablero/tablero').then((c) => c.Tablero),
  },
  {
    path: 'nueva',
    title: 'Nueva orden de producción · UNIQUE',
    loadComponent: () => import('./paginas/nueva-orden/nueva-orden').then((c) => c.NuevaOrden),
  },
  {
    path: 'revision',
    title: 'Revisión de calidad · UNIQUE',
    loadComponent: () =>
      import('./paginas/revision-calidad/revision-calidad').then((c) => c.RevisionCalidad),
  },
  {
    path: 'revision/:id',
    title: 'Dictamen de calidad · UNIQUE',
    loadComponent: () =>
      import('./paginas/revision-calidad/revision-calidad').then((c) => c.RevisionCalidad),
  },
  {
    path: 'plan-sugerido',
    title: 'Plan sugerido de producción · UNIQUE',
    loadComponent: () =>
      import('./paginas/plan-sugerido/plan-sugerido').then((c) => c.PlanSugerido),
  },
  {
    path: ':id',
    title: 'Detalle de orden · UNIQUE',
    loadComponent: () =>
      import('./paginas/detalle-orden/detalle-orden').then((c) => c.DetalleOrden),
  },
  { path: '**', redirectTo: '' },
];
