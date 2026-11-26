import { Injectable, computed, signal } from '@angular/core';

export type RolUsuario = 'CLIENTE' | 'OPERATIVO' | 'ADMIN';

export interface UsuarioSesion {
  id: number;
  nombre: string;
  apellidos?: string;
  correo: string;
  telefono?: string;
  rol: RolUsuario;
  estado_cuenta?: string;
}

/**
 * Respuesta de sesión con la misma forma pública que la futura API.
 * El token de esta rama es una cadena de demostración: no es un JWT real.
 */
export interface RespuestaSesion {
  access_token: string;
  usuario: UsuarioSesion;
  expira_en_minutos?: number;
}

/** Estado de sesión solo en memoria: no escribe en localStorage ni sessionStorage. */
@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly tokenInterno = signal<string | null>(null);
  private readonly usuarioInterno = signal<UsuarioSesion | null>(null);

  readonly token = this.tokenInterno.asReadonly();
  readonly usuario = this.usuarioInterno.asReadonly();
  readonly autenticado = computed(
    () => this.tokenInterno() !== null && this.usuarioInterno() !== null,
  );

  guardarSesion(respuesta: RespuestaSesion): void {
    this.tokenInterno.set(respuesta.access_token);
    this.usuarioInterno.set({ ...respuesta.usuario });
  }

  actualizarToken(token: string): void {
    this.tokenInterno.set(token);
  }

  limpiar(): void {
    this.tokenInterno.set(null);
    this.usuarioInterno.set(null);
  }

  rol(): RolUsuario | null {
    return this.usuarioInterno()?.rol ?? null;
  }

  puede(roles: RolUsuario[]): boolean {
    const rol = this.rol();
    return rol !== null && roles.includes(rol);
  }
}
