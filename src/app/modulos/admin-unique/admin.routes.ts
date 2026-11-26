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

const OPERATIVO_Y_ADMIN = ['ADMIN', 'OPERATIVO'];
const SOLO_ADMIN = ['ADMIN'];

/**
 * Rutas canónicas del panel M18–M22. Las subrutas por sección sincronizan la
 * pestaña activa con la URL y permiten los alias históricos sin reactivar copias.
 */
export const ADMIN_UNIQUE_ROUTES: Routes = [
  { path: 'login-admin', component: LoginPageComponent },
  { path: 'sin-acceso-admin', component: SinAccesoComponent },
  {
    path: 'panel-admin',
    component: PanelAdminComponent,
    canActivate: [authAdminGuard],
    data: { titulo: 'Panel administrativo' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        pathMatch: 'full',
        component: DashboardM20Component,
        canActivate: [rolAdminGuard],
        data: { titulo: 'Dashboard gerencial', roles: OPERATIVO_Y_ADMIN },
      },
      {
        path: 'dashboard/:seccion',
        component: DashboardM20Component,
        canActivate: [rolAdminGuard],
        data: { titulo: 'Dashboard gerencial', roles: OPERATIVO_Y_ADMIN },
      },
      {
        path: 'preparacion',
        pathMatch: 'full',
        component: PreparacionM18Component,
        canActivate: [rolAdminGuard],
        data: { titulo: 'Preparación de pedidos', roles: OPERATIVO_Y_ADMIN },
      },
      {
        path: 'preparacion/:seccion',
        component: PreparacionM18Component,
        canActivate: [rolAdminGuard],
        data: { titulo: 'Preparación de pedidos', roles: OPERATIVO_Y_ADMIN },
      },
      {
        path: 'entregas',
        pathMatch: 'full',
        component: EntregasM19Component,
        canActivate: [rolAdminGuard],
        data: { titulo: 'Entregas y repartidores', roles: OPERATIVO_Y_ADMIN },
      },
      {
        path: 'entregas/:seccion',
        component: EntregasM19Component,
        canActivate: [rolAdminGuard],
        data: { titulo: 'Entregas y repartidores', roles: OPERATIVO_Y_ADMIN },
      },
      {
        path: 'alertas',
        pathMatch: 'full',
        component: AlertasM21Component,
        canActivate: [rolAdminGuard],
        data: { titulo: 'Centro de alertas', roles: OPERATIVO_Y_ADMIN },
      },
      {
        path: 'alertas/reglas',
        component: AlertasM21Component,
        canActivate: [rolAdminGuard],
        data: { titulo: 'Reglas de alertas', roles: SOLO_ADMIN },
      },
      {
        path: 'alertas/:seccion',
        component: AlertasM21Component,
        canActivate: [rolAdminGuard],
        data: { titulo: 'Centro de alertas', roles: OPERATIVO_Y_ADMIN },
      },
      {
        path: 'sistema',
        pathMatch: 'full',
        component: AdministracionM22Component,
        canActivate: [rolAdminGuard],
        data: { titulo: 'Administración del sistema', roles: SOLO_ADMIN },
      },
      {
        path: 'sistema/:seccion',
        component: AdministracionM22Component,
        canActivate: [rolAdminGuard],
        data: { titulo: 'Administración del sistema', roles: SOLO_ADMIN },
      },
    ],
  },
];
