import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ETIQUETAS_MOTIVO_FALLO,
  MOTIVOS_FALLO,
  type DatosEntregado,
  type DatosFallida,
  type Entrega,
  type MotivoFallo,
} from '../../modelos/entrega';

export type ResultadoEntrega =
  | { tipo: 'ENTREGADO'; datos: DatosEntregado }
  | { tipo: 'FALLIDA'; datos: DatosFallida };

/** Registra receptor y hora, o el motivo de un intento fallido. */
@Component({
  selector: 'app-modal-resultado-entrega',
  imports: [ReactiveFormsModule],
  templateUrl: './modal-resultado-entrega.html',
  styleUrls: ['./modal-resultado-entrega.css', '../modales.css'],
})
export class ModalResultadoEntrega {
  readonly entrega = input.required<Entrega>();
  readonly modo = input.required<'ENTREGADO' | 'FALLIDA'>();
  readonly confirmar = output<ResultadoEntrega>();
  readonly cancelar = output<void>();

  private readonly fb = inject(FormBuilder);
  protected readonly motivos = MOTIVOS_FALLO;
  protected readonly etiquetasMotivo = ETIQUETAS_MOTIVO_FALLO;
  protected readonly intento = signal(false);

  protected readonly entregadoForma = this.fb.nonNullable.group({
    receptor: ['', [Validators.required, Validators.minLength(3)]],
    notas: [''],
  });

  protected readonly fallidaForma = this.fb.nonNullable.group({
    motivoFallo: ['AUSENTE' as MotivoFallo, Validators.required],
    notas: [''],
  });

  protected readonly receptorInvalido = computed(() => {
    const control = this.entregadoForma.controls.receptor;
    return control.invalid && (control.touched || this.intento());
  });

  protected alEnviar(): void {
    this.intento.set(true);
    if (this.modo() === 'ENTREGADO') {
      if (this.entregadoForma.invalid) {
        this.entregadoForma.markAllAsTouched();
        return;
      }
      this.confirmar.emit({
        tipo: 'ENTREGADO',
        datos: {
          receptor: this.entregadoForma.controls.receptor.value,
          notas: this.entregadoForma.controls.notas.value,
        },
      });
      return;
    }

    if (this.fallidaForma.invalid) {
      this.fallidaForma.markAllAsTouched();
      return;
    }
    this.confirmar.emit({
      tipo: 'FALLIDA',
      datos: {
        motivoFallo: this.fallidaForma.controls.motivoFallo.value,
        notas: this.fallidaForma.controls.notas.value,
      },
    });
  }

  protected alPulsarTecla(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      this.cancelar.emit();
    }
  }
}
