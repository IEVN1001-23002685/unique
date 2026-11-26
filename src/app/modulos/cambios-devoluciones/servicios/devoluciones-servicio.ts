import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/api/api.service';
import {
  MisPedidosServicio,
  PedidoCliente,
} from '../../mispedidos/servicios/mis-pedidos-servicio';

export type TipoSolicitudCaso = 'DEVOLUCION' | 'CAMBIO';
export type EstadoCaso = 'SOLICITADA' | 'APROBADA' | 'RECHAZADA' | 'RECIBIDA' | 'RESUELTA';

export interface LineaDevolucionApi {
  id: number;
  venta_linea_id: number;
  sku: string | null;
  cantidad: number;
  variante_cambio_id: number | null;
  dictamen: string;
}

export interface SolicitudCambioDevolucion {
  id: number;
  folioCaso: string;
  folioPedido: string;
  pedidoId: number | null;
  tipo: TipoSolicitudCaso;
  prendaResumen: string;
  motivo: string;
  descripcion: string;
  estado: EstadoCaso;
  dictamen?: string;
  reembolsoMonto?: string | null;
  lineas: LineaDevolucionApi[];
}

export interface LineaPedidoDevolucion {
  ventaLineaId: number;
  varianteId: number;
  productoId: number;
  sku: string;
  descripcion: string;
  cantidad: number;
  cantidadSolicitada: number;
  varianteCambioId: number | null;
  opcionesVariante: Array<{ id: number; sku: string; talla: string; color: string }>;
}

export interface VarianteCatalogo {
  id: number;
  sku: string;
  talla: string;
  color: string;
  disponibilidad: string;
  bajo_pedido: boolean;
}

interface DevolucionApi {
  id: number;
  folio: string;
  venta_id: number;
  venta_folio: string | null;
  pedido_id: number | null;
  tipo: string;
  motivo: string;
  descripcion: string;
  estado: string;
  resolucion: string | null;
  reembolso_monto: string | null;
  motivo_rechazo: string | null;
  creado_en: string;
  lineas: LineaDevolucionApi[];
}

interface DetalleCatalogoApi {
  variantes: VarianteCatalogo[];
}

interface ListaPaginada<T> {
  items: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export const TIPOS_SOLICITUD = [
  { valor: 'DEVOLUCION', etiqueta: 'Devolución' },
  { valor: 'CAMBIO', etiqueta: 'Cambio' },
] as const;

export const MOTIVOS_SOLICITUD = [
  { valor: 'DEFECTO', etiqueta: 'Defecto en la prenda' },
  { valor: 'AJUSTE', etiqueta: 'Ajuste de talla' },
  { valor: 'DANO_ENVIO', etiqueta: 'Daño durante el envío' },
  { valor: 'PRODUCTO_EQUIVOCADO', etiqueta: 'Producto equivocado' },
  { valor: 'ARREPENTIMIENTO', etiqueta: 'Arrepentimiento' },
] as const;

/** M07: solicitudes del cliente y bandeja operativa/administrativa. */
@Injectable({ providedIn: 'root' })
export class DevolucionesServicio {
  private readonly api = inject(ApiService);
  private readonly pedidos = inject(MisPedidosServicio);

  listar(): Observable<SolicitudCambioDevolucion[]> {
    return this.api
      .get<ListaPaginada<DevolucionApi>>('/devoluciones')
      .pipe(map((respuesta) => respuesta.items.map((item) => this.aCaso(item))));
  }

  pedidosEntregados(): Observable<PedidoCliente[]> {
    return this.pedidos.listar('ENTREGADOS');
  }

  detallePedido(pedidoId: number): Observable<PedidoCliente> {
    return this.pedidos.detalle(pedidoId);
  }

  variantes(productoId: number): Observable<VarianteCatalogo[]> {
    return this.api
      .get<DetalleCatalogoApi>(`/catalogo/producto/${productoId}`)
      .pipe(map((producto) => producto.variantes));
  }

  crear(cuerpo: Record<string, unknown>, archivos: File[] = []): Observable<SolicitudCambioDevolucion> {
    if (archivos.length === 0) {
      return this.api
        .post<DevolucionApi>('/devoluciones', cuerpo)
        .pipe(map((item) => this.aCaso(item)));
    }
    const datos = new FormData();
    datos.append('datos', new Blob([JSON.stringify(cuerpo)], { type: 'application/json' }));
    archivos.forEach((archivo) => datos.append('evidencias', archivo, archivo.name));
    return this.api
      .postForm<DevolucionApi>('/devoluciones', datos)
      .pipe(map((item) => this.aCaso(item)));
  }

  aprobar(id: number): Observable<SolicitudCambioDevolucion> {
    return this.api
      .patch<DevolucionApi>(`/devoluciones/${id}/aprobar`)
      .pipe(map((item) => this.aCaso(item)));
  }

  rechazar(id: number, motivo: string): Observable<SolicitudCambioDevolucion> {
    return this.api
      .patch<DevolucionApi>(`/devoluciones/${id}/rechazar`, { motivo })
      .pipe(map((item) => this.aCaso(item)));
  }

  recibir(id: number): Observable<SolicitudCambioDevolucion> {
    return this.api
      .post<DevolucionApi>(`/devoluciones/${id}/recibir`)
      .pipe(map((item) => this.aCaso(item)));
  }

  dictaminar(
    id: number,
    lineas: Array<{ devolucion_linea_id: number; dictamen: 'REINGRESO' | 'MERMA' }>,
    descripcion: string,
  ): Observable<SolicitudCambioDevolucion> {
    return this.api
      .post<DevolucionApi>(`/devoluciones/${id}/dictamen`, { lineas, descripcion })
      .pipe(map((item) => this.aCaso(item)));
  }

  resolver(
    id: number,
    resolucion: 'REEMBOLSO' | 'CAMBIO',
  ): Observable<SolicitudCambioDevolucion> {
    return this.api
      .post<DevolucionApi>(`/devoluciones/${id}/resolver`, { resolucion })
      .pipe(map((item) => this.aCaso(item)));
  }

  private aCaso(item: DevolucionApi): SolicitudCambioDevolucion {
    return {
      id: item.id,
      folioCaso: item.folio,
      folioPedido: item.venta_folio ?? '',
      pedidoId: item.pedido_id,
      tipo: item.tipo as TipoSolicitudCaso,
      prendaResumen: item.lineas
        .map((linea) => `${linea.sku ?? 'SKU'} x${linea.cantidad}`)
        .join(', '),
      motivo: item.motivo,
      descripcion: item.descripcion,
      estado: item.estado as EstadoCaso,
      dictamen: item.resolucion ?? item.motivo_rechazo ?? undefined,
      reembolsoMonto: item.reembolso_monto,
      lineas: item.lineas,
    };
  }
}
