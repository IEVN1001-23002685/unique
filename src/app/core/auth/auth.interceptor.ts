import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStateService, RespuestaSesion } from './auth-state.service';

const RUTAS_SIN_REFRESCO = ['/auth/login', '/auth/registro', '/auth/refrescar'];

function conCredenciales(req: HttpRequest<unknown>, token: string | null) {
  return req.clone({
    withCredentials: true,
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** Adjunta el access token y refresca la sesión una sola vez ante un 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const estado = inject(AuthStateService);
  const backend = inject(HttpBackend);
  const clienteSinInterceptores = new HttpClient(backend);
  const omitirRefresco =
    RUTAS_SIN_REFRESCO.some((ruta) => req.url.includes(ruta)) ||
    req.headers.has('X-Skip-Auth-Refresh');

  return next(conCredenciales(req, estado.token())).pipe(
    catchError((error: unknown) => {
      const es401 = error instanceof HttpErrorResponse && error.status === 401;
      if (!es401 || omitirRefresco) {
        return throwError(() => error);
      }

      return clienteSinInterceptores
        .post<RespuestaSesion>(
          `${environment.apiBaseUrl.replace(/\/$/, '')}/auth/refrescar`,
          {},
          { withCredentials: true },
        )
        .pipe(
          tap((respuesta) => estado.guardarSesion(respuesta)),
          switchMap(() => next(conCredenciales(req, estado.token()))),
          catchError(() => {
            estado.limpiar();
            return throwError(() => error);
          }),
        );
    }),
  );
};
