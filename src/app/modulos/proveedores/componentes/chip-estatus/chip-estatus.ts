import { Component, input } from '@angular/core';
import type { EstadoProveedor } from '../../modelos/proveedor';

/** Semáforo textual: círculo de color más etiqueta, accesible y legible. */
@Component({
  selector: 'app-chip-estatus',
  templateUrl: './chip-estatus.html',
  styleUrl: './chip-estatus.css',
})
export class ChipEstatus {
  readonly estatus = input.required<EstadoProveedor>();

  protected readonly etiquetas: Record<EstadoProveedor, string> = {
    ACTIVO: 'Activo',
    EN_REVISION: 'En revisión',
    INACTIVO: 'Inactivo',
  };
}
