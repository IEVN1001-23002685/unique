import { Component, computed, input } from '@angular/core';
import { ETIQUETAS_ESTADO } from '../../servicios/pedidos-servicio';
import type { EstadoPedido } from '../../modelos/pedido';

/** Chip de estado con círculo de color y etiqueta textual. */
@Component({
  selector: 'app-chip-estado-pedido',
  templateUrl: './chip-estado-pedido.html',
  styleUrl: './chip-estado-pedido.css',
})
export class ChipEstadoPedido {
  readonly estado = input.required<EstadoPedido>();
  readonly etiqueta = computed(() => ETIQUETAS_ESTADO[this.estado()]);

  protected readonly tono = computed(() => {
    switch (this.estado()) {
      case 'CANCELADO':
        return 'error';
      case 'RECIBIDO':
        return 'info';
      case 'EN_PRODUCCION':
        return 'adv';
      default:
        return 'exito';
    }
  });
}
