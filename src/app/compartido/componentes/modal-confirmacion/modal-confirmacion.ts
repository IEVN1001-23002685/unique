import { Component, input, output } from '@angular/core';

/** Diálogo de confirmación para acciones destructivas. Sin lógica de negocio. */
@Component({
  selector: 'app-modal-confirmacion',
  templateUrl: './modal-confirmacion.html',
  styleUrl: './modal-confirmacion.css',
})
export class ModalConfirmacion {
  readonly titulo = input('Confirmar acción');
  readonly mensaje = input('¿Deseas continuar?');
  readonly etiquetaConfirmar = input('Confirmar');
  readonly disabledConfirmar = input(false);

  readonly confirmar = output<void>();
  readonly cancelar = output<void>();

  protected alPulsarTecla(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      this.cancelar.emit();
    }
  }
}
