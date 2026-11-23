import { Component, input } from '@angular/core';
import type { TonoSemaforo } from '../../modelos/inventario';

/** Semáforo funcional: círculo de color más etiqueta textual, nunca solo color. */
@Component({
  selector: 'app-semaforo-inventario',
  templateUrl: './semaforo-inventario.html',
  styleUrl: './semaforo-inventario.css',
})
export class SemaforoInventario {
  readonly tono = input.required<TonoSemaforo>();
  readonly texto = input.required<string>();
}
