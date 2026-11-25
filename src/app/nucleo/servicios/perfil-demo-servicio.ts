import { Injectable, computed, signal } from '@angular/core';

/** Perfiles del documento (§3). Solo proyectan visibilidad; no son autenticación real. */
export type PerfilDemo = 'Cliente' | 'Operativo' | 'Administrador';

/**
 * Estado visual compartido de rutas, menús y cifras sensibles.
 * El valor inicial es Administrador para que el panel sea explorable sin sesión;
 * la autoridad real (JWT y permisos) corresponderá a Flask. Cambiar el perfil
 * aquí nunca modifica datos ni bypassa permisos del servidor.
 */
@Injectable({
  providedIn: 'root',
})
export class PerfilDemoServicio {
  private readonly perfilInterno = signal<PerfilDemo>('Administrador');

  readonly perfil = this.perfilInterno.asReadonly();
  readonly perfiles: readonly PerfilDemo[] = ['Cliente', 'Operativo', 'Administrador'];

  readonly esAdministrador = computed(() => this.perfilInterno() === 'Administrador');
  readonly esOperativo = computed(
    () => this.perfilInterno() === 'Administrador' || this.perfilInterno() === 'Operativo',
  );
  /** Operativo no ve costos, precios de compra ni utilidades (§3). */
  readonly puedeVerCostos = computed(() => this.perfilInterno() === 'Administrador');

  seleccionar(perfil: PerfilDemo): void {
    this.perfilInterno.set(perfil);
  }
}
