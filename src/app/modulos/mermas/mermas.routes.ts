import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth-session.service';

/** Rutas de M17 · Mermas, montadas bajo /mermas (§10 del documento). */
export const MERMAS_RUTAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Zona de merma · UNIQUE',
    data: { rol: 'Operativo', soloAdministrador: false },
    loadComponent: () => import('./paginas/zona-merma/zona-merma').then((c) => c.ZonaMerma),
  },
  {
    path: 'registro',
    title: 'Registro de merma · UNIQUE',
    data: { rol: 'Operativo', soloAdministrador: false },
    loadComponent: () =>
      import('./paginas/registro-merma/registro-merma').then((c) => c.RegistroMerma),
  },
  {
    path: 'indicadores',
    title: 'Indicadores de merma · UNIQUE',
    data: { roles: ['ADMIN'] },
    canActivate: [roleGuard],
    loadComponent: () => import('./paginas/indicadores/indicadores').then((c) => c.Indicadores),
  },
  { path: '**', redirectTo: '' },
];
