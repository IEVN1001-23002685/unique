import { Routes } from '@angular/router';
import { Dashboard } from './dashboard';

/** Rutas de M20 · Dashboard gerencial, montadas bajo /dashboard según el §10. */
export const DASHBOARD_RUTAS: Routes = [
  {
    path: '',
    component: Dashboard,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'resumen' },
      {
        path: 'resumen',
        title: 'Resumen · Dashboard UNIQUE',
        loadComponent: () =>
          import('./paginas/resumen/resumen').then((c) => c.Resumen),
      },
      {
        path: 'ventas-productos',
        title: 'Ventas y productos · Dashboard UNIQUE',
        loadComponent: () =>
          import('./paginas/ventas-productos/ventas-productos').then((c) => c.VentasProductos),
      },
      {
        path: 'produccion-merma',
        title: 'Producción y merma · Dashboard UNIQUE',
        loadComponent: () =>
          import('./paginas/produccion-merma/produccion-merma').then((c) => c.ProduccionMerma),
      },
      {
        path: 'abastecimiento',
        title: 'Abastecimiento · Dashboard UNIQUE',
        loadComponent: () =>
          import('./paginas/abastecimiento/abastecimiento').then((c) => c.Abastecimiento),
      },
      {
        path: 'logistica-devoluciones',
        title: 'Logística y devoluciones · Dashboard UNIQUE',
        loadComponent: () =>
          import('./paginas/logistica-devoluciones/logistica-devoluciones').then(
            (c) => c.LogisticaDevoluciones,
          ),
      },
    ],
  },
];
