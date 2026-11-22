import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

export interface ResultadoAccionVenta {
  motivo: string;
  monto: number;
}

/** Diálogo de M08 para cancelar o reembolsar: captura motivo y, si aplica, monto. */
@Component({
  selector: 'app-modal-accion-venta',
  imports: [ReactiveFormsModule],
  templateUrl: './modal-accion-venta.html',
  styleUrl: './modal-accion-venta.css',
})
export class ModalAccionVenta {
  private readonly fb = inject(FormBuilder);

  readonly titulo = input('Confirmar acción');
  readonly mensaje = input('');
  readonly etiquetaConfirmar = input('Confirmar');
  readonly pedirMotivo = input(true);
  readonly pedirMonto = input(false);
  readonly montoMaximo = input(0);

  readonly confirmar = output<ResultadoAccionVenta>();
  readonly cancelar = output<void>();

  protected readonly intento = signal(false);
  protected readonly formulario = this.fb.nonNullable.group({
    motivo: [''],
    monto: [0],
  });

  protected get motivoInvalido(): boolean {
    return this.pedirMotivo() && this.formulario.controls.motivo.value.trim() === '';
  }

  protected get montoInvalido(): boolean {
    return (
      this.pedirMonto() &&
      (this.formulario.controls.monto.value <= 0 ||
        this.formulario.controls.monto.value > this.montoMaximo())
    );
  }

  protected alPulsarTecla(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      this.cancelar.emit();
    }
  }

  protected confirmarAccion(): void {
    this.intento.set(true);
    if (this.motivoInvalido || this.montoInvalido) {
      return;
    }

    this.confirmar.emit({
      motivo: this.formulario.controls.motivo.value.trim(),
      monto: this.pedirMonto() ? this.formulario.controls.monto.value : 0,
    });
  }
}
