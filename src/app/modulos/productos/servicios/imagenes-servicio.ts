import { Injectable, computed, signal } from '@angular/core';
import { IMAGENES_DISPONIBLES } from '../datos-simulados/productos-maestro';
import type { RecursoImagen } from '../modelos/producto-maestro';

/** Tipos de archivo y tamaño máximo aceptados en la carga local de demostración. */
const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp'];
const TAMANO_MAXIMO_BYTES = 2 * 1024 * 1024;

/**
 * Biblioteca de imágenes de M10. Las imágenes cargadas por el usuario viven
 * solo en memoria (data URL) y nunca se envían a un servidor; Flask deberá
 * exponer el endpoint de subida real cuando se integre.
 */
@Injectable({
  providedIn: 'root',
})
export class ImagenesServicio {
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
      return 'La imagen supera el límite de 2 MB de la demostración.';
    }
    return null;
  }

  registrar(dataUrl: string, etiqueta: string, categoria: string): void {
    if (dataUrl === '' || this.biblioteca().some((recurso) => recurso.url === dataUrl)) {
      return;
    }
    this.cargas.update((recursos) => [...recursos, { url: dataUrl, etiqueta, categoria }]);
  }

  eliminarCarga(url: string): void {
    this.cargas.update((recursos) => recursos.filter((recurso) => recurso.url !== url));
  }
}
