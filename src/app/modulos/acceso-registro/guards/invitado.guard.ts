import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { rutaDestinoPorRol } from '../modelos/acceso-registro';

/** §10.2: las pantallas de M01 son públicas solo cuando no hay sesión activa. */
export const invitadoGuard: CanActivateFn = () => {
  const estado = inject(AuthStateService);
  const router = inject(Router);
  const rol = estado.rol();

  return rol ? router.createUrlTree([rutaDestinoPorRol(rol)]) : true;
};
