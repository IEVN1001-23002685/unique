import { computed, inject, Injectable } from '@angular/core';
import { AuthStateService } from '../../core/auth/auth-state.service';

/** Perfil visible del usuario autenticado. Nunca se selecciona manualmente. */
export type PerfilSesion = 'Cliente' | 'Operativo' | 'Administrador';

/** Proyección de lectura del rol real devuelto por Flask en /auth/login. */
@Injectable({ providedIn: 'root' })
export class PerfilSesionServicio {
  private readonly auth = inject(AuthStateService);

  readonly perfil = computed<PerfilSesion | null>(() => {
    switch (this.auth.rol()) {
      case 'CLIENTE':
        return 'Cliente';
      case 'OPERATIVO':
        return 'Operativo';
      case 'ADMIN':
        return 'Administrador';
      default:
        return null;
    }
  });

  readonly rol = computed(() => this.auth.rol());

  readonly esAdministrador = computed(() => this.auth.puede(['ADMIN']));
  readonly esOperativo = computed(() => this.auth.puede(['ADMIN', 'OPERATIVO']));
  /** Operativo no ve costos, precios de compra ni utilidades. */
  readonly puedeVerCostos = computed(() => this.esAdministrador());
}
