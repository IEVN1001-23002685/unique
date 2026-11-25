import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, firstValueFrom, Observable, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStateService, RespuestaSesion, RolUsuario, UsuarioSesion } from './auth-state.service';

export type { RolUsuario, UsuarioSesion, RespuestaSesion } from './auth-state.service';

export interface DatosRegistroApi {
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  password: string;
  acepta_promociones: boolean;
}

export interface MensajeApi {
  mensaje: string;
}

/** Servicio de sesión: única puerta para login, registro, refresco y logout. */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly http = inject(HttpClient);
  private readonly estado = inject(AuthStateService);
  private readonly base = environment.apiBaseUrl.replace(/\/$/, '');

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
      .post<RespuestaSesion>(`${this.base}/auth/refrescar`, {}, { withCredentials: true })
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
      .post<MensajeApi>(`${this.base}/auth/logout`, {}, { withCredentials: true })
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
