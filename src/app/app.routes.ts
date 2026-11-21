import { Routes } from '@angular/router';
import { Tienda } from './plantillas/tienda/tienda';

export const routes: Routes = [
  {
    path: '',
    component: Tienda,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'catalogo' },
      {
        path: 'catalogo',
        loadChildren: () =>
          import('./modulos/catalogo/catalogo.routes').then((m) => m.CATALOGO_RUTAS),
      },
      // Fallback hacia una ruta realmente definida
      { path: '**', redirectTo: 'catalogo' },
    ],
  },
];
