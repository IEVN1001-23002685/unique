import { Component, input } from '@angular/core';
import type { TonoSemaforo } from '../../modelos/produccion';

/** Semáforo funcional: círculo de color más etiqueta textual, nunca solo color. */
@Component({
  selector: 'app-semaforo-produccion',
  templateUrl: './semaforo-produccion.html',
  styleUrl: './semaforo-produccion.css',
})
export class SemaforoProduccion {
  readonly tono = input.required<TonoSemaforo>();
  readonly texto = input.required<string>();
}
