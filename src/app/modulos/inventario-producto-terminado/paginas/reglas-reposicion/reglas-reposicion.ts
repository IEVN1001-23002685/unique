import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { mensajeError } from '../../../../core/api/errores';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionInventarioPt } from '../../componentes/navegacion-inventario-pt/navegacion-inventario-pt';
import { SemaforoInventario } from '../../componentes/semaforo-inventario/semaforo-inventario';
import type { ReglaReposicion } from '../../modelos/inventario-producto-terminado';
import { InventarioProductoServicio } from '../../servicios/inventario-producto-terminado-servicio';

const entero: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  control.value === null || control.value === '' || Number.isInteger(control.value)
    ? null
    : { entero: true };

type CampoRegla = 'stockMinimo' | 'cantidadReposicion';
type GrupoRegla = FormGroup<{
  stockMinimo: FormControl<number>;
  cantidadReposicion: FormControl<number>;
}>;

@Component({
  selector: 'app-reglas-reposicion',
  imports: [ReactiveFormsModule, NavegacionInventarioPt, SemaforoInventario],
  templateUrl: './reglas-reposicion.html',
  styleUrls: ['./reglas-reposicion.css', '../../estilos-compartidos.css'],
})
export class ReglasReposicion {
  protected readonly servicio = inject(InventarioProductoServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly fb = inject(FormBuilder);

  protected readonly busqueda = signal('');
  protected readonly intento = signal(false);
  private firmaValores = '';
  private firmaIdentificadores = '';

  protected readonly forma = this.fb.nonNullable.group({
    reglas: this.fb.nonNullable.array<GrupoRegla>([]),
  });

  constructor() {
    // Las filas llegan de Flask después de construir el componente: se sincroniza el FormArray.
    effect(() => {
      const filas = this.servicio.filas();
      const identificadores = filas.map((fila) => fila.varianteId).join('|');
      const valores = filas
        .map((fila) => `${fila.varianteId}:${fila.stockMinimo}:${fila.cantidadReposicion}`)
        .join('|');
      if (valores === this.firmaValores) {
        return;
      }
      const conservarEdicion =
        !this.forma.pristine && identificadores === this.firmaIdentificadores;
      if (conservarEdicion) {
        return;
      }
      this.firmaIdentificadores = identificadores;
      this.firmaValores = valores;
      this.forma.controls.reglas.clear();
      filas.forEach((fila) =>
        this.forma.controls.reglas.push(this.crearGrupo(fila.stockMinimo, fila.cantidadReposicion)),
      );
      this.forma.markAsPristine();
      if (!untracked(() => this.servicio.puedeEditarReglas())) {
        this.forma.controls.reglas.disable({ emitEvent: false });
      }
    });

    // Se deshabilita el FormArray completo: evita el atributo `disabled` en la plantilla.
    effect(() => {
      const editable = this.servicio.puedeEditarReglas();
      const reglas = this.forma.controls.reglas;
      if (editable && reglas.disabled) {
        reglas.enable({ emitEvent: false });
      } else if (!editable && reglas.enabled) {
        reglas.disable({ emitEvent: false });
      }
    });
  }

  private crearGrupo(stockMinimo: number, cantidadReposicion: number): GrupoRegla {
    return this.fb.nonNullable.group({
      stockMinimo: [stockMinimo, [Validators.required, Validators.min(0), entero]],
      cantidadReposicion: [cantidadReposicion, [Validators.required, Validators.min(1), entero]],
    });
  }

  protected readonly filasConIndice = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    return this.servicio
      .filas()
      .map((fila, indice) => ({ fila, indice }))
      .filter(({ fila }) =>
        [fila.sku, fila.productoNombre, fila.categoriaNombre]
          .join(' ')
          .toLowerCase()
          .includes(termino),
      );
  });

  protected readonly totalReglas = computed(() => this.servicio.filas().length);

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected esInvalido(indice: number, campo: CampoRegla): boolean {
    const control = this.forma.controls.reglas.at(indice)?.controls[campo];
    return control ? control.invalid && (control.touched || this.intento()) : false;
  }

  protected reintentar(): void {
    this.servicio.recargar().subscribe();
  }

  protected guardar(): void {
    if (!this.servicio.puedeEditarReglas()) {
      this.avisos.mostrar('error', 'Solo el Administrador puede editar reglas de reposición.');
      return;
    }
    this.intento.set(true);
    if (this.forma.invalid) {
      this.forma.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa los valores marcados antes de guardar las reglas.');
      return;
    }

    const cambios: ReglaReposicion[] = this.forma.controls.reglas.controls
      .map((grupo, indice) => ({
        varianteId: this.servicio.filas()[indice]?.varianteId ?? 0,
        stockMinimo: Number(grupo.controls.stockMinimo.value),
        cantidadReposicion: Number(grupo.controls.cantidadReposicion.value),
      }))
      .filter((cambio) => cambio.varianteId !== 0);

    this.servicio.guardarReglas(cambios).subscribe({
      next: (resultado) => {
        this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
        if (resultado.ok) {
          this.forma.markAsPristine();
          this.intento.set(false);
        }
      },
      error: (error: unknown) => this.avisos.mostrar('error', mensajeError(error)),
    });
  }
}
