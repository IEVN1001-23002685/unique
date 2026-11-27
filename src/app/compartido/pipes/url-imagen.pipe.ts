import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../../environments/environment';

const ABSOLUTA = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

/**
 * Resuelve las rutas de archivos que devuelve Flask contra el origen de la API.
 *
 * Las imágenes semilla del frontend (`/prendas/...`) y las vistas previas
 * (`blob:`, `data:`) se dejan intactas; solo se reescriben las rutas públicas
 * `/uploads/...` que M10 guarda en el servidor. Así el mismo componente sirve
 * para el entorno local (`localhost:8001`) y el de producción.
 */
@Pipe({ name: 'urlImagen' })
export class UrlImagenPipe implements PipeTransform {
  transform(ruta: string | null | undefined): string {
    if (!ruta) {
      return '';
    }
    if (ABSOLUTA.test(ruta) || !/^\/?uploads\//.test(ruta)) {
      return ruta;
    }
    const origen = environment.apiBaseUrl
      .replace(/\/+$/, '')
      .replace(/\/api\/v1\/?$/, '');
    return `${origen}/${ruta.replace(/^\//, '')}`;
  }
}
