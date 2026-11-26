import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ValorParametro = string | number | boolean | null | undefined;

export interface OpcionesApi {
  params?: Record<string, ValorParametro>;
  headers?: Record<string, string>;
  idempotencyKey?: string;
}

/** Cliente HTTP único del frontend. Todas las rutas se resuelven bajo /api/v1. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl.replace(/\/$/, '');

  get<T>(path: string, opciones: OpcionesApi = {}): Observable<T> {
    return this.http.get<T>(this.url(path), {
      params: this.params(opciones.params),
      headers: this.headers(opciones),
      withCredentials: true,
    });
  }

  getBlob(path: string, opciones: OpcionesApi = {}): Observable<Blob> {
    return this.http.get(this.url(path), {
      params: this.params(opciones.params),
      headers: this.headers(opciones),
      withCredentials: true,
      responseType: 'blob',
    });
  }

  getText(path: string, opciones: OpcionesApi = {}): Observable<string> {
    return this.http.get(this.url(path), {
      params: this.params(opciones.params),
      headers: this.headers(opciones),
      withCredentials: true,
      responseType: 'text',
    });
  }

  post<T>(path: string, body: unknown = {}, opciones: OpcionesApi = {}): Observable<T> {
    return this.http.post<T>(this.url(path), body, {
      params: this.params(opciones.params),
      headers: this.headers(opciones),
      withCredentials: true,
    });
  }

  postForm<T>(path: string, body: FormData, opciones: OpcionesApi = {}): Observable<T> {
    return this.http.post<T>(this.url(path), body, {
      params: this.params(opciones.params),
      headers: this.headers(opciones),
      withCredentials: true,
    });
  }

  put<T>(path: string, body: unknown, opciones: OpcionesApi = {}): Observable<T> {
    return this.http.put<T>(this.url(path), body, {
      params: this.params(opciones.params),
      headers: this.headers(opciones),
      withCredentials: true,
    });
  }

  patch<T>(path: string, body: unknown = {}, opciones: OpcionesApi = {}): Observable<T> {
    return this.http.patch<T>(this.url(path), body, {
      params: this.params(opciones.params),
      headers: this.headers(opciones),
      withCredentials: true,
    });
  }

  delete<T>(path: string, opciones: OpcionesApi = {}): Observable<T> {
    return this.http.delete<T>(this.url(path), {
      params: this.params(opciones.params),
      headers: this.headers(opciones),
      withCredentials: true,
    });
  }

  private url(path: string): string {
    return `${this.base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private params(valores: Record<string, ValorParametro> | undefined): HttpParams {
    let resultado = new HttpParams();
    Object.entries(valores ?? {}).forEach(([clave, valor]) => {
      if (valor !== null && valor !== undefined && valor !== '') {
        resultado = resultado.set(clave, String(valor));
      }
    });
    return resultado;
  }

  private headers(opciones: OpcionesApi): HttpHeaders {
    let resultado = new HttpHeaders();
    Object.entries(opciones.headers ?? {}).forEach(([clave, valor]) => {
      resultado = resultado.set(clave, valor);
    });
    if (opciones.idempotencyKey) {
      resultado = resultado.set('Idempotency-Key', opciones.idempotencyKey);
    }
    return resultado;
  }
}
