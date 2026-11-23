import { Component, input } from '@angular/core';
import type { EstadoMaterial, EstadoOrden } from '../../modelos/produccion';

type EstadoMostrado = EstadoOrden | EstadoMaterial;

/** Chip de estado con punto de color y etiqueta legible. */
@Component({
  selector: 'app-chip-estado-produccion',
  templateUrl: './chip-estado-produccion.html',
  styleUrl: './chip-estado-produccion.css',
})
export class ChipEstadoProduccion {
  readonly estado = input.required<EstadoMostrado>();

  protected readonly etiquetas: Record<EstadoMostrado, string> = {
    PLANEADA: 'Planeada',
    LISTA: 'Lista',
    EN_PROCESO: 'En proceso',
    EN_REVISION: 'En revisión',
    CERRADA: 'Cerrada',
    CANCELADA: 'Cancelada',
    COMPLETO: 'Completo',
    PARCIAL: 'Parcial',
    FALTANTE: 'Faltante',
  };
}
