import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ValorParametro } from '../../../core/api/api.service';
import { ApiAdminService } from './api-admin.service';
import {
  Entrega,
  Pagina,
  ParametrosLista,
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

  porAsignar(
    filtros: { codigo_postal?: string } & ParametrosLista = {},
  ): Observable<Pagina<PedidoPorAsignar>> {
    return this.api.get<Pagina<PedidoPorAsignar>>('/entregas/por-asignar', { ...filtros });
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

  productosRepartidos(
    filtros: { repartidor?: number; desde?: string; hasta?: string } & ParametrosLista = {},
  ): Observable<Pagina<ProductoRepartido>> {
    return this.api.get<Pagina<ProductoRepartido>>('/entregas/productos-repartidos', { ...filtros });
  }

  listarRepartidores(
    filtros: { activo?: boolean } & ParametrosLista = {},
  ): Observable<Pagina<Repartidor>> {
    return this.api.get<Pagina<Repartidor>>('/repartidores', { ...filtros });
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
