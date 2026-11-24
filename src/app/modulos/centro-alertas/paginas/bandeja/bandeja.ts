import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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

interface AtencionPendiente {
  alerta: AlertaCentro;
  ejecutarAccion: boolean;
}

/** Bandeja de M21: pestañas con contador, búsqueda y acción directa por alerta. */
@Component({
  selector: 'app-bandeja-alertas',
  imports: [ModalConfirmacion, ChipSeveridad],
  templateUrl: './bandeja.html',
  styleUrls: ['../../estilos-compartidos.css', './bandeja.css'],
})
export class Bandeja {
  protected readonly servicio = inject(AlertasServicio);
  private readonly router = inject(Router);
  protected readonly filtros = FILTROS;
  protected readonly etiquetas: Record<FiltroSeveridad, string> = {
    TODAS: 'Todas',
    ...ETIQUETAS_SEVERIDAD,
  };
  private readonly ahora = Date.now();

  protected readonly severidad = signal<FiltroSeveridad>('TODAS');
  protected readonly busqueda = signal('');
  protected readonly pendiente = signal<AtencionPendiente | null>(null);

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

  protected pedirAtencion(alerta: AlertaCentro, ejecutarAccion = false): void {
    this.pendiente.set({ alerta, ejecutarAccion });
  }

  protected confirmarAtencion(): void {
    const seleccion = this.pendiente();
    this.pendiente.set(null);
    if (!seleccion) {
      return;
    }
    this.servicio.atender(seleccion.alerta.id);
    if (seleccion.ejecutarAccion) {
      void this.router.navigate(seleccion.alerta.ruta);
    }
  }

  protected cancelarAtencion(): void {
    this.pendiente.set(null);
  }

  protected tituloModal(): string {
    return this.pendiente()?.ejecutarAccion
      ? 'Ejecutar acción de la alerta'
      : 'Marcar alerta como atendida';
  }

  protected mensajeModal(): string {
    const seleccion = this.pendiente();
    if (!seleccion) {
      return '';
    }
    const accion = seleccion.alerta.accionSugerida ?? 'correspondiente';
    return seleccion.ejecutarAccion
      ? `¿Continuar con «${accion}» para «${seleccion.alerta.titulo}»? Se abrirá la pantalla de origen y la alerta quedará atendida en esta sesión; la operación real se ejecutará en Flask.`
      : `¿Registrar como atendida «${seleccion.alerta.titulo}»? No se ejecutará la acción «${accion}» ni se guardará en el servidor.`;
  }

  protected tiempo(alerta: AlertaCentro): string {
    return tiempoAbierta(alerta.abiertaEn, this.ahora);
  }

  protected fecha(iso: string): string {
    return fechaLegible(iso);
  }
}
