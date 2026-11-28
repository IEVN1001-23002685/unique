import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Configuración de ejecución Servidor→Cliente. Nunca contiene secretos. */
interface RuntimeConfig {
  apiBaseUrl?: unknown;
}

/**
 * Única fuente de la URL de la API.
 *
 * En desarrollo se usa `environment.ts` (`http://localhost:8001/api/v1`). En producción
 * Nginx genera `/runtime-config.json` desde `API_BASE_URL` al arrancar y este servicio
 * lo carga antes de cualquier petición HTTP mediante `provideAppInitializer`.
 */
@Injectable({ providedIn: 'root' })
export class ApiConfigService {
  private readonly valor = signal(environment.apiBaseUrl ?? '');
  readonly apiBaseUrl = this.valor.asReadonly();
  readonly error = signal('');
  readonly listo = signal(false);

  async cargar(): Promise<void> {
    if (!environment.production && this.valor()) {
      this.listo.set(true);
      return;
    }

    try {
      const respuesta = await fetch('/runtime-config.json', { cache: 'no-store' });
      if (!respuesta.ok) {
        throw new Error(`HTTP ${respuesta.status}`);
      }
      const datos = (await respuesta.json()) as RuntimeConfig;
      const url = typeof datos.apiBaseUrl === 'string' ? datos.apiBaseUrl.trim().replace(/\/+$/, '') : '';
      const segura =
        /^https:\/\//.test(url) || /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//.test(url);
      if (!segura || !url.endsWith('/api/v1')) {
        throw new Error('API_BASE_URL inválida');
      }
      this.valor.set(url);
      this.error.set('');
    } catch {
      this.valor.set('');
      this.error.set(
        'No fue posible cargar la configuración de la API. Recarga la página o contacta al administrador.',
      );
    } finally {
      this.listo.set(true);
    }
  }
}
