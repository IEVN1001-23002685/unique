import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { delay, of, tap, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { AuthStateService } from './auth-state.service';
import type { RespuestaSesion, RolUsuario, UsuarioSesion } from './auth-state.service';

export type { RolUsuario, UsuarioSesion, RespuestaSesion } from './auth-state.service';

export interface DatosRegistroApi {
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  password: string;
  acepta_privacidad: boolean;
  acepta_promociones: boolean;
}

export interface MensajeApi {
  mensaje: string;
}

interface UsuarioLocal {
  id: number;
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  /** Solo demostración local: nunca se envía a un servidor ni se persiste. */
  passwordSimulada: string;
  rol: RolUsuario;
  estado_cuenta: string;
  intentosFallidos: number;
  bloqueadoHasta: number | null;
}

interface RecuperacionLocal {
  correo: string;
  expiraEn: number;
}

const INTENTOS_MAXIMOS = 5;
const BLOQUEO_MINUTOS = 15;
const VIGENCIA_RECUPERACION_MS = 30 * 60 * 1000;
const TOKEN_RECUPERACION = 'demo';
const TOKEN_SESION_SIMULADO = 'simulado-local-15min';
const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos.';
const MENSAJE_REGISTRO = 'No fue posible crear la cuenta con ese correo.';
const MENSAJE_RECUPERACION =
  'Si el correo ingresado está registrado, se generó una instrucción de recuperación.';
const MENSAJE_RESTABLECIMIENTO = 'Tu contraseña se actualizó. Inicia sesión para continuar.';
const MENSAJE_TOKEN = 'El enlace no es válido o venció. Solicita una nueva instrucción.';

/**
 * Puerta única de sesión con la misma firma pública que la futura API real.
 * Esta implementación trabaja solo en memoria: no hay HttpClient, JWT, cookies
 * ni persistencia. Al conectar Flask se sustituye el cuerpo de los métodos.
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly estado = inject(AuthStateService);
  private readonly usuarios = new Map<string, UsuarioLocal>();
  private readonly recuperaciones = new Map<string, RecuperacionLocal>();
  private siguienteId = 1;

  get token(): string | null {
    return this.estado.token();
  }

  get usuario(): UsuarioSesion | null {
    return this.estado.usuario();
  }

  get autenticado(): boolean {
    return this.estado.autenticado();
  }

  registrar(datos: DatosRegistroApi): Observable<RespuestaSesion> {
    if (!datos.acepta_privacidad) {
      return throwError(() => new Error('Debes aceptar el aviso de privacidad.'));
    }

    const correo = this.normalizarCorreo(datos.correo);
    const existente = this.usuarios.get(correo);
    if (existente !== undefined && existente.estado_cuenta !== 'SIN_ACCESO') {
      return throwError(() => new Error(MENSAJE_REGISTRO)).pipe(delay(250));
    }

    const usuario: UsuarioLocal = {
      id: existente?.id ?? this.siguienteId++,
      nombre: datos.nombre.trim(),
      apellidos: datos.apellidos.trim(),
      correo,
      telefono: datos.telefono.trim(),
      passwordSimulada: datos.password,
      rol: existente?.rol ?? 'CLIENTE',
      estado_cuenta: 'ACTIVA',
      intentosFallidos: 0,
      bloqueadoHasta: null,
    };
    this.usuarios.set(correo, usuario);

    // Si existía una cuenta SIN_ACCESO se activa conservando su id (§7 M01).
    // El historial real lo conservará Flask.
    const respuesta = this.respuesta(usuario);
    return of(respuesta).pipe(
      delay(250),
      tap((valor) => this.estado.guardarSesion(valor)),
    );
  }

  iniciarSesion(correo: string, contrasena: string): Observable<RespuestaSesion> {
    const usuario = this.usuarios.get(this.normalizarCorreo(correo));
    if (usuario === undefined) {
      return throwError(() => new Error(MENSAJE_CREDENCIALES)).pipe(delay(250));
    }

    if (usuario.bloqueadoHasta !== null && usuario.bloqueadoHasta <= Date.now()) {
      usuario.bloqueadoHasta = null;
      usuario.intentosFallidos = 0;
    }

    if (usuario.bloqueadoHasta !== null) {
      const restantes = Math.ceil((usuario.bloqueadoHasta - Date.now()) / 60000);
      return throwError(
        () => new Error(`Tu cuenta está bloqueada. Intenta de nuevo en ${restantes} minuto(s).`),
      ).pipe(delay(250));
    }

    if (usuario.passwordSimulada !== contrasena) {
      usuario.intentosFallidos += 1;
      if (usuario.intentosFallidos >= INTENTOS_MAXIMOS) {
        usuario.bloqueadoHasta = Date.now() + BLOQUEO_MINUTOS * 60 * 1000;
        usuario.intentosFallidos = 0;
        return throwError(
          () =>
            new Error(`Demasiados intentos fallidos. Tu cuenta se bloqueó ${BLOQUEO_MINUTOS} minutos.`),
        ).pipe(delay(250));
      }
      return throwError(() => new Error(MENSAJE_CREDENCIALES)).pipe(delay(250));
    }

    usuario.intentosFallidos = 0;
    const respuesta = this.respuesta(usuario);
    return of(respuesta).pipe(
      delay(250),
      tap((valor) => this.estado.guardarSesion(valor)),
    );
  }

  refrescar(): Observable<RespuestaSesion> {
    const usuario = this.estado.usuario();
    if (usuario === null || this.estado.token() === null) {
      return throwError(() => new Error('No hay una sesión activa.'));
    }
    const local = this.usuarios.get(usuario.correo);
    const respuesta: RespuestaSesion =
      local !== undefined
        ? this.respuesta(local)
        : {
            access_token: this.estado.token() ?? TOKEN_SESION_SIMULADO,
            usuario,
            expira_en_minutos: 15,
          };
    return of(respuesta).pipe(tap((valor) => this.estado.guardarSesion(valor)));
  }

  /** No existe cookie httpOnly en esta rama: la hidratación no hace nada. */
  hidratar(): Promise<void> {
    return Promise.resolve();
  }

  cerrarSesion(): Observable<MensajeApi> {
    this.estado.limpiar();
    return of({ mensaje: 'Sesión cerrada correctamente.' }).pipe(delay(150));
  }

  recuperar(correo: string): Observable<MensajeApi> {
    // La respuesta es invariable: nunca revela si el correo existe (§7 M01).
    this.recuperaciones.set(TOKEN_RECUPERACION, {
      correo: this.normalizarCorreo(correo),
      expiraEn: Date.now() + VIGENCIA_RECUPERACION_MS,
    });
    return of({ mensaje: MENSAJE_RECUPERACION }).pipe(delay(250));
  }

  restablecer(token: string, contrasena: string): Observable<MensajeApi> {
    if (!this.passwordCumple(contrasena)) {
      return throwError(
        () =>
          new Error(
            'La contraseña necesita 8 caracteres, mayúscula, minúscula, número y símbolo.',
          ),
      ).pipe(delay(250));
    }

    const recuperacion = this.recuperaciones.get(token);
    if (recuperacion === undefined || recuperacion.expiraEn <= Date.now()) {
      this.recuperaciones.delete(token);
      return throwError(() => new Error(MENSAJE_TOKEN)).pipe(delay(250));
    }

    const usuario = this.usuarios.get(recuperacion.correo);
    if (usuario !== undefined) {
      usuario.passwordSimulada = contrasena;
      usuario.intentosFallidos = 0;
      usuario.bloqueadoHasta = null;
    }
    this.recuperaciones.delete(token);
    return of({ mensaje: MENSAJE_RESTABLECIMIENTO }).pipe(delay(250));
  }

  guardarSesion(respuesta: RespuestaSesion): void {
    this.estado.guardarSesion(respuesta);
  }

  cerrarSesionLocal(): void {
    this.estado.limpiar();
  }

  private respuesta(usuario: UsuarioLocal): RespuestaSesion {
    const publico: UsuarioSesion = {
      id: usuario.id,
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      correo: usuario.correo,
      telefono: usuario.telefono,
      rol: usuario.rol,
      estado_cuenta: usuario.estado_cuenta,
    };
    return {
      access_token: TOKEN_SESION_SIMULADO,
      usuario: publico,
      expira_en_minutos: 15,
    };
  }

  private normalizarCorreo(correo: string): string {
    return correo.trim().toLowerCase();
  }

  private passwordCumple(password: string): boolean {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    );
  }
}

/** Contratos de guardia listos para Flask; aún no se enlazan a las rutas del panel. */
export const authGuard: CanActivateFn = (_route, state) => {
  const sesion = inject(AuthSessionService);
  const router = inject(Router);
  return sesion.autenticado
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const roleGuard: CanActivateFn = (route) => {
  const estado = inject(AuthStateService);
  const router = inject(Router);
  const roles = (route.data['roles'] ?? []) as RolUsuario[];
  return estado.puede(roles) ? true : router.createUrlTree(['/sin-acceso']);
};
