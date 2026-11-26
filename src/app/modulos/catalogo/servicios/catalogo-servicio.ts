import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/api/api.service';
import {
  CodigoColorCatalogo,
  CodigoTallaCatalogo,
  EstadoDisponibilidadCatalogo,
  ProductoCatalogo,
  VarianteCatalogo,
} from '../modelos/catalogo';

export interface FiltrosCatalogo {
  categoria: string | null;
  color: string | null;
  talla: string | null;
  soloDisponibles: boolean;
  busqueda: string;
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
  fecha_estimada: string | null;
}

interface ProductoApi {
  id: number;
  nombre: string;
  descripcion: string;
  precio_venta: string;
  categoria: string;
  imagen?: string | null;
  mas_buscado?: boolean;
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

  listar(filtros: FiltrosCatalogo): Observable<ProductoCatalogo[]> {
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
      .pipe(map((items) => items.map((item) => this.aProducto(item))));
  }

  obtener(productoId: number): Observable<ProductoCatalogo> {
    return this.api
      .get<ProductoApi>(`/catalogo/${productoId}`)
      .pipe(map((item) => this.aProducto(item)));
  }

  private aProducto(item: ProductoApi): ProductoCatalogo {
    const imagenes = item.imagenes ?? [];
    return {
      id: item.id,
      slug: String(item.id),
      nombre: item.nombre,
      descripcion: item.descripcion,
      descripcionDetalle: undefined,
      precio: Number(item.precio_venta),
      categoria: item.categoria,
      imagen: item.imagen ?? imagenes[0]?.url ?? '',
      etiqueta: item.mas_buscado ? 'Más buscado' : undefined,
      masBuscado: !!item.mas_buscado,
      activo: item.activo ?? true,
      composicion: item.composicion_textil ?? '',
      guiaMedidasTexto: item.guia_medidas || undefined,
      variantes: item.variantes.map((variante) =>
        this.aVariante(variante, imagenes, item.imagen ?? ''),
      ),
      creadoEn: item.creado_en ?? '',
    };
  }

  private aVariante(
    item: VarianteApi,
    imagenes: Array<{ url: string; color: string | null }>,
    imagenProducto: string,
  ): VarianteCatalogo {
    const color = this.color(item.color);
    const talla = this.talla(item.talla);
    return {
      id: item.id,
      sku: item.sku,
      colorCodigo: color,
      colorNombre: this.nombreColor(color),
      talla,
      disponibilidad: ESTADOS.includes(item.disponibilidad as EstadoDisponibilidadCatalogo)
        ? (item.disponibilidad as EstadoDisponibilidadCatalogo)
        : 'Agotado',
      bajoPedido: item.bajo_pedido,
      // El esquema público no expone `comprable`; toda variante publicada con
      // disponibilidad distinta de "Agotado" es adquirible según el backend.
      comprable: item.comprable ?? item.disponibilidad !== 'Agotado',
      fechaEstimada: item.fecha_estimada ?? undefined,
      imagen: imagenes.find((imagen) => imagen.color === item.color)?.url ?? imagenProducto,
      activa: true,
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
