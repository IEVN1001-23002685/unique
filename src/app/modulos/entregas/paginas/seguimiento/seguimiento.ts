import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ChipEstadoEntrega } from '../../componentes/chip-estado-entrega/chip-estado-entrega';
import { NavegacionEntregas } from '../../componentes/navegacion-entregas/navegacion-entregas';
import {
  ETIQUETAS_ESTADO_ENTREGA,
  ETIQUETAS_MOTIVO_FALLO,
  type EstadoEntrega,
} from '../../modelos/entrega';
import { EntregasServicio } from '../../servicios/entregas-servicio';

type EstadoFiltro = EstadoEntrega | 'TODOS';
type AccionAlerta = 'REPROGRAMAR' | 'CANCELAR';

interface ConfirmacionPendiente {
  folio: string;
  accion: AccionAlerta;
}

@Component({
  selector: 'app-seguimiento',
  imports: [DatePipe, RouterLink, ModalConfirmacion, ChipEstadoEntrega, NavegacionEntregas],
  templateUrl: './seguimiento.html',
  styleUrls: ['../../estilos-compartidos.css', './seguimiento.css'],
})
export class Seguimiento {
  private readonly ruta = inject(ActivatedRoute);
  protected readonly servicio = inject(EntregasServicio);
  private readonly avisos = inject(AvisosServicio);

  /**
   * M09 conserva guías demo GUI-AAAA-####, pero el §7 de M19 define EN-AAAA-NNNNNN.
   * Al llegar desde el detalle de pedido, la guía antigua se convierte en folio
   * de pedido para que el historial de M19 sí pueda localizarse.
   */
  protected readonly busqueda = signal(this.busquedaInicial());
  protected readonly repartidorId = signal(0);
  protected readonly estado = signal<EstadoFiltro>('TODOS');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly confirmando = signal<ConfirmacionPendiente | null>(null);

  protected readonly repartidores = this.servicio.repartidores;
  protected readonly alertas = this.servicio.alertasCriticas;

  protected readonly estados: { valor: EstadoFiltro; etiqueta: string }[] = [
    { valor: 'TODOS', etiqueta: 'Todos los estados' },
    ...(Object.keys(ETIQUETAS_ESTADO_ENTREGA) as EstadoEntrega[]).map((valor) => ({
      valor,
      etiqueta: ETIQUETAS_ESTADO_ENTREGA[valor],
    })),
  ];

  protected readonly filtrados = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const desde = this.desde();
    const hasta = this.hasta();

    return this.servicio
      .entregas()
      .filter((entrega) => {
        const coincideEstado = this.estado() === 'TODOS' || entrega.estado === this.estado();
        const coincideRepartidor =
          this.repartidorId() === 0 || entrega.repartidorId === this.repartidorId();
        const coincideTexto =
          termino === '' ||
          entrega.folio.toLowerCase().includes(termino) ||
          entrega.pedidoFolio.toLowerCase().includes(termino) ||
          entrega.cliente.toLowerCase().includes(termino);
        const coincidePeriodo =
          (desde === '' || entrega.fechaProgramada >= desde) &&
          (hasta === '' || entrega.fechaProgramada <= hasta);
        return coincideEstado && coincideRepartidor && coincideTexto && coincidePeriodo;
      })
      .sort((a, b) => b.fechaProgramada.localeCompare(a.fechaProgramada) || b.id - a.id);
  });

  protected readonly sinFiltros = computed(
    () =>
      this.busqueda().trim() === '' &&
      this.repartidorId() === 0 &&
      this.estado() === 'TODOS' &&
      this.desde() === '' &&
      this.hasta() === '',
  );

  protected readonly confirmacion = computed(() => {
    const pendiente = this.confirmando();
    if (!pendiente) {
      return null;
    }
    return pendiente.accion === 'REPROGRAMAR'
      ? {
          titulo: 'Reprogramar entrega',
          mensaje: `Se creará un nuevo intento para la guía ${pendiente.folio}. El reingreso de existencias y la alerta real requieren Flask.`,
          etiqueta: 'Reprogramar',
        }
      : {
          titulo: 'Cancelar con reembolso',
          mensaje: `La guía ${pendiente.folio} se cancelará en la demo. La cancelación del pedido y el reembolso requieren Flask (M09/M08).`,
          etiqueta: 'Cancelar y reembolsar',
        };
  });

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarRepartidor(evento: Event): void {
    this.repartidorId.set(Number((evento.target as HTMLSelectElement).value));
  }

  protected alCambiarEstado(evento: Event): void {
    this.estado.set((evento.target as HTMLSelectElement).value as EstadoFiltro);
  }

  protected alCambiarDesde(evento: Event): void {
    this.desde.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarHasta(evento: Event): void {
    this.hasta.set((evento.target as HTMLInputElement).value);
  }

  protected restablecer(): void {
    this.busqueda.set('');
    this.repartidorId.set(0);
    this.estado.set('TODOS');
    this.desde.set('');
    this.hasta.set('');
  }

  protected abrirConfirmacion(folio: string, accion: AccionAlerta): void {
    this.confirmando.set({ folio, accion });
  }

  protected confirmar(): void {
    const pendiente = this.confirmando();
    if (!pendiente) {
      return;
    }
    const resultado =
      pendiente.accion === 'REPROGRAMAR'
        ? this.servicio.reprogramar(pendiente.folio)
        : this.servicio.cancelarConReembolso(pendiente.folio);

    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    if (resultado.ok) {
      this.confirmando.set(null);
    }
  }

  protected etiquetaMotivo(motivo: keyof typeof ETIQUETAS_MOTIVO_FALLO | null): string {
    return motivo ? ETIQUETAS_MOTIVO_FALLO[motivo] : '—';
  }

  private busquedaInicial(): string {
    const guia = this.ruta.snapshot.queryParamMap.get('guia') ?? '';
    const anterior = /^GUI-(\d{4})-(\d+)$/.exec(guia);
    if (anterior) {
      return `PED-${anterior[1]}-${anterior[2].padStart(4, '0')}`;
    }
    return guia;
  }
}
