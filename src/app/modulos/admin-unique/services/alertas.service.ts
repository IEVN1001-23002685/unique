import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ValorParametro } from '../../../core/api/api.service';
import { ApiAdminService } from './api-admin.service';
import {
  AccionAlerta,
  Alerta,
  Pagina,
  ParametrosLista,
  ReglaAlerta,
} from './ui-admin.models';

export interface FiltrosAlerta extends ParametrosLista {
  estado?: string;
  tipo?: string;
  severidad?: string;
}

export interface RespuestaAccionAlerta {
  alerta: Alerta;
  accion: AccionAlerta;
  resultado: unknown;
}

const ACCIONES_SUGERIDAS: Record<string, AccionAlerta> = {
  PT_AGOTADO_DEMANDA: 'GENERAR_PRODUCCION',
  PT_STOCK_MINIMO: 'GENERAR_PRODUCCION',
  MP_INSUFICIENTE: 'GENERAR_REQUISICION',
  MP_REORDEN: 'GENERAR_REQUISICION',
  ORDEN_ROJA: 'GENERAR_REQUISICION',
  OC_RETRASADA: 'GENERAR_REQUISICION',
  PROVEEDOR_EN_REVISION: 'EVALUAR_PROVEEDOR',
};

/** M21: única puerta HTTP de alertas, acciones y reglas. */
@Injectable({ providedIn: 'root' })
export class AlertasService {
  private readonly api = inject(ApiAdminService);

  private params(filtros: FiltrosAlerta): Record<string, ValorParametro> {
    return {
      estado: filtros.estado,
      tipo: filtros.tipo,
      severidad: filtros.severidad,
      pagina: filtros.pagina,
      por_pagina: filtros.por_pagina,
    };
  }

  listar(filtros: FiltrosAlerta = {}): Observable<Pagina<Alerta>> {
    return this.api.get<Pagina<Alerta>>('/alertas', this.params(filtros));
  }

  resueltas(filtros: FiltrosAlerta = {}): Observable<Pagina<Alerta>> {
    return this.api.get<Pagina<Alerta>>('/alertas/resueltas', {
      ...this.params(filtros),
      estado: undefined,
    });
  }

  reglas(): Observable<ReglaAlerta[]> {
    return this.api.get<ReglaAlerta[]>('/alertas/reglas');
  }

  actualizarReglas(reglas: { clave: string; valor: string }[]): Observable<ReglaAlerta[]> {
    return this.api.patch<ReglaAlerta[]>('/alertas/reglas', { reglas });
  }

  ejecutarAccion(
    alertaId: number,
    accion: AccionAlerta,
    nota?: string,
  ): Observable<RespuestaAccionAlerta> {
    return this.api.post<RespuestaAccionAlerta>(`/alertas/${alertaId}/accion`, {
      accion,
      nota: nota || null,
    });
  }

  accionSugerida(alerta: Alerta): AccionAlerta {
    return ACCIONES_SUGERIDAS[alerta.tipo] ?? 'ATENDER';
  }
}
