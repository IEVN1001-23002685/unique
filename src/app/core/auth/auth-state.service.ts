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

export interface RespuestaSesion {
  access_token: string;
  usuario: UsuarioSesion;
}

/** Estado de sesión en memoria. Ningún token se escribe en localStorage ni sessionStorage. */
@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly tokenInterno = signal<string | null>(null);
  private readonly usuarioInterno = signal<UsuarioSesion | null>(null);

  readonly token = this.tokenInterno.asReadonly();
  readonly usuario = this.usuarioInterno.asReadonly();
  readonly autenticado = computed(() => !!this.tokenInterno() && !!this.usuarioInterno());

  guardarSesion(respuesta: RespuestaSesion): void {
    this.tokenInterno.set(respuesta.access_token);
    this.usuarioInterno.set(respuesta.usuario);
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

  puede(roles: readonly RolUsuario[]): boolean {
    if (!roles.length) return true;
    const rol = this.rol();
    if (!rol) return false;
    return roles.includes(rol) || (rol === 'ADMIN' && roles.includes('OPERATIVO'));
  }
}
