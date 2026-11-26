import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { mensajeError } from '../../../../core/api/errores';
import { formatearDinero, formatearFechaHora } from '../../../../core/api/formato';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import {
  claseEstado,
  etiquetaDictamen,
  etiquetaEstado,
  etiquetaMotivo,
  etiquetaResolucion,
  type SolicitudCambioDevolucion,
} from '../../modelos/cambio-devolucion';
import { DevolucionesServicio } from '../../servicios/devoluciones-servicio';

/** Resolución administrativa: reembolso simulado o venta de reemplazo por $0.00 (§7 M07). */
@Component({
  selector: 'app-cd-resolucion',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './resolucion.html',
  styleUrls: ['./resolucion.css', '../../cambios-devoluciones-compartido.css'],
})
export class Resolucion {
  readonly caso = input<SolicitudCambioDevolucion | null>(null);
  readonly puedeResolver = input(false);
  readonly actualizado = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly servicio = inject(DevolucionesServicio);
  private readonly avisos = inject(AvisosServicio);

  readonly form = this.fb.nonNullable.group({
    resolucion: this.fb.nonNullable.control<'REEMBOLSO' | 'CAMBIO'>(
      'REEMBOLSO',
      Validators.required,
    ),
  });

  readonly enviando = signal(false);
  readonly errorLocal = signal('');

  readonly etiquetaEstado = etiquetaEstado;
  readonly etiquetaMotivo = etiquetaMotivo;
  readonly etiquetaDictamen = etiquetaDictamen;
  readonly etiquetaResolucion = etiquetaResolucion;
  readonly claseEstado = claseEstado;
  readonly formatearFechaHora = formatearFechaHora;
  readonly formatearDinero = formatearDinero;

  readonly inspeccionCompleta = computed(() => {
    const caso = this.caso();
    return (
      !!caso &&
      caso.lineas.length > 0 &&
      caso.lineas.every((linea) => !!linea.dictamen && linea.dictamen !== 'PENDIENTE')
    );
  });

  readonly puedeEjecutar = computed(
    () =>
      !!this.caso() &&
      this.caso()?.estado === 'RECIBIDA' &&
      this.inspeccionCompleta() &&
      this.puedeResolver(),
  );

  protected confirmar(): void {
    const caso = this.caso();
    if (!caso || !this.puedeEjecutar() || this.enviando()) return;
    this.errorLocal.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.servicio
      .resolver(caso.id, this.form.controls.resolucion.value)
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: (resuelto) => {
          this.avisos.mostrar(
            'exito',
            `${resuelto.folioCaso}: ${this.etiquetaResolucion(resuelto.resolucion).toLowerCase()} registrado por Flask.`,
          );
          this.actualizado.emit();
        },
        error: (error: unknown) => {
          this.errorLocal.set(mensajeError(error, 'No fue posible resolver la solicitud.'));
        },
      });
  }
}
