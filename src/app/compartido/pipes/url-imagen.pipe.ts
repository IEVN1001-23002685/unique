import { inject, Pipe, PipeTransform } from '@angular/core';
import { ApiConfigService } from '../../core/api/api-config.service';

const ABSOLUTA = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

/**
 * Resuelve las rutas de archivos que devuelve Flask contra el origen configurado de la API.
 * Los recursos locales (`/prendas/...`) y las vistas previas (`blob:`, `data:`) no se tocan.
 */
export function resolverUrlImagen(
  ruta: string | null | undefined,
  apiBaseUrl: string,
): string {
  if (!ruta) {
    return '';
  }
  if (ABSOLUTA.test(ruta) || !/^\/?uploads\//.test(ruta)) {
    return ruta;
  }
  if (!apiBaseUrl) {
    return '';
  }
  const origen = apiBaseUrl.replace(/\/+$/, '').replace(/\/api\/v1\/?$/, '');
  return `${origen}/${ruta.replace(/^\//, '')}`;
}

@Pipe({ name: 'urlImagen' })
export class UrlImagenPipe implements PipeTransform {
  private readonly config = inject(ApiConfigService);

  transform(ruta: string | null | undefined): string {
    return resolverUrlImagen(ruta, this.config.apiBaseUrl());
  }
}
