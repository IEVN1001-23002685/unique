import { Observable } from 'rxjs';
import type { ProductoCatalogo } from '../modelos/catalogo';

/**
 * Contrato de M03 para la futura API (§9): GET /catalogo?categoria&color&talla&q&disponibles
 * y GET /catalogo/{producto_id}. No hay HttpClient ni llamadas reales en esta etapa:
 * las páginas usan datos simulados tipados y calculan la disponibilidad en memoria.
 */
export interface FiltrosCatalogo {
  categoria: string | null;
  color: string | null;
  talla: string | null;
  rangoPrecio: string | null;
  soloDisponibles: boolean;
  orden: string;
  busqueda: string;
}

export interface PuertoCatalogo {
  listar(filtros: FiltrosCatalogo): Observable<ProductoCatalogo[]>;
  obtenerPorSlug(slug: string): Observable<ProductoCatalogo | undefined>;
}
