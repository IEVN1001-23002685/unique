import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

/** Diálogo de cancelación con motivo obligatorio. Sin lógica de negocio. */
@Component({
  selector: 'app-modal-cancelar-pedido',
  imports: [ReactiveFormsModule],
  templateUrl: './modal-cancelar-pedido.html',
  styleUrl: './modal-cancelar-pedido.css',
})
export class ModalCancelarPedido {
  private readonly fb = inject(FormBuilder);

  readonly folio = input.required<string>();
  readonly confirmar = output<string>();
  readonly cancelar = output<void>();

  protected readonly intento = signal(false);
  protected readonly forma = this.fb.nonNullable.group({
    motivo: ['', [Validators.required, Validators.minLength(10)]],
  });

  protected get motivoInvalido(): boolean {
    const control = this.forma.controls.motivo;
    return control.invalid && (control.touched || this.intento());
  }

  protected confirmarAccion(): void {
    this.intento.set(true);
    if (this.forma.invalid) {
      this.forma.markAllAsTouched();
      return;
    }
    this.confirmar.emit(this.forma.getRawValue().motivo.trim());
  }

  protected alPulsarTecla(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      this.cancelar.emit();
    }
  }
}
