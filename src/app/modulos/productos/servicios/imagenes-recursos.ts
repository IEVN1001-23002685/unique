import { IMAGENES_OFICIALES } from '../../../nucleo/datos/catalogo-oficial';
import type { RecursoImagen } from '../modelos/producto-maestro';

/** Únicos recursos de imagen presentes en `public/prendas`, para lectura. */
export const IMAGENES_DISPONIBLES: RecursoImagen[] = IMAGENES_OFICIALES.map((recurso) => ({
  url: recurso.url,
  etiqueta: recurso.etiqueta,
  categoria: recurso.categoria,
}));
