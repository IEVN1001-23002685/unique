import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { rutaDestinoPorRol } from '../modelos/acceso-registro';

/** §10.2: las pantallas de M01 son públicas solo cuando no hay sesión activa. */
export const invitadoGuard: CanActivateFn = () => {
  const estado = inject(AuthStateService);
  const router = inject(Router);
  const rol = estado.rol();

  return rol === null ? true : router.createUrlTree([rutaDestinoPorRol(rol)]);
};
