import { Component, computed, input } from '@angular/core';
import { ETIQUETAS_PASO, PASOS_PREPARACION, type PasoPreparacion } from '../../modelos/preparacion';

/** Indicador de los cuatro pasos documentados: Picking, Verificación, Empaque y Lista. */
@Component({
  selector: 'app-pasos-preparacion',
  templateUrl: './pasos-preparacion.html',
  styleUrl: './pasos-preparacion.css',
})
export class PasosPreparacion {
  readonly paso = input.required<PasoPreparacion>();

  protected readonly pasos = PASOS_PREPARACION;
  protected readonly etiquetas = ETIQUETAS_PASO;
  protected readonly indice = computed(() => PASOS_PREPARACION.indexOf(this.paso()));
}
