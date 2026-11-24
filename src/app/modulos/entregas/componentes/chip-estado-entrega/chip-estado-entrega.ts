import { Component, computed, input } from '@angular/core';
import {
  ETIQUETAS_ESTADO_ENTREGA,
  type EstadoEntrega,
} from '../../modelos/entrega';

/** Chip de estado con círculo de color y etiqueta textual. */
@Component({
  selector: 'app-chip-estado-entrega',
  templateUrl: './chip-estado-entrega.html',
  styleUrl: './chip-estado-entrega.css',
})
export class ChipEstadoEntrega {
  readonly estado = input.required<EstadoEntrega>();
  readonly etiqueta = computed(() => ETIQUETAS_ESTADO_ENTREGA[this.estado()]);

  protected readonly tono = computed(() => {
    switch (this.estado()) {
      case 'PROGRAMADA':
        return 'info';
      case 'EN_RUTA':
        return 'adv';
      case 'ENTREGADA':
        return 'exito';
      case 'FALLIDA':
        return 'error';
      case 'CANCELADA':
        return 'neutro';
    }
  });
}
