import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionService } from './auth-session.service';
import { RolUsuario } from '../../../core/auth/auth-state.service';

/** Guards del paquete: usan la sesión canónica pero conservan las rutas propias del panel. */
export const authAdminGuard: CanActivateFn = (_route, state) => {
  const sesion = inject(AuthSessionService);
  const router = inject(Router);
  return sesion.autenticado
    ? true
    : router.createUrlTree(['/login-admin'], { queryParams: { returnUrl: state.url } });
};

export const rolAdminGuard: CanActivateFn = (route) => {
  const sesion = inject(AuthSessionService);
  const router = inject(Router);
  const roles = new Set((route.data['roles'] ?? []) as RolUsuario[]);
  const rol = sesion.usuario?.rol;
  if (rol === 'ADMIN' && roles.has('OPERATIVO')) roles.add('ADMIN');
  return rol && roles.has(rol) ? true : router.createUrlTree(['/sin-acceso-admin']);
};
