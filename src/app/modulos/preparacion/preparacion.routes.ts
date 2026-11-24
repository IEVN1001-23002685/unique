import { Routes } from '@angular/router';

/** Rutas de M18 · Preparación, montadas bajo /preparación según el mapa del §10. */
export const PREPARACION_RUTAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Cola de preparación · UNIQUE',
    loadComponent: () =>
      import('./paginas/cola-preparacion/cola-preparacion').then(
        (c) => c.ColaPreparacion,
      ),
  },
  {
    path: 'incidencias',
    title: 'Incidencias de preparación · UNIQUE',
    loadComponent: () =>
      import('./paginas/incidencias/incidencias').then((c) => c.Incidencias),
  },
  {
    path: ':folio',
    title: 'Hoja de preparación · UNIQUE',
    loadComponent: () =>
      import('./paginas/hoja-preparacion/hoja-preparacion').then(
        (c) => c.HojaPreparacion,
      ),
  },
  { path: '**', redirectTo: '' },
];
