import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ChipSeveridad } from '../../componentes/chip-severidad/chip-severidad';
import { ETIQUETAS_ROL_DESTINO } from '../../modelos/alerta-centro';
import { AlertasServicio } from '../../servicios/alertas-servicio';

/** Reglas del §7 y umbrales del §11.5. Edición local, pendiente de PATCH a Flask. */
@Component({
  selector: 'app-reglas-alertas',
  imports: [ReactiveFormsModule, RouterLink, ChipSeveridad],
  templateUrl: './reglas.html',
  styleUrls: ['../../estilos-compartidos.css', './reglas.css'],
})
export class Reglas {
  protected readonly servicio = inject(AlertasServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly fb = inject(FormBuilder);

  protected readonly roles = ETIQUETAS_ROL_DESTINO;

  protected readonly formulario = this.fb.group({
    umbrales: this.fb.array(
      this.servicio.reglas().map((regla) =>
        this.fb.control<number | null>(regla.valor, {
          validators: [
            Validators.required,
            Validators.min(regla.min),
            Validators.max(regla.max),
            Validators.pattern(/^\d+$/),
          ],
        }),
      ),
    ),
  });

  protected guardar(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) {
      this.avisos.mostrar('error', 'Revisa los umbrales: deben ser enteros dentro del rango indicado.');
      return;
    }

    let fallos = 0;
    for (const [indice, regla] of this.servicio.reglas().entries()) {
      const valor = this.formulario.controls.umbrales.at(indice)?.value ?? regla.valor;
      if (!this.servicio.guardarRegla(regla.clave, valor).ok) {
        fallos += 1;
      }
    }
    this.avisos.mostrar(
      fallos === 0 ? 'exito' : 'error',
      fallos === 0
        ? 'Umbrales actualizados en memoria. Flask aplicará los PATCH y recalculará las alertas.'
        : `${fallos} parámetro(s) no se pudieron actualizar. Revisa el rol y los rangos.`,
    );
  }

  protected restablecer(): void {
    this.servicio.restablecerReglas();
    this.formulario.controls.umbrales.setValue(this.servicio.reglas().map((regla) => regla.valor));
    this.formulario.markAsPristine();
  }

  protected errorEn(indice: number): boolean {
    const control = this.formulario.controls.umbrales.at(indice);
    return control !== undefined && control.invalid && (control.touched || control.dirty);
  }
}
