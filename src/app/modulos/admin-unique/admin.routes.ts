import { Routes } from '@angular/router';
import { PanelAdminComponent } from './preparacion/panel-admin.component';
import { PreparacionM18Component } from './preparacion/preparacion-m18.component';
import { EntregasM19Component } from './preparacion/entregas-m19.component';
import { DashboardM20Component } from './administracion/dashboard-m20.component';
import { AlertasM21Component } from './administracion/alertas-m21.component';
import { AdministracionM22Component } from './administracion/administracion-m22.component';
import { LoginPageComponent } from './administracion/login-page.component';
import { SinAccesoComponent } from './administracion/sin-acceso.component';
import { authAdminGuard, rolAdminGuard } from './services/guards-admin';

/** Rutas autocontenidas. Se agregan desde el archivo de rutas principal sin reemplazar rutas existentes. */
export const ADMIN_UNIQUE_ROUTES: Routes = [
  { path: 'login-admin', component: LoginPageComponent },
  { path: 'sin-acceso-admin', component: SinAccesoComponent },
  {
    path: 'panel-admin',
    component: PanelAdminComponent,
    canActivate: [authAdminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        component: DashboardM20Component,
        canActivate: [rolAdminGuard],
        data: { roles: ['ADMIN', 'OPERATIVO'] },
      },
      {
        path: 'preparacion',
        component: PreparacionM18Component,
        canActivate: [rolAdminGuard],
        data: { roles: ['ADMIN', 'OPERATIVO'] },
      },
      {
        path: 'entregas',
        component: EntregasM19Component,
        canActivate: [rolAdminGuard],
        data: { roles: ['ADMIN', 'OPERATIVO'] },
      },
      {
        path: 'alertas',
        component: AlertasM21Component,
        canActivate: [rolAdminGuard],
        data: { roles: ['ADMIN', 'OPERATIVO'] },
      },
      {
        path: 'sistema',
        component: AdministracionM22Component,
        canActivate: [rolAdminGuard],
        data: { roles: ['ADMIN'] },
      },
    ],
  },
];
