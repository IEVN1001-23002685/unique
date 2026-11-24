import { Component, input } from '@angular/core';
import type { EstadoCompra } from '../../modelos/compra';

/** Semáforo textual reutilizable: círculo de color más etiqueta legible. */
@Component({
  selector: 'app-chip-estado-compra',
  templateUrl: './chip-estado-compra.html',
  styleUrl: './chip-estado-compra.css',
})
export class ChipEstadoCompra {
  readonly estado = input.required<EstadoCompra>();

  protected readonly etiquetas: Record<EstadoCompra, string> = {
    PENDIENTE: 'Pendiente',
    EN_COTIZACION: 'En cotización',
    COMPRA_EMITIDA: 'Compra emitida',
    ATENDIDA: 'Atendida',
    CANCELADA: 'Cancelada',
    ELEGIDA: 'Elegida',
    DESCARTADA: 'Descartada',
    BORRADOR: 'Borrador',
    EMITIDA: 'Emitida',
    PARCIAL: 'Parcial',
    RECIBIDA: 'Recibida',
    RETRASADA: 'Retrasada',
  };
}
