import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/api/api.service';
import {
  MisPedidosServicio,
  PedidoCliente,
} from '../../mispedidos/servicios/mis-pedidos-servicio';
import {
  EvidenciaCaso,
  LineaDevolucionApi,
  SolicitudCambioDevolucion,
  VarianteCatalogo,
} from '../modelos/cambio-devolucion';

/** Compatibilidad con importaciones existentes del servicio. */
export type {
  DictamenLinea,
  EstadoCaso,
  EtapaMerma,
  EvidenciaCaso,
  LineaDevolucionApi,
  LineaPedidoDevolucion,
  MotivoSolicitud,
  ResolucionCaso,
  SolicitudCambioDevolucion,
  TipoSolicitudCaso,
  VarianteCatalogo,
} from '../modelos/cambio-devolucion';
export {
  CAUSAS_MERMA,
  ETAPAS_MERMA,
  MOTIVOS_SOLICITUD,
  TIPOS_SOLICITUD,
} from '../modelos/cambio-devolucion';

interface DevolucionApi {
  id: number;
  folio: string;
  venta_id: number;
  venta_folio: string | null;
  pedido_id?: number | null;
  tipo: string;
  motivo: string;
  descripcion: string;
  estado: string;
  resolucion: string | null;
  reembolso_monto: string | null;
  motivo_rechazo: string | null;
  creado_en: string;
  recibido_en?: string | null;
  resuelta_en?: string | null;
  resuelta_por?: string | null;
  venta_reemplazo_id?: number | null;
  venta_reemplazo_folio?: string | null;
  lineas: LineaDevolucionApi[];
  evidencias?: Array<{ id?: number; url: string; nombre?: string }> | null;
}

interface ListaPaginada<T> {
  items: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

interface DetalleCatalogoApi {
  variantes: VarianteCatalogo[];
}

export interface DictamenLineaSolicitud {
  devolucion_linea_id: number;
  dictamen: string;
  causa?: string;
  etapa?: string;
}

/** M07: los seis contratos documentados en §9. Flask ejecuta las transacciones. */
@Injectable({ providedIn: 'root' })
export class DevolucionesServicio {
  private readonly api = inject(ApiService);
  private readonly pedidosApi = inject(MisPedidosServicio);

  listar(): Observable<SolicitudCambioDevolucion[]> {
    return this.api
      .get<ListaPaginada<DevolucionApi>>('/devoluciones')
      .pipe(map((respuesta) => respuesta.items.map((item) => this.aCaso(item))));
  }

  pedidosEntregados(): Observable<PedidoCliente[]> {
    // M06 conserva la propiedad del historial; M07 solo lo consulta.
    return this.pedidosApi.listar('ENTREGADOS');
  }

  detallePedido(pedidoId: number): Observable<PedidoCliente> {
    return this.pedidosApi.detalle(pedidoId);
  }

  variantes(productoId: number): Observable<VarianteCatalogo[]> {
    return this.api
      .get<DetalleCatalogoApi>(`/catalogo/${productoId}`)
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
    lineas: DictamenLineaSolicitud[],
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
    const evidencias: EvidenciaCaso[] = (item.evidencias ?? []).map((evidencia, indice) => ({
      id: evidencia.id ?? indice + 1,
      url: evidencia.url,
      nombre: evidencia.nombre ?? `Evidencia ${indice + 1}`,
    }));

    return {
      id: item.id,
      folioCaso: item.folio,
      folioPedido: item.venta_folio ?? '',
      pedidoId: item.pedido_id ?? item.venta_id ?? null,
      tipo: item.tipo === 'CAMBIO' ? 'CAMBIO' : 'DEVOLUCION',
      motivo: item.motivo,
      descripcion: item.descripcion,
      estado: this.aEstado(item.estado),
      resolucion: this.aResolucion(item.resolucion),
      dictamen: item.resolucion ?? item.motivo_rechazo ?? undefined,
      reembolsoMonto: item.reembolso_monto,
      ventaReemplazoFolio: item.venta_reemplazo_folio ?? null,
      motivoRechazo: item.motivo_rechazo,
      creadoEn: item.creado_en,
      recibidoEn: item.recibido_en ?? null,
      resueltaEn: item.resuelta_en ?? null,
      resueltaPor: item.resuelta_por ?? null,
      lineas: item.lineas ?? [],
      evidencias,
    };
  }

  private aEstado(estado: string): SolicitudCambioDevolucion['estado'] {
    const permitidos: SolicitudCambioDevolucion['estado'][] = [
      'SOLICITADA',
      'APROBADA',
      'RECHAZADA',
      'RECIBIDA',
      'RESUELTA',
    ];
    return permitidos.includes(estado as SolicitudCambioDevolucion['estado'])
      ? (estado as SolicitudCambioDevolucion['estado'])
      : 'SOLICITADA';
  }

  private aResolucion(resolucion: string | null): SolicitudCambioDevolucion['resolucion'] {
    if (resolucion === 'REEMBOLSO' || resolucion === 'CAMBIO' || resolucion === 'RECHAZO') {
      return resolucion;
    }
    return null;
  }
}
