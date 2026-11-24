import { Component, computed, inject, signal } from '@angular/core';
import { ChipSeveridad } from '../../componentes/chip-severidad/chip-severidad';
import {
  ETIQUETAS_ESTADO_ALERTA,
  fechaLegible,
  type EstadoAlertaCentro,
} from '../../modelos/alerta-centro';
import { AlertasServicio } from '../../servicios/alertas-servicio';

/** Bitácora de M21: alertas cerradas con quién y cuándo. */
@Component({
  selector: 'app-resueltas-alertas',
  imports: [ChipSeveridad],
  templateUrl: './resueltas.html',
  styleUrls: ['../../estilos-compartidos.css', './resueltas.css'],
})
export class Resueltas {
  protected readonly servicio = inject(AlertasServicio);
  protected readonly estados = ETIQUETAS_ESTADO_ALERTA;
  protected readonly soloAuto = signal(false);

  protected readonly filtradas = computed(() => {
    const resueltas = this.servicio.resueltas();
    return this.soloAuto()
      ? resueltas.filter((alerta) => alerta.estado === 'RESUELTA_AUTO')
      : resueltas;
  });

  protected alternarFiltro(): void {
    this.soloAuto.update((valor) => !valor);
  }

  protected fecha(iso: string | null): string {
    return iso === null ? '—' : fechaLegible(iso);
  }

  protected etiquetaEstado(estado: EstadoAlertaCentro): string {
    return ETIQUETAS_ESTADO_ALERTA[estado];
  }
}
