import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionInventarioPt } from '../../componentes/navegacion-inventario-pt/navegacion-inventario-pt';
import type { FilaExistencia, FilaInventario } from '../../modelos/inventario-producto-terminado';
import { InventarioProductoServicio } from '../../servicios/inventario-producto-terminado-servicio';

const entero: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  control.value === null || control.value === '' || Number.isInteger(control.value)
    ? null
    : { entero: true };

@Component({
  selector: 'app-ajuste-inventario',
  imports: [RouterLink, ReactiveFormsModule, ModalConfirmacion, NavegacionInventarioPt],
  templateUrl: './ajuste-inventario.html',
  styleUrls: ['./ajuste-inventario.css', '../../estilos-compartidos.css'],
})
export class AjusteInventario {
  protected readonly servicio = inject(InventarioProductoServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly fb = inject(FormBuilder);

  protected readonly filas = this.servicio.filas;
  protected readonly primeraFila = this.filas().at(0);

  protected readonly forma = this.fb.nonNullable.group({
    varianteId: [this.primeraFila?.varianteId ?? 0, [Validators.required]],
    cantidadContada: [
      this.primeraFila?.existencia ?? 0,
      [Validators.required, Validators.min(0), entero],
    ],
    motivo: ['', [Validators.required, Validators.minLength(4)]],
  });

  protected readonly varianteId = signal(this.forma.controls.varianteId.value);
  protected readonly conteo = signal(this.forma.controls.cantidadContada.value);
  protected readonly intento = signal(false);
  protected readonly confirmando = signal(false);

  protected readonly filaSeleccionada = computed<FilaInventario | undefined>(() =>
    this.filas().find((fila) => fila.varianteId === this.varianteId()),
  );

  protected readonly detalleSeleccionado = computed<FilaExistencia | undefined>(() =>
    this.servicio.existencias().find((fila) => fila.varianteId === this.varianteId()),
  );

  protected readonly diferencia = computed(
    () => this.conteo() - (this.filaSeleccionada()?.existencia ?? 0),
  );

  protected readonly textoDiferencia = computed(() => {
    const valor = this.diferencia();
    return valor === 0 ? 'Sin diferencia' : `${valor > 0 ? '+' : ''}${valor} unidades`;
  });

  protected readonly errorConteo = computed<string | null>(() => {
    const fila = this.filaSeleccionada();
    if (!fila) {
      return 'Selecciona un SKU válido.';
    }
    const valor = this.conteo();
    if (!Number.isInteger(valor) || valor < 0) {
      return 'Captura una cantidad entera mayor o igual a cero.';
    }
    if (valor < fila.reservado) {
      return `La cantidad contada no puede ser menor al reservado (${fila.reservado}); el disponible no puede ser negativo.`;
    }
    return null;
  });

  protected alCambiarVariante(evento: Event): void {
    const id = Number((evento.target as HTMLSelectElement).value);
    const fila = this.filas().find((item) => item.varianteId === id);
    this.forma.controls.varianteId.setValue(id);
    this.varianteId.set(id);
    const cantidad = fila?.existencia ?? 0;
    this.forma.controls.cantidadContada.setValue(cantidad);
    this.conteo.set(cantidad);
  }

  protected alCambiarConteo(evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value;
    this.conteo.set(texto === '' ? Number.NaN : Number(texto));
  }

  protected esInvalido(campo: 'cantidadContada' | 'motivo'): boolean {
    const control = this.forma.controls[campo];
    return control.invalid && (control.touched || this.intento());
  }

  protected enviar(): void {
    this.intento.set(true);
    if (this.forma.invalid || this.errorConteo() !== null) {
      this.forma.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa el SKU, la cantidad contada y el motivo obligatorio.');
      return;
    }
    if (this.diferencia() < 0) {
      this.confirmando.set(true);
      return;
    }
    this.registrar();
  }

  protected confirmar(): void {
    this.confirmando.set(false);
    this.registrar();
  }

  private registrar(): void {
    const fila = this.filaSeleccionada();
    if (!fila) {
      return;
    }

    const resultado = this.servicio.registrarAjuste({
      varianteId: fila.varianteId,
      cantidadContada: this.conteo(),
      motivo: this.forma.controls.motivo.value,
    });
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);

    if (resultado.ok) {
      this.forma.controls.motivo.setValue('');
      const actualizada = this.filas().find((item) => item.varianteId === fila.varianteId);
      const cantidad = actualizada?.existencia ?? fila.existencia;
      this.forma.controls.cantidadContada.setValue(cantidad);
      this.conteo.set(cantidad);
      this.forma.controls.cantidadContada.markAsUntouched();
      this.forma.controls.motivo.markAsUntouched();
      this.intento.set(false);
    }
  }
}
