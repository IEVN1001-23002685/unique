import { Routes } from '@angular/router';
import { rolDemoGuard } from '../../nucleo/guards/rol-demo.guard';

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
    data: { roles: ['Administrador'] },
    canActivate: [rolDemoGuard],
    loadComponent: () => import('./paginas/indicadores/indicadores').then((c) => c.Indicadores),
  },
  { path: '**', redirectTo: '' },
];
