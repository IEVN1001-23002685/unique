import { Routes } from '@angular/router';

/** Rutas de M19 · Entregas, montadas bajo /entregas según el mapa del §10. */
export const ENTREGAS_RUTAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Por asignar · UNIQUE',
    loadComponent: () =>
      import('./paginas/por-asignar/por-asignar').then((c) => c.PorAsignar),
  },
  {
    path: 'hoja-reparto',
    title: 'Hoja de reparto · UNIQUE',
    loadComponent: () =>
      import('./paginas/hoja-reparto/hoja-reparto').then((c) => c.HojaReparto),
  },
  {
    path: 'seguimiento',
    title: 'Seguimiento de entregas · UNIQUE',
    loadComponent: () =>
      import('./paginas/seguimiento/seguimiento').then((c) => c.Seguimiento),
  },
  {
    path: 'productos-repartidos',
    title: 'Productos repartidos · UNIQUE',
    loadComponent: () =>
      import('./paginas/productos-repartidos/productos-repartidos').then(
        (c) => c.ProductosRepartidos,
      ),
  },
  {
    path: 'repartidores',
    title: 'Repartidores · UNIQUE',
    loadComponent: () =>
      import('./paginas/repartidores/repartidores').then((c) => c.Repartidores),
  },
  { path: '**', redirectTo: '' },
];
