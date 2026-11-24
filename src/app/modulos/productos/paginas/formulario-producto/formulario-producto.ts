import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionProductos } from '../../componentes/navegacion-productos/navegacion-productos';
import {
  COLORES_PRODUCTO,
  IMAGENES_DISPONIBLES,
  TALLAS_PRODUCTO,
} from '../../datos-simulados/productos-maestro';
import type { CodigoColor, DatosProducto } from '../../modelos/producto-maestro';
import { ProductosServicio } from '../../servicios/productos-servicio';

/** Validación de presentación: hace falta al menos un color y una talla habilitada. */
const seleccionesRequeridas: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const colores = control.get('colores');
  const tallas = control.get('tallas');
  if (!(colores instanceof FormArray) || !(tallas instanceof FormArray)) {
    return null;
  }

  const errores: ValidationErrors = {};
  if (!colores.controls.some((item) => item.value === true)) {
    errores['sinColor'] = true;
  }
  if (!tallas.controls.some((item) => item.value === true && item.enabled)) {
    errores['sinTalla'] = true;
  }
  return Object.keys(errores).length > 0 ? errores : null;
};

@Component({
  selector: 'app-formulario-producto',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, NavegacionProductos],
  templateUrl: './formulario-producto.html',
  styleUrl: './formulario-producto.css',
})
export class FormularioProducto {
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosServicio);
  protected readonly servicio = inject(ProductosServicio);

  private readonly idEditar = this.ruta.snapshot.paramMap.get('id');
  protected readonly producto =
    this.idEditar === null ? undefined : this.servicio.obtenerProducto(Number(this.idEditar));
  protected readonly esEdicion = this.producto !== undefined;

  protected readonly colores = COLORES_PRODUCTO;
  protected readonly tallas = TALLAS_PRODUCTO;
  protected readonly imagenes = IMAGENES_DISPONIBLES;
  protected readonly intento = signal(false);

  protected readonly forma = this.fb.nonNullable.group(
    {
      nombre: [
        this.producto?.nombre ?? '',
        [Validators.required, Validators.minLength(3), Validators.maxLength(60)],
      ],
      categoriaId: [this.producto?.categoriaId ?? 1, Validators.required],
      descripcion: [this.producto?.descripcion ?? ''],
      composicionTextil: [this.producto?.composicionTextil ?? ''],
      guiaMedidas: [this.producto?.guiaMedidas ?? ''],
      precioVenta: [this.producto?.precioVenta ?? 0, [Validators.required, Validators.min(1)]],
      permiteBajoPedido: [this.producto?.permiteBajoPedido ?? true],
      colores: this.fb.nonNullable.array(
        COLORES_PRODUCTO.map((color) =>
          this.fb.nonNullable.control(this.producto?.colores.includes(color.codigo) ?? false),
        ),
      ),
      tallas: this.fb.nonNullable.array(
        TALLAS_PRODUCTO.map((talla) =>
          this.fb.nonNullable.control(this.producto?.tallas.includes(talla.codigo) ?? false),
        ),
      ),
      imagenGeneral: [this.producto?.imagenes.find((imagen) => imagen.color === null)?.url ?? ''],
      imagenesPorColor: this.fb.nonNullable.group({
        BL: [this.urlImagenDe('BL')],
        NG: [this.urlImagenDe('NG')],
        GR: [this.urlImagenDe('GR')],
      }),
      stockMinimo: [5, [Validators.required, Validators.min(0)]],
      cantidadReposicion: [20, [Validators.required, Validators.min(1)]],
    },
    { validators: seleccionesRequeridas },
  );

  private readonly valores = signal(this.forma.getRawValue());

  protected readonly categoriaId = computed(() => Number(this.valores().categoriaId));
  protected readonly categoria = computed(() => this.servicio.categoriaDe(this.categoriaId()));
  protected readonly codigoBase = computed(() =>
    this.servicio.siguienteCodigoSku(this.categoriaId(), this.producto?.id),
  );
  protected readonly coloresSeleccionados = computed(() =>
    COLORES_PRODUCTO.filter((_color, indice) => this.valores().colores[indice] === true).map(
      (color) => color.codigo,
    ),
  );
  protected readonly tallasSeleccionadas = computed(() =>
    TALLAS_PRODUCTO.filter(
      (_talla, indice) =>
        this.valores().tallas[indice] === true &&
        this.forma.controls.tallas.controls[indice]?.enabled === true,
    ).map((talla) => talla.codigo),
  );
  protected readonly skusVistaPrevia = computed(() =>
    this.servicio.previsualizarSkus(
      this.codigoBase(),
      this.tallasSeleccionadas(),
      this.coloresSeleccionados(),
    ),
  );
  protected readonly precioSinIva = computed(() =>
    this.servicio.precioSinIva(Number(this.valores().precioVenta) || 0),
  );

  constructor() {
    this.forma.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.valores.set(this.forma.getRawValue());
    });
    this.forma.controls.categoriaId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.configurarTallas(Number(id), true);
    });
    // También en alta: la categoría define qué tallas son válidas antes de guardar.
    this.configurarTallas(this.producto?.categoriaId ?? 1, false);
  }

  protected urlImagenDe(color: CodigoColor): string {
    return this.producto?.imagenes.find((imagen) => imagen.color === color)?.url ?? '';
  }

  protected invalido(
    campo: 'nombre' | 'precioVenta' | 'stockMinimo' | 'cantidadReposicion',
  ): boolean {
    const control = this.forma.controls[campo];
    return control.invalid && (control.touched || this.intento());
  }

  protected sinColor(): boolean {
    return this.forma.errors?.['sinColor'] === true && this.intento();
  }

  protected sinTalla(): boolean {
    return this.forma.errors?.['sinTalla'] === true && this.intento();
  }

  protected razonesActivacion(): string[] {
    return this.producto ? this.servicio.validarActivacion(this.producto) : [];
  }

  protected guardar(): void {
    this.intento.set(true);
    if (this.forma.invalid) {
      this.forma.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa los campos marcados antes de guardar.');
      return;
    }

    const raw = this.forma.getRawValue();
    const datos: DatosProducto = {
      nombre: raw.nombre,
      categoriaId: Number(raw.categoriaId),
      descripcion: raw.descripcion,
      composicionTextil: raw.composicionTextil,
      guiaMedidas: raw.guiaMedidas,
      precioVenta: Number(raw.precioVenta),
      permiteBajoPedido: raw.permiteBajoPedido,
      colores: this.coloresSeleccionados(),
      tallas: this.tallasSeleccionadas(),
      imagenGeneral: raw.imagenGeneral,
      imagenesPorColor: raw.imagenesPorColor,
      stockMinimo: Number(raw.stockMinimo),
      cantidadReposicion: Number(raw.cantidadReposicion),
    };

    const resultado = this.servicio.guardarProducto(datos, this.producto?.id);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    if (resultado.ok) {
      void this.router.navigate(['/admin/productos']);
    }
  }

  private configurarTallas(id: number, resetear: boolean): void {
    const permitidas = new Set(this.servicio.tallasPorCategoria(id));
    this.forma.controls.tallas.controls.forEach((control, indice) => {
      const codigo = TALLAS_PRODUCTO[indice]?.codigo;
      const permitida = codigo !== undefined && permitidas.has(codigo);
      if (permitida) {
        control.enable({ emitEvent: false });
      } else {
        control.disable({ emitEvent: false });
      }
      if (resetear || !permitida) {
        control.setValue(resetear ? permitida : false, { emitEvent: false });
      }
    });
    this.valores.set(this.forma.getRawValue());
  }
}
