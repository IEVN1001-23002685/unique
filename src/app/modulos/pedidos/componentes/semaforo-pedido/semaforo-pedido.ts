import { Component, input } from '@angular/core';
import type { TonoSemaforo } from '../../modelos/pedido';

/** Semáforo funcional: círculo de color más etiqueta textual, nunca solo color. */
@Component({
  selector: 'app-semaforo-pedido',
  templateUrl: './semaforo-pedido.html',
  styleUrl: './semaforo-pedido.css',
})
export class SemaforoPedido {
  readonly tono = input.required<TonoSemaforo>();
  readonly texto = input.required<string>();
}
