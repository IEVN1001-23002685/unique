import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

/** Semáforo de círculo + etiqueta y barra contra la meta de 5 % (§1 y §7). */
@Component({
  selector: 'app-barra-meta',
  imports: [DecimalPipe],
  templateUrl: './barra-meta.html',
  styleUrl: './barra-meta.css',
})
export class BarraMeta {
  readonly porcentaje = input.required<number>();
  readonly meta = input.required<number>();
  readonly base = input<'meta' | 'participacion'>('meta');

  protected readonly tono = computed<'exito' | 'adv' | 'error' | 'info'>(() => {
    if (this.base() === 'participacion') {
      return 'info';
    }
    const valor = this.porcentaje();
    const objetivo = this.meta();
    return valor > objetivo ? 'error' : valor > objetivo * 0.8 ? 'adv' : 'exito';
  });

  protected readonly etiquetaTono = computed(() => {
    switch (this.tono()) {
      case 'error':
        return 'Sobre la meta';
      case 'adv':
        return 'Cerca de la meta';
      case 'info':
        return 'Participación';
      default:
        return 'Dentro de la meta';
    }
  });

  /** La escala llega al doble de la meta para que el rebase sea visible. */
  protected readonly ancho = computed(() => {
    const escala = this.base() === 'meta' ? Math.max(this.meta() * 2, 1) : 100;
    return Math.max(0, Math.min(100, (this.porcentaje() / escala) * 100));
  });
}
