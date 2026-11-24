import { Injectable, inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';

export type RolUsuario = 'CLIENTE' | 'OPERATIVO' | 'ADMIN';
export interface SesionUsuario { id: number; nombre: string; correo: string; rol: RolUsuario; }

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly tokenKey = 'unique_access_token';
  private readonly userKey = 'unique_user';
  get token(): string | null { return localStorage.getItem(this.tokenKey); }
  get usuario(): SesionUsuario | null {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) return null;
    try { return JSON.parse(raw) as SesionUsuario; } catch { return null; }
  }
  get autenticado(): boolean { return !!this.token && !!this.usuario; }
  guardarSesion(token: string, usuario: SesionUsuario): void {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(usuario));
  }
  cerrarSesion(): void { localStorage.removeItem(this.tokenKey); localStorage.removeItem(this.userKey); }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('unique_access_token');
  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(request);
};

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthSessionService); const router = inject(Router);
  if (auth.autenticado) return true;
  return router.createUrlTree(['/login-admin'], { queryParams: { returnUrl: state.url } });
};

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthSessionService); const router = inject(Router);
  const allowed = (route.data['roles'] ?? []) as RolUsuario[];
  const role = auth.usuario?.rol;
  return !allowed.length || (role && allowed.includes(role)) ? true : router.createUrlTree(['/sin-acceso-admin']);
};
