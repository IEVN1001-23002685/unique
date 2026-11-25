import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PRENDAS_OFICIALES } from '../../../../nucleo/datos/catalogo-oficial';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { MATERIALES } from '../../../recetas/datos-simulados/recetas';
import { NavegacionProductos } from '../../componentes/navegacion-productos/navegacion-productos';
import {
  COLORES_PRODUCTO,
  IMAGENES_DISPONIBLES,
  PRODUCTOS_MAESTRO_SIMULADOS,
  TALLAS_PRODUCTO,
} from '../../datos-simulados/productos-maestro';
import type {
  CategoriaMaterialInterfaz,
  CodigoColor,
  DatosProducto,
  LineaMaterialProducto,
} from '../../modelos/producto-maestro';
import { calcularCosteo, porcentajeTelas } from '../../servicios/calculos-producto';
import { ProductosServicio } from '../../servicios/productos-servicio';

type CampoRaiz = 'nombre' | 'stockMinimo' | 'cantidadReposicion';
type CampoCosteo = 'manoObra' | 'bordado' | 'indirectos' | 'margenObjetivoPct';

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

/** Forma de una línea de material; la vista la edita cantidad, merma y porcentaje. */
function crearLinea(fb: FormBuilder, linea: LineaMaterialProducto) {
  return fb.nonNullable.group({
    id: linea.id,
    materialId: linea.materialId,
    codigo: linea.codigo,
    nombre: linea.nombre,
    categoria: linea.categoria,
    unidad: linea.unidad,
    cantidad: [linea.cantidad, [Validators.required, Validators.min(0.000001)]],
    costoBase: linea.costoBase,
    mermaPct: [linea.mermaPct, [Validators.min(0), Validators.max(90)]],
    porcentaje: [linea.porcentaje, [Validators.min(0), Validators.max(100)]],
    porPrenda: linea.porPrenda,
  });
}

@Component({
  selector: 'app-formulario-producto',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink, NavegacionProductos],
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

  /** Precarga opcional desde la sección «Nuevas» (§7 de M10). */
  private readonly slugElegido = this.ruta.snapshot.queryParamMap.get('prenda');
  private readonly prendaElegida = PRENDAS_OFICIALES.find((prenda) => prenda.slug === this.slugElegido);
  private readonly nombreInicial = this.prendaElegida?.nombre ?? this.producto?.nombre ?? '';
  private readonly categoriaInicial =
    this.prendaElegida?.categoriaId ?? this.producto?.categoriaId ?? 1;
  private readonly costeoInicial =
    this.producto?.costeo ??
    PRODUCTOS_MAESTRO_SIMULADOS.find((item) => item.slug === this.prendaElegida?.slug)?.costeo ??
    PRODUCTOS_MAESTRO_SIMULADOS[0].costeo;

  protected readonly colores = COLORES_PRODUCTO;
  protected readonly tallas = TALLAS_PRODUCTO;
  protected readonly imagenes = IMAGENES_DISPONIBLES;
  protected readonly tiposMaterial: readonly CategoriaMaterialInterfaz[] = [
    'Tela',
    'Hilo',
    'Estabilizador',
    'Avio',
    'Etiqueta',
    'Empaque',
  ];
  protected readonly intento = signal(false);
  protected readonly tipoMaterial = signal<CategoriaMaterialInterfaz>('Tela');
  protected readonly idMaterial = signal('');

  protected readonly forma = this.fb.nonNullable.group(
    {
      nombre: [
        this.nombreInicial,
        [Validators.required, Validators.minLength(3), Validators.maxLength(60)],
      ],
      categoriaId: [this.categoriaInicial, Validators.required],
      descripcion: [this.prendaElegida?.descripcion ?? this.producto?.descripcion ?? ''],
      composicionTextil: [
        this.prendaElegida?.composicion ?? this.producto?.composicionTextil ?? '',
      ],
      guiaMedidas: [this.prendaElegida?.guiaMedidas ?? this.producto?.guiaMedidas ?? ''],
      permiteBajoPedido: [this.producto?.permiteBajoPedido ?? true],
      colores: this.fb.nonNullable.array(
        COLORES_PRODUCTO.map((color) =>
          this.fb.nonNullable.control(
            this.prendaElegida
              ? true
              : (this.producto?.colores.includes(color.codigo) ?? false),
          ),
        ),
      ),
      tallas: this.fb.nonNullable.array(
        TALLAS_PRODUCTO.map((talla) =>
          this.fb.nonNullable.control(
            this.prendaElegida
              ? this.prendaElegida.tallas.includes(talla.codigo)
              : (this.producto?.tallas.includes(talla.codigo) ?? false),
          ),
        ),
      ),
      imagenGeneral: [
        this.prendaElegida?.imagen ??
          this.producto?.imagenes.find((imagen) => imagen.color === null)?.url ??
          '',
      ],
      imagenesPorColor: this.fb.nonNullable.group({
        BL: [this.urlImagenDe('BL')],
        NG: [this.urlImagenDe('NG')],
        GR: [this.urlImagenDe('GR')],
      }),
      costeo: this.fb.nonNullable.group({
        lineas: this.fb.nonNullable.array(
          this.costeoInicial.lineas.map((linea) => crearLinea(this.fb, linea)),
        ),
        manoObra: [
          this.costeoInicial.manoObra,
          [Validators.required, Validators.min(0), Validators.max(100000)],
        ],
        bordado: [
          this.costeoInicial.bordado,
          [Validators.required, Validators.min(0), Validators.max(100000)],
        ],
        indirectos: [
          this.costeoInicial.indirectos,
          [Validators.required, Validators.min(0), Validators.max(100000)],
        ],
        margenObjetivoPct: [
          this.costeoInicial.margenObjetivoPct,
          [Validators.required, Validators.min(1), Validators.max(90)],
        ],
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
  /** Precio reactivo: se recalcula con cada cambio, nunca se captura a mano. */
  protected readonly desglose = computed(() => calcularCosteo(this.valores().costeo));
  protected readonly totalPorcentajeTelas = computed(() =>
    porcentajeTelas(this.valores().costeo.lineas),
  );
  protected readonly materialesFiltrados = computed(() =>
    MATERIALES.filter(
      (material) =>
        material.categoria === this.tipoMaterial() &&
        !this.valores().costeo.lineas.some((linea) => linea.materialId === material.id),
    ),
  );

  constructor() {
    this.forma.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.valores.set(this.forma.getRawValue());
    });
    this.forma.controls.categoriaId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.configurarTallas(Number(id), true);
    });
    this.configurarTallas(this.categoriaInicial, false);
  }

  protected get lineas() {
    return this.forma.controls.costeo.controls.lineas;
  }

  protected urlImagenDe(color: CodigoColor): string {
    return (
      this.prendaElegida?.imagenesPorColor[color] ??
      this.producto?.imagenes.find((imagen) => imagen.color === color)?.url ??
      ''
    );
  }

  protected invalido(campo: CampoRaiz | CampoCosteo): boolean {
    const control: AbstractControl =
      campo in this.forma.controls.costeo.controls
        ? this.forma.controls.costeo.controls[campo as CampoCosteo]
        : this.forma.controls[campo as CampoRaiz];
    return control.invalid && (control.touched || this.intento());
  }

  protected sinColor(): boolean {
    return this.forma.errors?.['sinColor'] === true && this.intento();
  }

  protected sinTalla(): boolean {
    return this.forma.errors?.['sinTalla'] === true && this.intento();
  }

  protected alCambiarTipo(evento: Event): void {
    this.tipoMaterial.set((evento.target as HTMLSelectElement).value as CategoriaMaterialInterfaz);
    this.idMaterial.set('');
  }

  protected alCambiarMaterial(evento: Event): void {
    this.idMaterial.set((evento.target as HTMLSelectElement).value);
  }

  protected agregarMaterial(): void {
    const material = MATERIALES.find((item) => item.id === Number(this.idMaterial()));
    if (!material) {
      this.avisos.mostrar('advertencia', 'Elige un material de la lista.');
      return;
    }
    if (this.valores().costeo.lineas.some((linea) => linea.materialId === material.id)) {
      this.avisos.mostrar('error', `El material «${material.nombre}» ya está en la composición.`);
      return;
    }

    const linea: LineaMaterialProducto = {
      id: this.lineas.controls.reduce(
        (maximo, control) => Math.max(maximo, control.controls.id.value),
        0,
      ) + 1,
      materialId: material.id,
      codigo: material.codigo,
      nombre: material.nombre,
      categoria: material.categoria,
      unidad: material.unidadBase,
      cantidad: 1,
      costoBase: material.costoBase,
      mermaPct: material.mermaPct,
      porcentaje: 0,
      porPrenda: material.porPrenda,
    };
    this.lineas.push(crearLinea(this.fb, linea));
    this.idMaterial.set('');
    this.avisos.mostrar(
      'exito',
      `${material.nombre} agregado. Ajusta cantidad, merma y porcentaje; el precio se recalcula solo.`,
    );
  }

  protected quitarMaterial(indice: number): void {
    this.lineas.removeAt(indice);
    this.avisos.mostrar('advertencia', 'Línea eliminada. Revisa que las telas sumen 100 %.');
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
      costeo: raw.costeo,
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
