import { Injectable, computed, signal } from '@angular/core';

/** Perfil de demostración para proyectar la visibilidad por rol sin autenticación real. */
export type PerfilDemo = 'Operativo' | 'Administrador';

/**
 * Estado visual compartido de las pantallas que muestran costos.
 * El valor inicial es Operativo para no exponer costos de compra ni utilidades
 * en la demostración. La autoridad real seguirá siendo Flask (§3 y §10.4).
 */
@Injectable({
  providedIn: 'root',
})
export class PerfilDemoServicio {
  private readonly perfilInterno = signal<PerfilDemo>('Operativo');

  readonly perfil = this.perfilInterno.asReadonly();
  readonly esAdministrador = computed(() => this.perfilInterno() === 'Administrador');

  seleccionar(perfil: PerfilDemo): void {
    this.perfilInterno.set(perfil);
  }
}
