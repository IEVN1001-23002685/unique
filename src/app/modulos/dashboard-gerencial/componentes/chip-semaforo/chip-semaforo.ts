import { Component, computed, input } from '@angular/core';
import type { TonoDashboard } from '../../modelos/dashboard';

const ETIQUETAS: Record<TonoDashboard, string> = {
  ROJO: 'Rojo',
  AMBAR: 'Ámbar',
  VERDE: 'Verde',
  NEUTRO: 'Neutro',
  INFO: 'Información',
};

/** Semáforo con círculo de color más etiqueta textual, según la identidad UNIQUE. */
@Component({
  selector: 'app-chip-semaforo',
  templateUrl: './chip-semaforo.html',
  styleUrl: './chip-semaforo.css',
})
export class ChipSemaforo {
  readonly tono = input.required<TonoDashboard>();
  readonly etiqueta = input('');

  protected readonly texto = computed(() => this.etiqueta() || ETIQUETAS[this.tono()]);
}
