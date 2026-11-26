import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  type FormControl,
  type FormGroup,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { decimalNoNegativo } from '../../../../compartido/validadores/validadores-negocio';
import { mensajeError } from '../../../../core/api/errores';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionInventario } from '../../componentes/navegacion-inventario/navegacion-inventario';
import type { CambioPolitica, ExistenciaVista } from '../../modelos/inventario';
import { InventarioServicio, redondear4 } from '../../servicios/inventario-servicio';

type FilaPolitica = FormGroup<{
  existenciaId: FormControl<number>;
  stockMinimo: FormControl<number>;
  stockSeguridad: FormControl<number>;
  consumoDiarioManual: FormControl<number>;
}>;

@Component({
  selector: 'app-politicas',
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink, NavegacionInventario],
  templateUrl: './politicas.html',
  styleUrls: ['./politicas.css', '../../inventario-compartido.css'],
})
export class Politicas {
  private readonly fb = inject(FormBuilder);
  private readonly avisos = inject(AvisosServicio);
  protected readonly servicio = inject(InventarioServicio);

  protected readonly intentoEnvio = signal(false);
  protected readonly busqueda = signal('');
  protected readonly filas = new FormArray<FilaPolitica>([]);

  /** Todas las filas del formulario; el filtro solo oculta renglones de la tabla. */
  protected readonly todas = computed(() =>
    this.servicio.vistas().filter((vista) => vista.material.activo),
  );

  protected readonly vistas = computed(() => {
    const texto = this.busqueda().trim().toLocaleLowerCase('es-MX');
    if (texto === '') {
      return this.todas();
    }
    return this.todas().filter((vista) =>
      `${vista.material.codigo} ${vista.material.nombre} ${vista.color}`
        .toLocaleLowerCase('es-MX')
        .includes(texto),
    );
  });

  protected readonly formulario = this.fb.group({ filas: this.filas });

  private filasInicializadas = false;

  constructor() {
    effect(() => {
      if (this.filasInicializadas || !this.servicio.cargado()) {
        return;
      }
      this.filasInicializadas = true;
      this.prepararFilas(this.todas());
    });
  }

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected indiceDe(vista: ExistenciaVista): number {
    return this.todas().findIndex((candidata) => candidata.id === vista.id);
  }

  protected vistaDe(indice: number): ExistenciaVista | undefined {
    return this.todas()[indice];
  }

  protected puntoReorden(indice: number): number {
    const vista = this.vistaDe(indice);
    const fila = this.filas.at(indice);
    if (!vista || !fila || vista.plazoPendiente) {
      return 0;
    }
    if (vista.puntoReorden !== undefined && vista.puntoReorden !== null) {
      return vista.puntoReorden;
    }
    // Flask calcula el punto de reorden; este cálculo solo aplica si no vino en la respuesta.
    if (vista.material.plazoDias === null) {
      return 0;
    }
    const consumo = this.servicio.tieneHistoricoConsumo(vista.materialId, vista.color)
      ? vista.consumoDiario
      : fila.controls.consumoDiarioManual.value;
    return redondear4(consumo * vista.material.plazoDias + fila.controls.stockSeguridad.value);
  }

  protected campoInvalido(
    indice: number,
    campo: 'stockMinimo' | 'stockSeguridad' | 'consumoDiarioManual',
  ): boolean {
    const fila = this.filas.at(indice);
    if (!fila) {
      return false;
    }
    const control = fila.controls[campo];
    return control.invalid && (control.touched || this.intentoEnvio());
  }

  protected guardar(): void {
    this.intentoEnvio.set(true);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa los valores: deben ser mayores o iguales a cero.');
      return;
    }

    const cambios: CambioPolitica[] = this.filas.getRawValue().map((fila) => ({
      existenciaId: fila.existenciaId,
      stockMinimo: fila.stockMinimo,
      stockSeguridad: fila.stockSeguridad,
      consumoDiarioManual: fila.consumoDiarioManual,
    }));
    this.servicio.guardarPoliticas(cambios).subscribe({
      next: () => {
        this.prepararFilas(this.todas());
        this.avisos.mostrar('exito', 'Políticas actualizadas en Flask.');
      },
      error: (error: unknown) => this.avisos.mostrar('error', mensajeError(error)),
    });
  }

  protected reintentar(): void {
    this.servicio.recargar().subscribe();
  }

  private prepararFilas(vistas: ExistenciaVista[]): void {
    this.filas.clear();
    for (const vista of vistas) {
      this.filas.push(
        this.fb.group({
          existenciaId: this.fb.nonNullable.control(vista.id),
          stockMinimo: this.fb.nonNullable.control(vista.stockMinimo, [decimalNoNegativo]),
          stockSeguridad: this.fb.nonNullable.control(vista.stockSeguridad, [decimalNoNegativo]),
          consumoDiarioManual: this.fb.nonNullable.control(vista.consumoDiarioManual, [
            decimalNoNegativo,
          ]),
        }),
      );
    }
  }
}
