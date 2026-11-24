import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { ChipSeveridad } from '../../componentes/chip-severidad/chip-severidad';
import {
  ETIQUETAS_SEVERIDAD,
  fechaLegible,
  tiempoAbierta,
  type AlertaCentro,
  type FiltroSeveridad,
} from '../../modelos/alerta-centro';
import { AlertasServicio } from '../../servicios/alertas-servicio';

const FILTROS: FiltroSeveridad[] = ['TODAS', 'CRITICA', 'PREVENTIVA', 'INFORMATIVA'];

/** Bandeja de M21: pestañas con contador, búsqueda y acción directa por alerta. */
@Component({
  selector: 'app-bandeja-alertas',
  imports: [RouterLink, ModalConfirmacion, ChipSeveridad],
  templateUrl: './bandeja.html',
  styleUrls: ['../../estilos-compartidos.css', './bandeja.css'],
})
export class Bandeja {
  protected readonly servicio = inject(AlertasServicio);
  protected readonly filtros = FILTROS;
  protected readonly etiquetas: Record<FiltroSeveridad, string> = {
    TODAS: 'Todas',
    ...ETIQUETAS_SEVERIDAD,
  };
  private readonly ahora = Date.now();

  protected readonly severidad = signal<FiltroSeveridad>('TODAS');
  protected readonly busqueda = signal('');
  protected readonly pendiente = signal<AlertaCentro | null>(null);

  protected readonly visibles = computed(() => {
    const filtro = this.severidad();
    const texto = this.busqueda().trim().toLocaleLowerCase('es-MX');
    return this.servicio.abiertas().filter((alerta) => {
      if (filtro !== 'TODAS' && alerta.severidad !== filtro) {
        return false;
      }
      if (texto.length === 0) {
        return true;
      }
      return [
        alerta.titulo,
        alerta.detalle,
        alerta.entidadId,
        alerta.origen,
        alerta.accionSugerida ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('es-MX')
        .includes(texto);
    });
  });

  protected contar(filtro: FiltroSeveridad): number {
    const contadores = this.servicio.contadores();
    if (filtro === 'TODAS') {
      return contadores.todas;
    }
    if (filtro === 'CRITICA') {
      return contadores.criticas;
    }
    if (filtro === 'PREVENTIVA') {
      return contadores.preventivas;
    }
    return contadores.informativas;
  }

  protected alCambiarBusqueda(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected pedirAtencion(alerta: AlertaCentro): void {
    this.pendiente.set(alerta);
  }

  protected confirmarAtencion(): void {
    const alerta = this.pendiente();
    if (alerta) {
      this.servicio.atender(alerta.id);
    }
    this.pendiente.set(null);
  }

  protected cancelarAtencion(): void {
    this.pendiente.set(null);
  }

  protected tiempo(alerta: AlertaCentro): string {
    return tiempoAbierta(alerta.abiertaEn, this.ahora);
  }

  protected fecha(iso: string): string {
    return fechaLegible(iso);
  }
}
