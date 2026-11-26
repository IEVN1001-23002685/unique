import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthStateService } from '../../core/auth/auth-state.service';
import type { RolUsuario } from '../../core/auth/auth-state.service';
import { PerfilDemoServicio, type PerfilDemo } from '../servicios/perfil-demo-servicio';

/**
 * Guard de demostración sobre `data.roles` de las rutas del panel.
 * No sustituye a los guards definitivos de Flask: solo evita que el perfil
 * visual incorrecto explore pantallas ajenas y muestra una explicación clara.
 */
export const rolDemoGuard: CanActivateFn = (ruta) => {
  const permitidos = ruta.data['roles'];
  if (!Array.isArray(permitidos) || permitidos.length === 0) {
    return true;
  }

  const perfil = inject(PerfilDemoServicio).perfil();
  const estado = inject(AuthStateService);
  const codigos: Record<PerfilDemo, RolUsuario> = {
    Cliente: 'CLIENTE',
    Operativo: 'OPERATIVO',
    Administrador: 'ADMIN',
  };
  const autorizado = estado.autenticado()
    ? estado.puede(permitidos.map((nombre) => codigos[nombre as PerfilDemo] ?? (nombre as RolUsuario)))
    : permitidos.includes(perfil);
  if (autorizado) {
    return true;
  }

  const router = inject(Router);
  void router.navigate(['/sin-acceso'], {
    queryParams: {
      ruta: router.url,
      requerido: permitidos.join(', '),
      perfil,
    },
  });
  return false;
};
