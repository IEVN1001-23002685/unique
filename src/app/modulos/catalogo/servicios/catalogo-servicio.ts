import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/api/api.service';
import { CATALOGO_EJEMPLO } from '../datos-simulados/catalogo-ejemplo';
import {
  CodigoColorCatalogo,
  CodigoTallaCatalogo,
  EstadoDisponibilidadCatalogo,
  ProductoCatalogo,
  VarianteCatalogo,
  productoDisponible,
  productoVisible,
} from '../modelos/catalogo';

export interface FiltrosCatalogo {
  categoria: string | null;
  color: string | null;
  talla: string | null;
  soloDisponibles: boolean;
  busqueda: string;
}

/** Origen de los datos mostrados; la interfaz lo explica al visitante. */
export type OrigenCatalogo = 'servidor' | 'cache' | 'demostracion';

export interface RespuestaCatalogo<T> {
  datos: T;
  origen: OrigenCatalogo;
}

interface VarianteApi {
  id: number;
  sku: string;
  talla: string;
  color: string;
  disponibilidad: string;
  bajo_pedido: boolean;
  /** Flask calcula este valor, pero `VarianteDisponibilidadSchema` no lo serializa todavía. */
  comprable?: boolean;
  activa?: boolean;
  fecha_estimada: string | null;
}

interface ProductoApi {
  id: number;
  slug?: string;
  nombre: string;
  descripcion: string;
  descripcion_detalle?: string;
  precio_venta: string;
  categoria: string;
  imagen?: string | null;
  mas_buscado?: boolean;
  vendidos_ultimos_30_dias?: number;
  activo?: boolean;
  imagenes?: Array<{ url: string; color: string | null }>;
  composicion_textil?: string;
  guia_medidas?: string;
  creado_en?: string;
  variantes: VarianteApi[];
}

const ESTADOS: EstadoDisponibilidadCatalogo[] = [
  'Disponible',
  'Pocas unidades',
  'Bajo pedido',
  'Agotado',
];

/** Servicio público de M03. El backend define disponibilidad, precios e imágenes. */
@Injectable({ providedIn: 'root' })
export class CatalogoServicio {
  private readonly api = inject(ApiService);
  private ultimoListado: ProductoCatalogo[] = [];
  private ultimosProductos = new Map<number, ProductoCatalogo>();

  listar(filtros: FiltrosCatalogo): Observable<RespuestaCatalogo<ProductoCatalogo[]>> {
    return this.api
      .get<ProductoApi[]>('/catalogo', {
        params: {
          categoria: filtros.categoria ?? undefined,
          color: filtros.color ?? undefined,
          talla: filtros.talla ?? undefined,
          q: filtros.busqueda.trim() || undefined,
          disponibles: filtros.soloDisponibles ? true : undefined,
        },
      })
      .pipe(
        map((items) => {
          const maxVendidos = Math.max(
            0,
            ...items.map((item) => item.vendidos_ultimos_30_dias ?? 0),
          );
          const datos = items
            .map((item) => this.aProducto(item, maxVendidos))
            .filter(productoVisible);
          this.ultimoListado = datos;
          return { datos, origen: 'servidor' as const };
        }),
        catchError(() => {
          const hayCache = this.ultimoListado.length > 0 && this.origenRespaldo() === 'cache';
          return of({
            datos: this.filtrarDemo(
              hayCache ? this.ultimoListado : CATALOGO_EJEMPLO,
              filtros,
            ),
            origen: (hayCache ? 'cache' : 'demostracion') as OrigenCatalogo,
          });
        }),
      );
  }

  obtener(productoId: number): Observable<RespuestaCatalogo<ProductoCatalogo | undefined>> {
    return this.api.get<ProductoApi>(`/catalogo/${productoId}`).pipe(
      map((item) => {
        const datos = this.aProducto(item);
        if (productoVisible(datos)) {
          this.ultimosProductos.set(productoId, datos);
        }
        return {
          datos: productoVisible(datos) ? datos : undefined,
          origen: 'servidor' as const,
        };
      }),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          return of({ datos: undefined, origen: 'servidor' as const });
        }
        return of(this.respaldoDetalle(productoId));
      }),
    );
  }

  /** Sin servidor se usa la última respuesta o la muestra tipada; nunca se inventa una venta. */
  private respaldoDetalle(productoId: number): RespuestaCatalogo<ProductoCatalogo | undefined> {
    const cached = this.ultimosProductos.get(productoId);
    if (cached && this.origenRespaldo() === 'cache') {
      return { datos: cached, origen: 'cache' };
    }
    const demo = CATALOGO_EJEMPLO.find(
      (producto) => producto.id === productoId && productoVisible(producto),
    );
    return { datos: demo, origen: 'demostracion' };
  }

  private origenRespaldo(): OrigenCatalogo {
    return typeof navigator !== 'undefined' && !navigator.onLine ? 'cache' : 'demostracion';
  }

  private filtrarDemo(
    productos: readonly ProductoCatalogo[],
    filtros: FiltrosCatalogo,
  ): ProductoCatalogo[] {
    const termino = filtros.busqueda.trim().toLocaleLowerCase('es-MX');

    return productos.filter((producto) => {
      if (!productoVisible(producto)) return false;
      if (filtros.categoria && producto.categoria !== filtros.categoria) return false;
      if (
        filtros.color &&
        !producto.variantes.some(
          (variante) => variante.activa && variante.colorCodigo === filtros.color,
        )
      ) {
        return false;
      }
      if (
        filtros.talla &&
        !producto.variantes.some((variante) => variante.activa && variante.talla === filtros.talla)
      ) {
        return false;
      }
      if (filtros.soloDisponibles && !productoDisponible(producto)) return false;
      if (!termino) return true;

      const texto = [
        producto.nombre,
        producto.descripcion,
        producto.categoria,
        ...producto.variantes.map((variante) => variante.sku),
      ]
        .join(' ')
        .toLocaleLowerCase('es-MX');
      return texto.includes(termino);
    });
  }

  private aProducto(item: ProductoApi, maxVendidos = 0): ProductoCatalogo {
    const imagenes = item.imagenes ?? [];
    const vendidos = item.vendidos_ultimos_30_dias ?? 0;
    const masBuscado =
      item.mas_buscado ?? (maxVendidos > 0 && vendidos === maxVendidos);
    const activo = item.activo ?? true;

    return {
      id: item.id,
      slug: item.slug ?? String(item.id),
      nombre: item.nombre,
      descripcion: item.descripcion,
      descripcionDetalle: item.descripcion_detalle || undefined,
      precio: Number(item.precio_venta) || 0,
      categoria: item.categoria,
      imagen: item.imagen ?? imagenes[0]?.url ?? '',
      etiqueta: masBuscado ? 'Más buscado' : undefined,
      masBuscado,
      activo,
      composicion: item.composicion_textil ?? '',
      guiaMedidasTexto: item.guia_medidas || undefined,
      variantes: item.variantes.map((variante) =>
        this.aVariante(variante, imagenes, item.imagen ?? '', activo),
      ),
      creadoEn: item.creado_en ?? '',
    };
  }

  private aVariante(
    item: VarianteApi,
    imagenes: Array<{ url: string; color: string | null }>,
    imagenProducto: string,
    productoActivo: boolean,
  ): VarianteCatalogo {
    const color = this.color(item.color);
    const talla = this.talla(item.talla);
    const disponibilidad = ESTADOS.includes(item.disponibilidad as EstadoDisponibilidadCatalogo)
      ? (item.disponibilidad as EstadoDisponibilidadCatalogo)
      : 'Agotado';
    const activa = productoActivo && (item.activa ?? true);

    return {
      id: item.id,
      sku: item.sku,
      colorCodigo: color,
      colorNombre: this.nombreColor(color),
      talla,
      disponibilidad,
      bajoPedido: item.bajo_pedido && disponibilidad === 'Bajo pedido',
      // `comprable` no está en el esquema público: se deriva de disponibilidad.
      comprable: item.comprable ?? (activa && disponibilidad !== 'Agotado'),
      fechaEstimada: item.fecha_estimada ?? undefined,
      imagen: imagenes.find((imagen) => imagen.color === item.color)?.url ?? imagenProducto,
      activa,
    };
  }

  private color(valor: string): CodigoColorCatalogo {
    return (['BL', 'NG', 'GR', 'NA'].includes(valor) ? valor : 'NA') as CodigoColorCatalogo;
  }

  private talla(valor: string): CodigoTallaCatalogo {
    return (['CH', 'MD', 'GD', 'UN'].includes(valor) ? valor : 'UN') as CodigoTallaCatalogo;
  }

  private nombreColor(codigo: CodigoColorCatalogo): string {
    const nombres: Record<CodigoColorCatalogo, string> = {
      BL: 'Blanco',
      NG: 'Negro',
      GR: 'Gris',
      NA: 'No aplica',
    };
    return nombres[codigo];
  }
}
