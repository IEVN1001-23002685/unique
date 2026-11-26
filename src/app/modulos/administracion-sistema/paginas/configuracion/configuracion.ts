import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { AdministracionSistemaServicio } from '../../servicios/administracion-sistema-servicio';
import type { ParametroSistema } from '../../modelos/administracion';

/** Configuración: parámetros de §11.5 editables solo en memoria. */
@Component({
  selector: 'app-configuracion-sistema',
  imports: [ReactiveFormsModule, RouterLink, ModalConfirmacion],
  templateUrl: './configuracion.html',
  styleUrls: ['../../estilos-compartidos.css', './configuracion.css'],
})
export class Configuracion {
  protected readonly servicio = inject(AdministracionSistemaServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly fb = inject(FormBuilder);

  protected readonly formulario = this.fb.nonNullable.group({
    parametros: this.fb.nonNullable.array(
      this.servicio.parametros().map((parametro) =>
        this.fb.nonNullable.group({
          clave: [parametro.clave],
          valor: [parametro.valor, Validators.required],
        }),
      ),
    ),
  });

  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly confirmarRestablecer = signal(false);

  protected readonly propuestas = computed(
    () => this.servicio.parametros().filter((parametro) => parametro.propuesta).length,
  );

  protected cambiosPendientes(): number {
    const valores = this.formulario.controls.parametros.getRawValue();
    return valores.filter((valor) => {
      const original = this.servicio.parametros().find((item) => item.clave === valor.clave);
      return original !== undefined && original.valor !== valor.valor;
    }).length;
  }

  protected esValido(parametro: ParametroSistema): boolean {
    const grupo = this.formulario.controls.parametros.controls.find(
      (control) => control.controls.clave.value === parametro.clave,
    );
    return grupo === undefined || grupo.controls.valor.valid;
  }

  protected guardar(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) {
      this.errorGeneral.set('Hay valores fuera del rango permitido. Revisa los campos marcados.');
      return;
    }
    let guardados = 0;
    let mensajeError = '';
    for (const item of this.formulario.controls.parametros.getRawValue()) {
      const resultado = this.servicio.guardarParametro(item.clave, item.valor);
      if (resultado.ok) {
        guardados += 1;
      } else if (mensajeError.length === 0) {
        mensajeError = resultado.mensaje;
      }
    }
    if (mensajeError.length > 0) {
      this.errorGeneral.set(mensajeError);
      this.avisos.mostrar('error', mensajeError);
      return;
    }
    this.errorGeneral.set(null);
    const mensaje = `Se actualizaron ${guardados} parámetros en memoria. Flask aplicará los PATCH definitivos.`;
    this.avisos.mostrar('exito', mensaje);
  }

  protected pedirRestablecimiento(): void {
    this.confirmarRestablecer.set(true);
  }

  protected restablecer(): void {
    this.confirmarRestablecer.set(false);
    this.servicio.restablecerParametros();
    this.formulario.controls.parametros.clear();
    for (const parametro of this.servicio.parametros()) {
      this.formulario.controls.parametros.push(
        this.fb.nonNullable.group({
          clave: [parametro.clave],
          valor: [parametro.valor, Validators.required],
        }),
      );
    }
    this.formulario.markAsPristine();
    this.errorGeneral.set(null);
    this.avisos.mostrar('exito', 'Parámetros restablecidos a los valores iniciales del documento.');
  }

  protected cancelarRestablecimiento(): void {
    this.confirmarRestablecer.set(false);
  }
}
