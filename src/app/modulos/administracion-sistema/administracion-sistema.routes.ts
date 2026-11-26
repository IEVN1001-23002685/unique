import { Routes } from '@angular/router';
import { AdministracionSistema } from './administracion-sistema';

/** Rutas de M22 · Administración del sistema, montadas bajo /sistema (§10). */
export const SISTEMA_RUTAS: Routes = [
  {
    path: '',
    component: AdministracionSistema,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'usuarios' },
      {
        path: 'usuarios',
        title: 'Usuarios y roles · UNIQUE',
        loadComponent: () => import('./paginas/usuarios/usuarios').then((c) => c.Usuarios),
      },
      {
        path: 'clientes',
        title: 'Clientes · UNIQUE',
        loadComponent: () => import('./paginas/clientes/clientes').then((c) => c.Clientes),
      },
      {
        path: 'catalogos',
        title: 'Catálogos del sistema · UNIQUE',
        loadComponent: () => import('./paginas/catalogos/catalogos').then((c) => c.Catalogos),
      },
      {
        path: 'configuracion',
        title: 'Configuración · UNIQUE',
        loadComponent: () =>
          import('./paginas/configuracion/configuracion').then((c) => c.Configuracion),
      },
      {
        path: 'bitacora',
        title: 'Bitácora del sistema · UNIQUE',
        loadComponent: () => import('./paginas/bitacora/bitacora').then((c) => c.Bitacora),
      },
      { path: '**', redirectTo: 'usuarios' },
    ],
  },
];
