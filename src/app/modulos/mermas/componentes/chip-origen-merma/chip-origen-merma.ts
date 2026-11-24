import { Component, input } from '@angular/core';
import type { OrigenMerma } from '../../modelos/merma';

/** Chip de origen (material o producto), reutilizado en tabla y detalle. */
@Component({
  selector: 'app-chip-origen-merma',
  templateUrl: './chip-origen-merma.html',
  styleUrl: './chip-origen-merma.css',
})
export class ChipOrigenMerma {
  readonly origen = input.required<OrigenMerma>();
}
