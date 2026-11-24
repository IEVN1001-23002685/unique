import { Component, computed, input } from '@angular/core';
import type { SeveridadAlerta } from '../../modelos/alerta-centro';

const ETIQUETAS: Record<SeveridadAlerta, string> = {
  CRITICA: 'Crítica',
  PREVENTIVA: 'Preventiva',
  INFORMATIVA: 'Informativa',
};

/** Semáforo textual con círculo de color, según la identidad visual UNIQUE. */
@Component({
  selector: 'app-chip-severidad',
  templateUrl: './chip-severidad.html',
  styleUrl: './chip-severidad.css',
})
export class ChipSeveridad {
  readonly severidad = input.required<SeveridadAlerta>();
  protected readonly etiqueta = computed(() => ETIQUETAS[this.severidad()]);
}
