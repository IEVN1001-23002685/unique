import { Component, computed, input } from '@angular/core';
import { ETIQUETAS_ESTADO_PREPARACION, type EstadoPreparacion } from '../../modelos/preparacion';

/** Chip de estado con círculo de color y etiqueta textual. */
@Component({
  selector: 'app-chip-estado-preparacion',
  templateUrl: './chip-estado-preparacion.html',
  styleUrl: './chip-estado-preparacion.css',
})
export class ChipEstadoPreparacion {
  readonly estado = input.required<EstadoPreparacion>();
  readonly etiqueta = computed(() => ETIQUETAS_ESTADO_PREPARACION[this.estado()]);

  protected readonly tono = computed(() => {
    switch (this.estado()) {
      case 'POR_SURTIR':
        return 'neutro';
      case 'EN_PICKING':
        return 'info';
      case 'EN_VERIFICACION':
        return 'adv';
      case 'EN_EMPAQUE':
        return 'adv';
      case 'LISTA':
        return 'exito';
    }
  });
}
