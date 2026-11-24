import { Component, input } from '@angular/core';
import type { SemaforoInventario as EstadoSemaforo } from '../../modelos/inventario-producto-terminado';

/** Círculo de color más etiqueta textual, según el sistema visual de UNIQUE. */
@Component({
  selector: 'app-semaforo-inventario-pt',
  templateUrl: './semaforo-inventario.html',
  styleUrl: './semaforo-inventario.css',
})
export class SemaforoInventario {
  readonly estado = input.required<EstadoSemaforo>();
}
