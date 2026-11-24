import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// Flask implementa estos endpoints. Angular no contiene datos de negocio simulados.
@Injectable({ providedIn: 'root' })
export class ApiAdminService {
  private http = inject(HttpClient);
  private base = 'http://127.0.0.1:5000/api';
  get<T>(path: string, params?: Record<string, string | number>): Observable<T> {
    let httpParams = new HttpParams();
    Object.entries(params ?? {}).forEach(([k, v]) => (httpParams = httpParams.set(k, String(v))));
    return this.http.get<T>(`${this.base}${path}`, { params: httpParams });
  }
  getBlob(path: string, params?: Record<string, string | number>): Observable<Blob> {
    let httpParams = new HttpParams();
    Object.entries(params ?? {}).forEach(([k, v]) => (httpParams = httpParams.set(k, String(v))));
    return this.http.get(`${this.base}${path}`, { params: httpParams, responseType: 'blob' });
  }
  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body);
  }
  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.base}${path}`, body);
  }
  patch<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.patch<T>(`${this.base}${path}`, body);
  }
  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.base}${path}`);
  }
}
