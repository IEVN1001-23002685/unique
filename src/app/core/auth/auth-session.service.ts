import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, firstValueFrom, Observable, of, tap, throwError } from 'rxjs';
import { ApiConfigService } from '../api/api-config.service';
import { AuthStateService, RespuestaSesion, RolUsuario, UsuarioSesion } from './auth-state.service';

export type { RolUsuario, UsuarioSesion, RespuestaSesion } from './auth-state.service';

export interface DatosRegistroApi {
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  password: string;
  /** Nombre pendiente de confirmar contra Flask; §7 M01 lo exige como obligatorio. */
  acepta_privacidad: boolean;
  acepta_promociones: boolean;
}

export interface MensajeApi {
  mensaje: string;
}

/** Doble envío CSRF de flask-jwt-extended; se usa solo cuando el backend lo habilita. */
export function cabeceraCsrf(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const prefijo = 'csrf_refresh_token=';
  const cookie = document.cookie.split('; ').find((parte) => parte.startsWith(prefijo));
  return cookie ? { 'X-CSRF-TOKEN': decodeURIComponent(cookie.slice(prefijo.length)) } : {};
}

/** Servicio de sesión: única puerta para login, registro, refresco y logout. */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly http = inject(HttpClient);
  private readonly estado = inject(AuthStateService);
  private readonly config = inject(ApiConfigService);

  private get base(): string {
    const base = this.config.apiBaseUrl();
    if (!base) {
      throw new Error('La URL de la API no está configurada.');
    }
    return base;
  }

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
    return this.http
      .post<RespuestaSesion>(`${this.base}/auth/registro`, datos, { withCredentials: true })
      .pipe(tap((respuesta) => this.estado.guardarSesion(respuesta)));
  }

  iniciarSesion(correo: string, password: string): Observable<RespuestaSesion> {
    return this.http
      .post<RespuestaSesion>(`${this.base}/auth/login`, { correo, password }, { withCredentials: true })
      .pipe(tap((respuesta) => this.estado.guardarSesion(respuesta)));
  }

  refrescar(): Observable<RespuestaSesion> {
    return this.http
      .post<RespuestaSesion>(`${this.base}/auth/refrescar`, {}, {
        withCredentials: true,
        headers: cabeceraCsrf(),
      })
      .pipe(
        tap((respuesta) => this.estado.guardarSesion(respuesta)),
        catchError((error: unknown) => {
          this.estado.limpiar();
          return throwError(() => error);
        }),
      );
  }

  /** Recupera la sesión desde la cookie httpOnly al cargar la aplicación. */
  async hidratar(): Promise<void> {
    await firstValueFrom(this.refrescar().pipe(catchError(() => of(null))));
  }

  cerrarSesion(): Observable<MensajeApi> {
    return this.http
      .post<MensajeApi>(`${this.base}/auth/logout`, {}, {
        withCredentials: true,
        headers: cabeceraCsrf(),
      })
      .pipe(
        catchError(() => of({ mensaje: 'Sesión cerrada localmente' })),
        tap(() => this.estado.limpiar()),
      );
  }

  recuperar(correo: string): Observable<MensajeApi> {
    return this.http.post<MensajeApi>(`${this.base}/auth/recuperar`, { correo }, {
      withCredentials: true,
    });
  }

  restablecer(token: string, password: string): Observable<MensajeApi> {
    return this.http.post<MensajeApi>(`${this.base}/auth/restablecer`, { token, password }, {
      withCredentials: true,
    });
  }

  guardarSesion(respuesta: RespuestaSesion): void {
    this.estado.guardarSesion(respuesta);
  }

  cerrarSesionLocal(): void {
    this.estado.limpiar();
  }
}

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
