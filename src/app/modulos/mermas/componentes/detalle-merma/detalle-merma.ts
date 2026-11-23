import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ETIQUETAS_ETAPA, type MermaVista } from '../../modelos/merma';
import { ChipOrigenMerma } from '../chip-origen-merma/chip-origen-merma';

/** Detalle de solo lectura de un registro de merma. No edita ni elimina. */
@Component({
  selector: 'app-detalle-merma',
  imports: [DatePipe, DecimalPipe, ChipOrigenMerma],
  templateUrl: './detalle-merma.html',
  styleUrls: ['./detalle-merma.css', '../../mermas-compartido.css'],
})
export class DetalleMerma {
  readonly merma = input.required<MermaVista>();
  readonly cerrar = output<void>();
  protected readonly etiquetasEtapa = ETIQUETAS_ETAPA;

  protected alPulsarTecla(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      this.cerrar.emit();
    }
  }
}
