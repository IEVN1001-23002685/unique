import { Injectable, signal } from '@angular/core';

/** Identifica cual de los dos formularios se muestra dentro del modal. */
export type TipoModalAutenticacion = 'login' | 'registro';

/**
 * Estado visual de los modales de autenticacion.
 * No gestiona sesiones ni llama a un backend: solo controla que dialogo se vea.
 */
@Injectable({
  providedIn: 'root',
})
export class ModalAutenticacionServicio {
  readonly modalActiva = signal<TipoModalAutenticacion | null>(null);

  abrirLogin(): void {
    this.modalActiva.set('login');
  }

  abrirRegistro(): void {
    this.modalActiva.set('registro');
  }

  cambiarARegistro(): void {
    this.modalActiva.set('registro');
  }

  cambiarAInicioSesion(): void {
    this.modalActiva.set('login');
  }

  cerrar(): void {
    this.modalActiva.set(null);
  }
}
