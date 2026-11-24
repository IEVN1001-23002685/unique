import { Component, computed, input } from '@angular/core';

export type DominioEstado = 'pago' | 'venta' | 'pedido';

/** Semáforo textual: círculo de color más etiqueta legible. */
@Component({
  selector: 'app-chip-estado-venta',
  templateUrl: './chip-estado-venta.html',
  styleUrl: './chip-estado-venta.css',
})
export class ChipEstadoVenta {
  readonly dominio = input.required<DominioEstado>();
  readonly estado = input.required<string>();

  private readonly etiquetas: Record<DominioEstado, Record<string, string>> = {
    pago: {
      PENDIENTE: 'Pago pendiente',
      PAGADA: 'Pagada',
      REEMBOLSADA_PARCIAL: 'Reembolso parcial',
      REEMBOLSADA: 'Reembolsada',
    },
    venta: {
      ACTIVA: 'Activa',
      CANCELADA: 'Cancelada',
    },
    pedido: {
      RECIBIDO: 'Recibido',
      CONFIRMADO: 'Confirmado',
      EN_PRODUCCION: 'En producción',
      EN_PREPARACION: 'En preparación',
      LISTO_ENVIO: 'Listo para envío',
      EN_REPARTO: 'En reparto',
      ENTREGADO: 'Entregado',
      CANCELADO: 'Cancelado',
    },
  };

  protected readonly etiqueta = computed(
    () => this.etiquetas[this.dominio()][this.estado()] ?? this.estado(),
  );

  protected readonly tono = computed(() => {
    const estado = this.estado();
    if (
      estado === 'CANCELADA' ||
      estado === 'CANCELADO' ||
      estado === 'REEMBOLSADA' ||
      estado === 'REEMBOLSADA_PARCIAL'
    ) {
      return 'error';
    }
    if (estado === 'PENDIENTE' || estado === 'RECIBIDO') {
      return 'adv';
    }
    if (estado === 'PAGADA' || estado === 'ENTREGADO' || estado === 'ACTIVA') {
      return 'exito';
    }
    return 'info';
  });
}
