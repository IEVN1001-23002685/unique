import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ValorParametro } from '../../../core/api/api.service';

/** Cliente usado por el paquete M18–M22; delega en el cliente HTTP canónico. */
@Injectable({ providedIn: 'root' })
export class ApiAdminService {
  private readonly api = inject(ApiService);

  get<T>(path: string, params?: Record<string, ValorParametro>): Observable<T> {
    return this.api.get<T>(path, { params });
  }

  getBlob(path: string, params?: Record<string, ValorParametro>): Observable<Blob> {
    return this.api.getBlob(path, { params });
  }

  getText(path: string, params?: Record<string, ValorParametro>): Observable<string> {
    return this.api.getText(path, { params });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.api.post<T>(path, body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.api.put<T>(path, body);
  }

  patch<T>(path: string, body: unknown = {}): Observable<T> {
    return this.api.patch<T>(path, body);
  }

  delete<T>(path: string): Observable<T> {
    return this.api.delete<T>(path);
  }
}
