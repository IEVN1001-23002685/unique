import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import type { MermaVista } from '../../modelos/merma';

/** Diálogo de corrección: el Administrador crea un registro inverso con motivo. */
@Component({
  selector: 'app-modal-reversar-merma',
  imports: [DecimalPipe, ReactiveFormsModule],
  templateUrl: './modal-reversar-merma.html',
  styleUrls: ['./modal-reversar-merma.css', '../../mermas-compartido.css'],
})
export class ModalReversarMerma {
  readonly merma = input.required<MermaVista>();
  readonly confirmar = output<string>();
  readonly cancelar = output<void>();

  protected readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(6)],
  });

  protected aceptar(): void {
    if (this.motivo.invalid) {
      this.motivo.markAsTouched();
      return;
    }
    this.confirmar.emit(this.motivo.value.trim());
  }

  protected alPulsarTecla(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      this.cancelar.emit();
    }
  }
}
