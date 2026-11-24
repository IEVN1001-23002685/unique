import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ETIQUETAS_TIPO_INCIDENCIA,
  type DatosIncidencia,
  type TipoIncidencia,
} from '../../modelos/preparacion';

/** Alta de incidencias desde la hoja de preparación. Sin lógica de persistencia. */
@Component({
  selector: 'app-modal-incidencia',
  imports: [ReactiveFormsModule],
  templateUrl: './modal-incidencia.html',
  styleUrl: './modal-incidencia.css',
})
export class ModalIncidencia {
  private readonly fb = inject(FormBuilder);

  readonly skus = input<string[]>([]);
  readonly skuInicial = input('');
  readonly registrar = output<DatosIncidencia>();
  readonly cancelar = output<void>();

  protected readonly tipos = (Object.keys(ETIQUETAS_TIPO_INCIDENCIA) as TipoIncidencia[]).map(
    (valor) => ({ valor, etiqueta: ETIQUETAS_TIPO_INCIDENCIA[valor] }),
  );
  protected readonly intentado = signal(false);

  protected readonly forma = this.fb.nonNullable.group({
    sku: ['', [Validators.required]],
    tipo: ['SKU' as TipoIncidencia, [Validators.required]],
    descripcion: ['', [Validators.required, Validators.minLength(6)]],
    cantidad: [1, [Validators.required, Validators.min(1)]],
  });

  constructor() {
    effect(() => {
      const sku = this.skuInicial();
      const disponibles = this.skus();
      const valor = sku || disponibles[0] || '';
      if (valor !== this.forma.controls.sku.value) {
        this.forma.controls.sku.setValue(valor);
      }
    });
  }

  protected esInvalido(campo: 'sku' | 'descripcion' | 'cantidad'): boolean {
    const control = this.forma.controls[campo];
    return control.invalid && (control.touched || this.intentado());
  }

  protected alPulsarTecla(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      this.cancelar.emit();
    }
  }

  protected enviar(): void {
    this.intentado.set(true);
    if (this.forma.invalid) {
      this.forma.markAllAsTouched();
      return;
    }
    this.registrar.emit(this.forma.getRawValue());
  }
}
