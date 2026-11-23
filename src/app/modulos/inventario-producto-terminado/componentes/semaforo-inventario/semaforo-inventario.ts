import { Component, input } from '@angular/core';
import type { SemaforoInventario } from '../../modelos/inventario-producto-terminado';

/** Círculo de color más etiqueta textual, según el sistema visual de UNIQUE. */
@Component({
  selector: 'app-semaforo-inventario',
  templateUrl: './semaforo-inventario.html',
  styleUrl: './semaforo-inventario.css',
})
export class SemaforoInventario {
  readonly estado = input.required<SemaforoInventario>();
}
