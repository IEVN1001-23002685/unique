import { inject, Injectable } from '@angular/core';
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

/** M20: única puerta HTTP del dashboard; los filtros reales son desde/hasta. */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiAdminService);

  private params(filtros: FiltrosDashboard): Record<string, ValorParametro> {
    return { desde: filtros.desde, hasta: filtros.hasta };
  }

  resumen(filtros: FiltrosDashboard = {}): Observable<DashboardResumen> {
    return this.api.get<DashboardResumen>('/dashboard/resumen', this.params(filtros));
  }

  ventas(filtros: FiltrosDashboard = {}): Observable<DashboardVentas> {
    return this.api.get<DashboardVentas>('/dashboard/ventas', this.params(filtros));
  }

  produccion(filtros: FiltrosDashboard = {}): Observable<DashboardProduccion> {
    return this.api.get<DashboardProduccion>('/dashboard/produccion', this.params(filtros));
  }

  abastecimiento(filtros: FiltrosDashboard = {}): Observable<DashboardAbastecimiento> {
    return this.api.get<DashboardAbastecimiento>(
      '/dashboard/abastecimiento',
      this.params(filtros),
    );
  }

  logistica(filtros: FiltrosDashboard = {}): Observable<DashboardLogistica> {
    return this.api.get<DashboardLogistica>('/dashboard/logistica', this.params(filtros));
  }

  exportar(filtros: FiltrosDashboard = {}): Observable<string> {
    return this.api.getText('/dashboard/exportar', this.params(filtros));
  }
}
