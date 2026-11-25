import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { IMAGENES_DISPONIBLES } from './imagenes-recursos';
import type { RecursoImagen } from '../modelos/producto-maestro';

const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp'];
const TAMANO_MAXIMO_BYTES = 2 * 1024 * 1024;

interface ImagenApi {
  id: number;
  color: string | null;
  url: string;
  orden: number;
}

/** Biblioteca de recursos reales del proyecto y subida persistente vía M10. */
@Injectable({ providedIn: 'root' })
export class ImagenesServicio {
  private readonly api = inject(ApiService);
  private readonly cargas = signal<RecursoImagen[]>([]);

  readonly biblioteca = computed<RecursoImagen[]>(() => [
    ...IMAGENES_DISPONIBLES,
    ...this.cargas(),
  ]);
  readonly cargasLocales = this.cargas.asReadonly();

  validarArchivo(archivo: File): string | null {
    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      return 'Formato no permitido. Usa PNG, JPG o WebP.';
    }
    if (archivo.size === 0) {
      return 'El archivo está vacío.';
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      return 'La imagen supera el límite de 2 MB.';
    }
    return null;
  }

  /** Envía el archivo real con FormData; nunca fija Content-Type ni captura datos sensibles. */
  subir(
    archivo: File,
    productoId: number,
    color: string | null,
    orden = 0,
  ): Observable<ImagenApi> {
    const cuerpo = new FormData();
    cuerpo.append('archivo', archivo, archivo.name);
    if (color) {
      cuerpo.append('color', color);
    }
    cuerpo.append('orden', String(orden));
    return this.api.postForm<ImagenApi>(`/productos/${productoId}/imagenes`, cuerpo).pipe(
      map((imagen) => ({
        ...imagen,
        url: imagen.url.startsWith('/') ? imagen.url : `/${imagen.url}`,
      })),
      tap((imagen) =>
        this.cargas.update((recursos) => [
          ...recursos,
          { url: imagen.url, etiqueta: archivo.name, categoria: 'Carga API' },
        ]),
      ),
    );
  }
}
