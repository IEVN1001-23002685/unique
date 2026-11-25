import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ValorParametro } from '../../../core/api/api.service';
import { ApiAdminService } from './api-admin.service';
import {
  IncidenciaPreparacion,
  LineaPreparacionActualizar,
  Pagina,
  ParametrosLista,
  Preparacion,
} from './ui-admin.models';

/** M18: única puerta HTTP de preparación, verificación y empaque. */
@Injectable({ providedIn: 'root' })
export class PreparacionService {
  private readonly api = inject(ApiAdminService);

  cola(estado?: string, parametros: ParametrosLista = {}): Observable<Pagina<Preparacion>> {
    const params: Record<string, ValorParametro> = { ...parametros };
    if (estado) params['estado'] = estado;
    return this.api.get<Pagina<Preparacion>>('/preparacion/cola', params);
  }

  tomar(pedidoId: number): Observable<Preparacion> {
    return this.api.post<Preparacion>(`/preparacion/${pedidoId}/tomar`, {});
  }

  actualizarLineas(
    preparacionId: number,
    lineas: LineaPreparacionActualizar[],
  ): Observable<Preparacion> {
    return this.api.patch<Preparacion>(`/preparacion/${preparacionId}/lineas`, { lineas });
  }

  registrarIncidencia(
    preparacionId: number,
    incidencia: IncidenciaPreparacion,
  ): Observable<Preparacion> {
    return this.api.post<Preparacion>(`/preparacion/${preparacionId}/incidencia`, incidencia);
  }

  empacar(preparacionId: number): Observable<Preparacion> {
    return this.api.post<Preparacion>(`/preparacion/${preparacionId}/empacar`, {});
  }

  etiqueta(preparacionId: number): Observable<Blob> {
    return this.api.getBlob(`/preparacion/${preparacionId}/etiqueta`);
  }
}
