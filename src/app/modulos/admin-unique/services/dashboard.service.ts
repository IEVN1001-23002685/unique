import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ValorParametro } from '../../../core/api/api.service';
import { ApiAdminService } from './api-admin.service';
import {
  DashboardAbastecimiento,
  DashboardLogistica,
  DashboardProduccion,
  DashboardResumen,
  DashboardVentas,
} from './ui-admin.models';

export interface FiltrosDashboard {
  desde?: string;
  hasta?: string;
}

/** Acepta solo fechas locales YYYY-MM-DD; nunca ISO con hora ni zona. */
function diaValido(valor: string | null | undefined): string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return '';
  return Number.isNaN(new Date(`${valor}T00:00:00`).getTime()) ? '' : valor;
}

/** M20: única puerta HTTP del dashboard; conserva el periodo entre pestañas. */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiAdminService);
  private readonly periodo = signal<{ desde: string; hasta: string }>({ desde: '', hasta: '' });

  readonly desde = computed(() => this.periodo().desde);
  readonly hasta = computed(() => this.periodo().hasta);
  readonly filtros = computed<FiltrosDashboard>(() => ({
    desde: this.desde() || undefined,
    hasta: this.hasta() || undefined,
  }));

  establecerPeriodo(desde: string | null | undefined, hasta: string | null | undefined): void {
    const inicio = diaValido(desde);
    let fin = diaValido(hasta);
    if (inicio && fin && fin < inicio) fin = inicio;
    this.periodo.set({ desde: inicio, hasta: fin });
  }

  limpiarPeriodo(): void {
    this.periodo.set({ desde: '', hasta: '' });
  }

  private params(filtros: FiltrosDashboard = this.filtros()): Record<string, ValorParametro> {
    return { desde: filtros.desde, hasta: filtros.hasta };
  }

  resumen(filtros?: FiltrosDashboard): Observable<DashboardResumen> {
    return this.api.get<DashboardResumen>('/dashboard/resumen', this.params(filtros));
  }

  ventas(filtros?: FiltrosDashboard): Observable<DashboardVentas> {
    return this.api.get<DashboardVentas>('/dashboard/ventas', this.params(filtros));
  }

  produccion(filtros?: FiltrosDashboard): Observable<DashboardProduccion> {
    return this.api.get<DashboardProduccion>('/dashboard/produccion', this.params(filtros));
  }

  abastecimiento(filtros?: FiltrosDashboard): Observable<DashboardAbastecimiento> {
    return this.api.get<DashboardAbastecimiento>(
      '/dashboard/abastecimiento',
      this.params(filtros),
    );
  }

  logistica(filtros?: FiltrosDashboard): Observable<DashboardLogistica> {
    return this.api.get<DashboardLogistica>('/dashboard/logistica', this.params(filtros));
  }

  exportar(filtros?: FiltrosDashboard): Observable<string> {
    return this.api.getText('/dashboard/exportar', this.params(filtros));
  }
}
