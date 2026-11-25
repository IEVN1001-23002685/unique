import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ChipEstadoProduccion } from '../../componentes/chip-estado-produccion/chip-estado-produccion';
import { NavegacionProduccion } from '../../componentes/navegacion-produccion/navegacion-produccion';
import { SemaforoProduccion } from '../../componentes/semaforo-produccion/semaforo-produccion';
import {
  ETIQUETAS_ORIGEN,
  ETIQUETAS_TONO,
  FILTROS_TABLERO,
  type FiltroTablero,
  type OrdenVista,
} from '../../modelos/produccion';
import { ProduccionServicio } from '../../servicios/produccion-servicio';

@Component({
  selector: 'app-tablero-produccion',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    ModalConfirmacion,
    NavegacionProduccion,
    SemaforoProduccion,
    ChipEstadoProduccion,
  ],
  templateUrl: './tablero.html',
  styleUrls: ['./tablero.css', '../../produccion-compartido.css'],
})
export class Tablero {
  protected readonly servicio = inject(ProduccionServicio);
  private readonly avisos = inject(AvisosServicio);

  protected readonly filtros = FILTROS_TABLERO;
  protected readonly etiquetasOrigen = ETIQUETAS_ORIGEN;
  protected readonly etiquetasTono = ETIQUETAS_TONO;

  protected readonly tab = signal<FiltroTablero>('TODAS');
  protected readonly busqueda = signal('');
  protected readonly cancelando = signal<OrdenVista | null>(null);

  protected readonly filtradas = computed(() => this.servicio.filtrar(this.tab(), this.busqueda()));
  protected readonly indicadores = computed(() => this.servicio.indicadores());

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected materialesTexto(orden: OrdenVista): string {
    const completos = orden.materialesCompletos;
    const total = orden.materiales.length;
    return `${completos} de ${total} completos`;
  }

  protected confirmarCancelacion(): void {
    const orden = this.cancelando();
    if (!orden) {
      return;
    }
    this.servicio
      .cancelar(orden.id, `Cancelación solicitada desde el tablero: ${orden.folio}`)
      .subscribe((resultado) => {
        this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
        this.cancelando.set(null);
      });
  }
}
