import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, debounceTime, map, of, switchMap } from 'rxjs';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionRecetas } from '../../componentes/navegacion-recetas/navegacion-recetas';
import type { CodigoTalla } from '../../../productos/modelos/producto-maestro';
import type { DatosReceta, LineaReceta, Receta, UnidadCaptura } from '../../modelos/receta';
import { RecetasServicio, type PreviewReceta } from '../../servicios/recetas-servicio';
import { convertirABase, convertirDeBase } from '../../servicios/calculos-receta';

interface LineaVista {
  materialCodigo: string;
  nombre: string;
  categoria: string;
  unidadBase: string;
  cantidadCapturada: number;
  unidadCaptura: LineaReceta['unidadCaptura'];
  cantidadNeta: number;
  bruta: number;
  mermaPct: number;
  costo: number;
  esEtiqueta: boolean;
}

interface FormaLinea {
  materialCodigo: FormControl<string>;
  cantidadCapturada: FormControl<number>;
  unidadCaptura: FormControl<UnidadCaptura>;
  factorConsumo: FormControl<number>;
  mermaPct: FormControl<number>;
  esEtiqueta: FormControl<boolean>;
  nota: FormControl<string>;
}

interface FormaBordado {
  disenoId: FormControl<number>;
  aplicaciones: FormControl<number>;
  ubicacion: FormControl<string>;
}

interface FormaReceta {
  productoId: FormControl<number>;
  talla: FormControl<CodigoTalla>;
  nota: FormControl<string>;
  manoObra: FormControl<number>;
  costoBordado: FormControl<number>;
  costosIndirectos: FormControl<number>;
  lineas: FormArray<FormGroup<FormaLinea>>;
  bordados: FormArray<FormGroup<FormaBordado>>;
}

@Component({
  selector: 'app-editor-receta',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    RouterLink,
    ModalConfirmacion,
    NavegacionRecetas,
  ],
  templateUrl: './editor-receta.html',
  styleUrl: './editor-receta.css',
})
export class EditorReceta {
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosServicio);
  protected readonly servicio = inject(RecetasServicio);

  private readonly idCrudo = this.ruta.snapshot.paramMap.get('id');
  private readonly id = this.idCrudo === null ? 0 : Number(this.idCrudo);
  protected readonly esNueva = this.id === 0;

  private readonly recetaInterna = signal<Receta | undefined>(undefined);
  protected readonly receta = this.recetaInterna.asReadonly();
  protected readonly existe = computed(() => this.receta() !== undefined);
  protected readonly soloLectura = computed(() => this.receta()?.estado !== 'BORRADOR');

  protected readonly materiales = this.servicio.materiales;
  protected readonly unidades: LineaReceta['unidadCaptura'][] = [
    'cm2',
    'cm',
    'm2',
    'm',
    'g',
    'pieza',
  ];
  protected readonly disenos = this.servicio.disenos;
  protected readonly materialNuevo = signal('HIL-COS');
  protected readonly intento = signal(false);
  protected readonly archivando = signal(false);
  protected readonly copiarProducto = signal(1);
  protected readonly copiarTalla = signal<CodigoTalla>('CH');
  private readonly vistaPreview = signal<PreviewReceta | null>(null);

  protected readonly forma = this.fb.group<FormaReceta>({
    productoId: this.fb.nonNullable.control(1, Validators.required),
    talla: this.fb.nonNullable.control<CodigoTalla>('CH', Validators.required),
    nota: this.fb.nonNullable.control(''),
    manoObra: this.fb.nonNullable.control(0, [Validators.min(0)]),
    costoBordado: this.fb.nonNullable.control(0, [Validators.min(0)]),
    costosIndirectos: this.fb.nonNullable.control(0, [Validators.min(0)]),
    lineas: this.fb.array<FormGroup<FormaLinea>>([]),
    bordados: this.fb.array<FormGroup<FormaBordado>>([]),
  });

  private readonly valores = signal(this.forma.getRawValue());

  protected readonly lineasVista = computed<LineaVista[]>(() =>
    this.valores().lineas.map((linea) => {
      const material = this.servicio.materialDe(linea.materialCodigo);
      const preview = this.vistaPreview()?.lineas.find(
        (item) => item.material_codigo === linea.materialCodigo,
      );
      const persistida = this.receta()?.lineas.find(
        (item) => item.materialCodigo === linea.materialCodigo,
      );
      const neta = convertirABase(Number(linea.cantidadCapturada), linea.unidadCaptura);
      return {
        materialCodigo: linea.materialCodigo,
        nombre: material?.nombre ?? linea.materialCodigo,
        categoria: material?.categoria ?? '—',
        unidadBase: material?.unidadBase ?? '—',
        cantidadCapturada: Number(linea.cantidadCapturada),
        unidadCaptura: linea.unidadCaptura,
        cantidadNeta: neta,
        bruta: preview ? Number(preview.cantidad_bruta) : (persistida?.cantidadBruta ?? 0),
        mermaPct: Number(linea.mermaPct),
        costo: preview ? Number(preview.costo_linea) : (persistida?.costoLinea ?? 0),
        esEtiqueta: linea.esEtiqueta,
      };
    }),
  );

  /** Proyección temporal del formulario para alimentar las reglas y la previsualización. */
  private readonly recetaVista = computed<Receta>(() => {
    const base = this.receta();
    if (!base) {
      throw new Error('Receta no disponible');
    }
    const raw = this.valores();
    return {
      ...base,
      productoId: Number(raw.productoId),
      talla: raw.talla,
      manoObra: Number(raw.manoObra),
      costosIndirectos: Number(raw.costosIndirectos),
      costoBordado: Number(raw.costoBordado),
      lineas: this.lineasVista().map((vista, indice) => ({
        id: base.lineas[indice]?.id ?? indice + 1,
        materialCodigo: vista.materialCodigo,
        cantidadNeta: vista.cantidadNeta,
        unidadCaptura: vista.unidadCaptura,
        factorConsumo: Number(raw.lineas[indice]?.factorConsumo ?? 1),
        mermaPct: vista.mermaPct,
        cantidadBruta: vista.bruta,
        costoLinea: vista.costo,
        esEtiqueta: vista.esEtiqueta,
        nota: raw.lineas[indice]?.nota ?? '',
      })),
      bordados: raw.bordados.map((bordado, indice) => ({
        id: base.bordados[indice]?.id ?? indice + 1,
        disenoId: Number(bordado.disenoId),
        aplicaciones: Number(bordado.aplicaciones),
        ubicacion: bordado.ubicacion,
      })),
    };
  });

  protected readonly costeo = computed(() =>
    this.vistaPreview()?.costo ?? this.servicio.costeo(this.recetaVista()),
  );
  protected readonly alcanza = computed(
    () => this.vistaPreview()?.capacidad ?? this.servicio.alcanzaPara(this.recetaVista()),
  );
  protected readonly precioVigente = computed(() =>
    this.servicio.precioVigente(Number(this.valores().productoId)),
  );
  protected readonly margen = computed(
    () =>
      this.vistaPreview()?.margen ??
      this.servicio.margenDe(this.precioVigente(), this.recetaVista()),
  );
  protected readonly razones = computed(() => this.servicio.validarActivacion(this.recetaVista()));
  protected readonly pendientes = computed(() =>
    this.servicio.disenosPendientes(this.recetaVista()),
  );
  protected readonly etiquetasFaltantes = computed(() => {
    const codigos = new Set(this.lineasVista().map((linea) => linea.materialCodigo));
    return this.servicio
      .etiquetasEsperadas(Number(this.valores().productoId), this.valores().talla)
      .filter((codigo) => !codigos.has(codigo));
  });

  constructor() {
    this.forma.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.valores.set(this.forma.getRawValue());
    });
    this.forma.valueChanges
      .pipe(
        takeUntilDestroyed(),
        debounceTime(350),
        switchMap(() => {
          if (!this.receta()) {
            return of(null);
          }
          return this.servicio.previsualizar(this.datosReceta()).pipe(catchError(() => of(null)));
        }),
      )
      .subscribe((vista) => {
        if (vista) {
          this.vistaPreview.set(vista);
        }
      });

    this.servicio.recargar().subscribe({
      next: () => {
        const cargada = this.esNueva ? this.recetaVacia() : this.servicio.recetaDe(this.id);
        if (!cargada) {
          this.avisos.mostrar('error', 'No encontramos la receta solicitada en Flask.');
          return;
        }
        this.recetaInterna.set(cargada);
        this.copiarProducto.set(cargada.productoId);
        this.copiarTalla.set(cargada.talla);
        this.rellenarForma(cargada);
        if (this.soloLectura()) {
          this.forma.disable({ emitEvent: false });
        } else if (!this.esNueva) {
          this.forma.controls.productoId.disable({ emitEvent: false });
          this.forma.controls.talla.disable({ emitEvent: false });
        }
        this.actualizarPreview();
      },
      error: () => this.avisos.mostrar('error', 'No fue posible cargar la receta desde Flask.'),
    });
  }

  /** Receta temporal para el alta; Flask asigna identificador y versión al guardar. */
  private recetaVacia(): Receta {
    const productoId = Number(this.ruta.snapshot.queryParamMap.get('producto') ?? 1);
    const tallaQuery = this.ruta.snapshot.queryParamMap.get('talla') as CodigoTalla | null;
    const tallas = this.servicio.tallasDeProducto(productoId);
    const talla = tallaQuery && tallas.includes(tallaQuery) ? tallaQuery : (tallas[0] ?? 'CH');
    return {
      id: 0,
      productoId,
      talla,
      version: 0,
      estado: 'BORRADOR',
      origenRecetaId: null,
      manoObra: 0,
      costoBordado: 0,
      costosIndirectos: 0,
      nota: '',
      creadaPor: 'Por asignar',
      creadaEn: '',
      activadaEn: null,
      lineas: this.servicio.etiquetasEsperadas(productoId, talla).map((codigo, indice) => ({
        id: indice + 1,
        materialCodigo: codigo,
        cantidadNeta: 1,
        unidadCaptura: 'pieza',
        factorConsumo: 1,
        mermaPct: 0,
        cantidadBruta: 1,
        esEtiqueta: true,
        nota: 'Etiqueta precargada según §11.4',
      })),
      bordados: [],
      bitacora: [],
    };
  }

  private rellenarForma(receta: Receta): void {
    this.forma.controls.productoId.setValue(receta.productoId, { emitEvent: false });
    this.forma.controls.talla.setValue(receta.talla, { emitEvent: false });
    this.forma.controls.nota.setValue(receta.nota, { emitEvent: false });
    this.forma.controls.manoObra.setValue(receta.manoObra, { emitEvent: false });
    this.forma.controls.costoBordado.setValue(receta.costoBordado, { emitEvent: false });
    this.forma.controls.costosIndirectos.setValue(receta.costosIndirectos, { emitEvent: false });
    this.forma.controls.lineas.clear({ emitEvent: false });
    for (const linea of receta.lineas) {
      this.forma.controls.lineas.push(this.lineaForm(linea), { emitEvent: false });
    }
    this.forma.controls.bordados.clear({ emitEvent: false });
    for (const bordado of receta.bordados) {
      this.forma.controls.bordados.push(
        this.fb.group<FormaBordado>({
          disenoId: this.fb.nonNullable.control(bordado.disenoId, Validators.required),
          aplicaciones: this.fb.nonNullable.control(bordado.aplicaciones, [
            Validators.required,
            Validators.min(1),
          ]),
          ubicacion: this.fb.nonNullable.control(bordado.ubicacion),
        }),
        { emitEvent: false },
      );
    }
    this.valores.set(this.forma.getRawValue());
  }

  private actualizarPreview(): void {
    if (!this.receta()) {
      return;
    }
    this.servicio
      .previsualizar(this.datosReceta())
      .pipe(catchError(() => of(null)))
      .subscribe((vista) => {
        if (vista) {
          this.vistaPreview.set(vista);
        }
      });
  }

  private lineaFormDesde(
    materialCodigo: string,
    cantidadCapturada: number,
    unidadCaptura: UnidadCaptura,
    mermaPct: number,
    esEtiqueta: boolean,
    nota: string,
  ): FormGroup<FormaLinea> {
    return this.fb.group<FormaLinea>({
      materialCodigo: this.fb.nonNullable.control(materialCodigo, Validators.required),
      cantidadCapturada: this.fb.nonNullable.control(cantidadCapturada, [Validators.min(0)]),
      unidadCaptura: this.fb.nonNullable.control(unidadCaptura, Validators.required),
      factorConsumo: this.fb.nonNullable.control(1, [Validators.min(0.001)]),
      mermaPct: this.fb.nonNullable.control(mermaPct, [Validators.min(0), Validators.max(99.99)]),
      esEtiqueta: this.fb.nonNullable.control(esEtiqueta),
      nota: this.fb.nonNullable.control(nota),
    });
  }

  private lineaForm(linea: LineaReceta): FormGroup<FormaLinea> {
    const grupo = this.lineaFormDesde(
      linea.materialCodigo,
      convertirDeBase(linea.cantidadNeta, linea.unidadCaptura),
      linea.unidadCaptura,
      linea.mermaPct,
      linea.esEtiqueta,
      linea.nota,
    );
    grupo.controls.factorConsumo.setValue(linea.factorConsumo);
    return grupo;
  }

  protected invalido(campo: 'manoObra' | 'costoBordado' | 'costosIndirectos'): boolean {
    const control = this.forma.controls[campo];
    return control.invalid && (control.touched || this.intento());
  }

  protected agregarLinea(): void {
    const material = this.servicio.materialDe(this.materialNuevo());
    if (!material) {
      return;
    }
    const unidad = material.unidadBase === 'pieza' ? 'pieza' : material.unidadBase;
    this.forma.controls.lineas.push(
      this.lineaFormDesde(material.codigo, 1, unidad, material.mermaPct, false, ''),
    );
  }

  protected agregarEtiquetas(): void {
    const presentes = new Set(this.lineasVista().map((linea) => linea.materialCodigo));
    const faltantes = this.etiquetasFaltantes();
    for (const codigo of faltantes) {
      if (presentes.has(codigo)) {
        continue;
      }
      this.forma.controls.lineas.push(
        this.lineaFormDesde(codigo, 1, 'pieza', 0, true, 'Etiqueta precargada según §11.4'),
      );
    }
    this.avisos.mostrar(
      faltantes.length === 0 ? 'informacion' : 'exito',
      faltantes.length === 0
        ? 'Las etiquetas de este producto ya están completas.'
        : `Se agregaron ${faltantes.length} etiqueta(s) precargada(s).`,
    );
  }

  protected alCambiarMaterial(indice: number, evento: Event): void {
    const codigo = (evento.target as HTMLSelectElement).value;
    const material = this.servicio.materialDe(codigo);
    const grupo = this.forma.controls.lineas.at(indice);
    if (!material || !grupo) {
      return;
    }
    grupo.controls.unidadCaptura.setValue(
      material.unidadBase === 'pieza' ? 'pieza' : material.unidadBase,
    );
    grupo.controls.mermaPct.setValue(material.mermaPct);
  }

  protected quitarLinea(indice: number): void {
    this.forma.controls.lineas.removeAt(indice);
  }

  protected agregarBordado(): void {
    this.forma.controls.bordados.push(
      this.fb.nonNullable.group({
        disenoId: [this.disenos()[0]?.id ?? 1, Validators.required],
        aplicaciones: [1, [Validators.required, Validators.min(1)]],
        ubicacion: ['Pecho'],
      }),
    );
  }

  protected quitarBordado(indice: number): void {
    this.forma.controls.bordados.removeAt(indice);
  }

  protected guardar(): void {
    this.guardarBorrador().subscribe();
  }

  private guardarBorrador(): Observable<number | null> {
    this.intento.set(true);
    if (this.forma.invalid) {
      this.forma.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa las cantidades, factores y mermas marcadas.');
      return of(null);
    }
    return this.servicio
      .guardarBorrador(this.datosReceta(), this.esNueva ? undefined : this.id)
      .pipe(
        map((resultado) => {
          this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
          if (resultado.ok && this.esNueva && resultado.recetaId !== undefined) {
            void this.router.navigate(['/admin/recetas/editar', resultado.recetaId]);
          }
          return resultado.ok ? (resultado.recetaId ?? this.id) : null;
        }),
      );
  }

  private datosReceta(): DatosReceta {
    const raw = this.forma.getRawValue();
    return {
      productoId: Number(raw.productoId),
      talla: raw.talla,
      nota: raw.nota,
      manoObra: Number(raw.manoObra),
      costoBordado: Number(raw.costoBordado),
      costosIndirectos: Number(raw.costosIndirectos),
      lineas: raw.lineas.map((linea) => ({
        materialCodigo: linea.materialCodigo,
        cantidadNeta: convertirABase(Number(linea.cantidadCapturada), linea.unidadCaptura),
        unidadCaptura: linea.unidadCaptura,
        factorConsumo: Number(linea.factorConsumo),
        mermaPct: Number(linea.mermaPct),
        esEtiqueta: linea.esEtiqueta,
        nota: linea.nota,
      })),
      bordados: raw.bordados.map((bordado) => ({
        disenoId: Number(bordado.disenoId),
        aplicaciones: Number(bordado.aplicaciones),
        ubicacion: bordado.ubicacion,
      })),
    };
  }

  protected activar(): void {
    const razones = this.servicio.validarActivacion(this.recetaVista());
    if (razones.length > 0) {
      this.avisos.mostrar('advertencia', `No se puede activar: ${razones.join(' ')}`);
      return;
    }
    this.guardarBorrador()
      .pipe(
        switchMap((id) => (id === null ? of(null) : this.servicio.activarReceta(id))),
      )
      .subscribe((resultado) => {
        if (!resultado) {
          return;
        }
        this.avisos.mostrar(resultado.ok ? 'exito' : 'advertencia', resultado.mensaje);
        if (resultado.ok) {
          void this.router.navigate(['/admin/recetas']);
        }
      });
  }

  protected copiar(): void {
    this.servicio
      .copiarReceta(this.id, Number(this.copiarProducto()), this.copiarTalla())
      .subscribe((resultado) => {
        this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
        if (resultado.ok && resultado.recetaId !== undefined) {
          void this.router.navigate(['/admin/recetas/editar', resultado.recetaId]);
        }
      });
  }

  protected pedirArchivado(): void {
    this.archivando.set(true);
  }

  protected confirmarArchivado(): void {
    this.servicio.archivarReceta(this.id).subscribe((resultado) => {
      this.avisos.mostrar(resultado.ok ? 'advertencia' : 'error', resultado.mensaje);
      this.archivando.set(false);
    });
  }

  protected tallasDeCopia(): CodigoTalla[] {
    return this.servicio.tallasDeProducto(Number(this.copiarProducto()));
  }

  protected alCambiarProductoNuevo(evento: Event): void {
    const id = Number((evento.target as HTMLSelectElement).value);
    const tallas = this.servicio.tallasDeProducto(id);
    this.forma.controls.productoId.setValue(id);
    if (!tallas.includes(this.forma.controls.talla.value)) {
      this.forma.controls.talla.setValue(tallas[0] ?? 'UN');
    }
    this.sincronizarEtiquetas(id, this.forma.controls.talla.value);
  }

  protected alCambiarTallaNueva(evento: Event): void {
    const talla = (evento.target as HTMLSelectElement).value as CodigoTalla;
    this.sincronizarEtiquetas(Number(this.forma.controls.productoId.value), talla);
  }

  /** Al crear una receta, las etiquetas se precargan y se ajustan al producto y la talla. */
  private sincronizarEtiquetas(productoId: number, talla: CodigoTalla): void {
    const lineas = this.forma.controls.lineas;
    for (let indice = lineas.length - 1; indice >= 0; indice -= 1) {
      const control = lineas.at(indice);
      if (control?.controls.esEtiqueta.value) {
        lineas.removeAt(indice);
      }
    }
    for (const codigo of this.servicio.etiquetasEsperadas(productoId, talla)) {
      lineas.push(
        this.lineaFormDesde(codigo, 1, 'pieza', 0, true, 'Etiqueta precargada según §11.4'),
      );
    }
  }

  protected alCambiarMaterialNuevo(evento: Event): void {
    this.materialNuevo.set((evento.target as HTMLSelectElement).value);
  }

  protected alCambiarTallaCopia(evento: Event): void {
    this.copiarTalla.set((evento.target as HTMLSelectElement).value as CodigoTalla);
  }

  protected alCambiarProductoCopia(evento: Event): void {
    const id = Number((evento.target as HTMLSelectElement).value);
    this.copiarProducto.set(id);
    const tallas = this.servicio.tallasDeProducto(id);
    if (!tallas.includes(this.copiarTalla())) {
      this.copiarTalla.set(tallas[0] ?? 'UN');
    }
  }
}
