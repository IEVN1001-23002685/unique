import { Routes } from '@angular/router';
import { CentroAlertas } from './centro-alertas';

/** Rutas de M21 · Centro de alertas, montadas bajo /alertas según el §10. */
export const ALERTAS_RUTAS: Routes = [
  {
    path: '',
    component: CentroAlertas,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'bandeja' },
      {
        path: 'bandeja',
        title: 'Bandeja de alertas · UNIQUE',
        loadComponent: () => import('./paginas/bandeja/bandeja').then((c) => c.Bandeja),
      },
      {
        path: 'resueltas',
        title: 'Bitácora de alertas resueltas · UNIQUE',
        loadComponent: () => import('./paginas/resueltas/resueltas').then((c) => c.Resueltas),
      },
      {
        path: 'reglas',
        title: 'Reglas de alertas · UNIQUE',
        loadComponent: () => import('./paginas/reglas/reglas').then((c) => c.Reglas),
      },
      { path: '**', redirectTo: 'bandeja' },
    ],
  },
];
