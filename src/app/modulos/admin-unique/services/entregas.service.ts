import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ValorParametro } from '../../../core/api/api.service';
import { ApiAdminService } from './api-admin.service';
import {
  Entrega,
  Pagina,
  PedidoPorAsignar,
  ProductoRepartido,
  Repartidor,
} from './ui-admin.models';

export interface DatosAsignarEntrega {
  pedido_id: number;
  repartidor_id: number;
  fecha_programada: string;
  notas?: string;
}

export interface DatosResultadoEntrega {
  entregado: boolean;
  receptor?: string | null;
  motivo_fallo?: string | null;
  notas?: string | null;
}

/** M19: única puerta HTTP de entregas, hojas de reparto y repartidores. */
@Injectable({ providedIn: 'root' })
export class EntregasService {
  private readonly api = inject(ApiAdminService);

  /** `PorAsignarFiltrosSchema` solo admite `codigo_postal` (5 dígitos). */
  porAsignar(filtros: { codigo_postal?: string } = {}): Observable<Pagina<PedidoPorAsignar>> {
    const params: Record<string, ValorParametro> = {};
    if (filtros.codigo_postal) params['codigo_postal'] = filtros.codigo_postal;
    return this.api.get<Pagina<PedidoPorAsignar>>('/entregas/por-asignar', params);
  }

  asignar(datos: DatosAsignarEntrega): Observable<Entrega> {
    return this.api.post<Entrega>('/entregas', datos);
  }

  salida(entregaId: number): Observable<Entrega> {
    return this.api.post<Entrega>(`/entregas/${entregaId}/salida`, {});
  }

  resultado(entregaId: number, datos: DatosResultadoEntrega): Observable<Entrega> {
    return this.api.post<Entrega>(`/entregas/${entregaId}/resultado`, datos);
  }

  hojaReparto(repartidorId: number, fecha: string): Observable<Blob> {
    return this.api.getBlob('/entregas/hoja-reparto', {
      repartidor: repartidorId,
      fecha,
    });
  }

  /** `RepartidosFiltrosSchema` solo admite `repartidor`, `desde` y `hasta`. */
  productosRepartidos(
    filtros: { repartidor?: number; desde?: string; hasta?: string } = {},
  ): Observable<Pagina<ProductoRepartido>> {
    const params: Record<string, ValorParametro> = {
      repartidor: filtros.repartidor,
      desde: filtros.desde,
      hasta: filtros.hasta,
    };
    return this.api.get<Pagina<ProductoRepartido>>('/entregas/productos-repartidos', params);
  }

  /** `RepartidorFiltrosSchema` solo admite `activo`. */
  listarRepartidores(filtros: { activo?: boolean } = {}): Observable<Pagina<Repartidor>> {
    const params: Record<string, ValorParametro> = {};
    if (filtros.activo !== undefined) params['activo'] = filtros.activo;
    return this.api.get<Pagina<Repartidor>>('/repartidores', params);
  }

  crearRepartidor(datos: {
    nombre: string;
    telefono: string;
    vehiculo?: string | null;
  }): Observable<Repartidor> {
    return this.api.post<Repartidor>('/repartidores', datos);
  }

  actualizarRepartidor(
    id: number,
    datos: Partial<{ nombre: string; telefono: string; vehiculo: string | null; activo: boolean }>,
  ): Observable<Repartidor> {
    return this.api.patch<Repartidor>(`/repartidores/${id}`, datos);
  }

  desactivarRepartidor(id: number): Observable<void> {
    return this.api.delete<void>(`/repartidores/${id}`);
  }
}
