import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  catchError,
  finalize,
  Observable,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ApiConfigService } from '../api/api-config.service';
import { AuthSessionService, cabeceraCsrf } from './auth-session.service';
import { AuthStateService, RespuestaSesion } from './auth-state.service';

const RUTAS_SIN_REFRESCO = ['/auth/login', '/auth/registro', '/auth/refrescar', '/auth/logout'];
const CABECERA_REINTENTO = 'X-Auth-Refresco-Intentado';

/** Renovación compartida: una sola petición de refresco para todas las respuestas 401 simultáneas. */
let refrescoEnCurso: Observable<RespuestaSesion> | null = null;

function conCredenciales(req: HttpRequest<unknown>, token: string | null) {
  return req.clone({
    withCredentials: true,
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function renovar(
  cliente: HttpClient,
  sesion: AuthSessionService,
  base: string,
): Observable<RespuestaSesion> {
  return cliente
    .post<RespuestaSesion>(
      `${base}/auth/refrescar`,
      {},
      { withCredentials: true, headers: cabeceraCsrf() },
    )
    .pipe(
      tap((respuesta) => sesion.guardarSesion(respuesta)),
      catchError((error: unknown) => {
        sesion.cerrarSesionLocal();
        return throwError(() => error);
      }),
      finalize(() => {
        refrescoEnCurso = null;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
}

/** Adjunta el access token y comparte una única renovación entre las peticiones que reciben 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const estado = inject(AuthStateService);
  const sesion = inject(AuthSessionService);
  const config = inject(ApiConfigService);
  const backend = inject(HttpBackend);
  const clienteSinInterceptores = new HttpClient(backend);
  const omitirRefresco =
    RUTAS_SIN_REFRESCO.some((ruta) => req.url.includes(ruta)) ||
    req.headers.has('X-Skip-Auth-Refresh') ||
    req.headers.has(CABECERA_REINTENTO);

  return next(conCredenciales(req, estado.token())).pipe(
    catchError((error: unknown) => {
      const es401 = error instanceof HttpErrorResponse && error.status === 401;
      if (!es401 || omitirRefresco) {
        return throwError(() => error);
      }

      const base = config.apiBaseUrl();
      if (!base) {
        sesion.cerrarSesionLocal();
        return throwError(() => new Error('La URL de la API no está configurada.'));
      }
      const refresco =
        refrescoEnCurso ?? (refrescoEnCurso = renovar(clienteSinInterceptores, sesion, base));
      const reintento = req.clone({ setHeaders: { [CABECERA_REINTENTO]: '1' } });
      return refresco.pipe(switchMap(() => next(conCredenciales(reintento, estado.token()))));
    }),
  );
};
