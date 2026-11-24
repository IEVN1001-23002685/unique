import { Routes } from '@angular/router';

/** Rutas de M12 · Inventario de producto terminado, montadas bajo /operacion/inventario-pt. */
export const INVENTARIO_PT_RUTAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Existencias de producto terminado · UNIQUE',
    loadComponent: () => import('./paginas/existencias/existencias').then((c) => c.Existencias),
  },
  {
    path: 'movimientos',
    title: 'Movimientos de producto terminado · UNIQUE',
    loadComponent: () => import('./paginas/movimientos/movimientos').then((c) => c.Movimientos),
  },
  {
    path: 'ajuste',
    title: 'Ajuste de inventario de producto terminado · UNIQUE',
    loadComponent: () =>
      import('./paginas/ajuste-inventario/ajuste-inventario').then((c) => c.AjusteInventario),
  },
  {
    path: 'reglas',
    title: 'Reglas de reposición · UNIQUE',
    loadComponent: () =>
      import('./paginas/reglas-reposicion/reglas-reposicion').then((c) => c.ReglasReposicion),
  },
  { path: '**', redirectTo: '' },
];
