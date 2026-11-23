import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionRecetas } from '../../componentes/navegacion-recetas/navegacion-recetas';
import type { CodigoTalla } from '../../../productos/modelos/producto-maestro';
import type { DatosReceta, LineaReceta, Receta } from '../../modelos/receta';
import { RecetasServicio } from '../../servicios/recetas-servicio';
import {
  cantidadBruta,
  convertirABase,
  convertirDeBase,
  redondear,
} from '../../servicios/calculos-receta';

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

@Component({
  selector: 'app-editor-receta',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, ModalConfirmacion, NavegacionRecetas],
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
  protected readonly receta = this.esNueva ? this.recetaVacia() : this.servicio.recetaDe(this.id);
  protected readonly existe = this.receta !== undefined;
  protected readonly soloLectura = this.receta?.estado !== 'BORRADOR';

  protected readonly materiales = this.servicio.materiales;
  protected readonly unidades: LineaReceta['unidadCaptura'][] = ['cm2', 'cm', 'm2', 'm', 'g', 'pieza'];
  protected readonly disenos = this.servicio.disenos;
  protected readonly materialNuevo = signal('HIL-COS');
  protected readonly intento = signal(false);
  protected readonly archivando = signal(false);
  protected readonly copiarProducto = signal(this.receta?.productoId ?? 1);
  protected readonly copiarTalla = signal<CodigoTalla>(this.receta?.talla ?? 'CH');

  protected readonly forma = this.fb.nonNullable.group({
    productoId: [this.receta?.productoId ?? 1, Validators.required],
    talla: [this.receta?.talla ?? 'CH' as CodigoTalla, Validators.required],
    nota: [this.receta?.nota ?? ''],
    manoObra: [this.receta?.manoObra ?? 0, [Validators.min(0)]],
    costoBordado: [this.receta?.costoBordado ?? 0, [Validators.min(0)]],
    costosIndirectos: [this.receta?.costosIndirectos ?? 0, [Validators.min(0)]],
    lineas: this.fb.nonNullable.array(
      (this.receta?.lineas ?? []).map((linea) => this.lineaForm(linea)),
    ),
    bordados: this.fb.nonNullable.array(
      (this.receta?.bordados ?? []).map((bordado) =>
        this.fb.nonNullable.group({
          disenoId: [bordado.disenoId, Validators.required],
          aplicaciones: [bordado.aplicaciones, [Validators.required, Validators.min(1)]],
          ubicacion: [bordado.ubicacion],
        }),
      ),
    ),
  });

  private readonly valores = signal(this.forma.getRawValue());

  protected readonly lineasVista = computed<LineaVista[]>(() =>
    this.valores().lineas.map((linea) => {
      const material = this.servicio.materialDe(linea.materialCodigo);
      const neta = convertirABase(Number(linea.cantidadCapturada), linea.unidadCaptura);
      const bruta = cantidadBruta(neta, Number(linea.factorConsumo), Number(linea.mermaPct));
      return {
        materialCodigo: linea.materialCodigo,
        nombre: material?.nombre ?? linea.materialCodigo,
        categoria: material?.categoria ?? '—',
        unidadBase: material?.unidadBase ?? '—',
        cantidadCapturada: Number(linea.cantidadCapturada),
        unidadCaptura: linea.unidadCaptura,
        cantidadNeta: neta,
        bruta,
        mermaPct: Number(linea.mermaPct),
        costo: redondear(bruta * (material?.costoBase ?? 0)),
        esEtiqueta: linea.esEtiqueta,
      };
    }),
  );

  /** Receta temporal con los valores del formulario para alimentar los cálculos. */
  private readonly recetaVista = computed<Receta>(() => {
    const base = this.receta;
    if (!base) {
      throw new Error('Receta no disponible');
    }
    const raw = this.valores();
    return {
      ...base,
      productoId: Number(raw.productoId),
      talla: raw.talla,
      manoObra: Number(raw.manoObra),
      costoBordado: Number(raw.costoBordado),
      costosIndirectos: Number(raw.costosIndirectos),
      lineas: this.lineasVista().map((vista, indice) => ({
        id: base.lineas[indice]?.id ?? indice + 1,
        materialCodigo: vista.materialCodigo,
        cantidadNeta: vista.cantidadNeta,
        unidadCaptura: vista.unidadCaptura,
        factorConsumo: Number(raw.lineas[indice]?.factorConsumo ?? 1),
        mermaPct: vista.mermaPct,
        cantidadBruta: vista.bruta,
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

  protected readonly costeo = computed(() => this.servicio.costeo(this.recetaVista()));
  protected readonly alcanza = computed(() => this.servicio.alcanzaPara(this.recetaVista()));
  protected readonly precioVigente = computed(() => this.servicio.precioVigente(Number(this.valores().productoId)));
  protected readonly margen = computed(() =>
    this.calcularMargen(this.precioVigente(), this.costeo().costoEstandar),
  );
  protected readonly razones = computed(() => this.servicio.validarActivacion(this.recetaVista()));
  protected readonly pendientes = computed(() => this.servicio.disenosPendientes(this.recetaVista()));
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
    if (this.soloLectura) {
      this.forma.disable({ emitEvent: false });
    } else if (!this.esNueva) {
      // En una versión existente, producto y talla se cambian copiando la receta.
      this.forma.controls.productoId.disable({ emitEvent: false });
      this.forma.controls.talla.disable({ emitEvent: false });
    }
  }

  /** Receta temporal para el alta: el identificador se asigna al guardar el borrador. */
  private recetaVacia(): Receta {
    const productoId = Number(this.ruta.snapshot.queryParamMap.get('producto') ?? 1);
    const tallaQuery = this.ruta.snapshot.queryParamMap.get('talla') as CodigoTalla | null;
    const tallas = this.servicio.tallasDeProducto(productoId);
    const talla = tallaQuery && tallas.includes(tallaQuery) ? tallaQuery : (tallas[0] ?? 'CH');
    const version =
      this.servicio
        .recetasDeProducto(productoId, talla)
        .reduce((maximo, item) => Math.max(maximo, item.version), 0) + 1;
    return {
      id: 0,
      productoId,
      talla,
      version,
      estado: 'BORRADOR',
      origenRecetaId: null,
      manoObra: 0,
      costoBordado: 0,
      costosIndirectos: 0,
      nota: '',
      creadaPor: 'Administrador',
      creadaEn: new Date().toISOString(),
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

  private calcularMargen(precio: number, costo: number): number | null {
    const base = precio / 1.16;
    return base <= 0 ? null : redondear(((base - costo) / base) * 100, 1);
  }

  private lineaForm(linea: LineaReceta) {
    return this.fb.nonNullable.group({
      materialCodigo: [linea.materialCodigo, Validators.required],
      cantidadCapturada: [convertirDeBase(linea.cantidadNeta, linea.unidadCaptura), [Validators.min(0)]],
      unidadCaptura: [linea.unidadCaptura, Validators.required],
      factorConsumo: [linea.factorConsumo, [Validators.min(0.001)]],
      mermaPct: [linea.mermaPct, [Validators.min(0), Validators.max(99.99)]],
      esEtiqueta: [linea.esEtiqueta],
      nota: [linea.nota],
    });
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
      this.fb.nonNullable.group({
        materialCodigo: [material.codigo, Validators.required],
        cantidadCapturada: [1, [Validators.min(0)]],
        unidadCaptura: [unidad, Validators.required],
        factorConsumo: [1, [Validators.min(0.001)]],
        mermaPct: [material.mermaPct, [Validators.min(0), Validators.max(99.99)]],
        esEtiqueta: [false],
        nota: [''],
      }),
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
        this.fb.nonNullable.group({
          materialCodigo: [codigo, Validators.required],
          cantidadCapturada: [1, [Validators.min(0)]],
          unidadCaptura: ['pieza' as const, Validators.required],
          factorConsumo: [1, [Validators.min(0.001)]],
          mermaPct: [0, [Validators.min(0), Validators.max(99.99)]],
          esEtiqueta: [true],
          nota: ['Etiqueta precargada según §11.4'],
        }),
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
    grupo.controls.unidadCaptura.setValue(material.unidadBase === 'pieza' ? 'pieza' : material.unidadBase);
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

  protected guardar(): number | null {
    this.intento.set(true);
    if (this.forma.invalid) {
      this.forma.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa las cantidades, factores y mermas marcadas.');
      return null;
    }
    const raw = this.forma.getRawValue();
    const datos: DatosReceta = {
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
    const resultado = this.servicio.guardarBorrador(datos, this.esNueva ? undefined : this.id);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    if (resultado.ok && this.esNueva && resultado.recetaId !== undefined) {
      void this.router.navigate(['/admin/recetas/editar', resultado.recetaId]);
    }
    return resultado.ok ? (resultado.recetaId ?? null) : null;
  }

  protected activar(): void {
    const razones = this.servicio.validarActivacion(this.recetaVista());
    if (razones.length > 0) {
      this.avisos.mostrar('advertencia', `No se puede activar: ${razones.join(' ')}`);
      return;
    }
    const guardado = this.guardar();
    if (guardado === null) {
      return;
    }
    const resultado = this.servicio.activarReceta(guardado);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'advertencia', resultado.mensaje);
    if (resultado.ok) {
      void this.router.navigate(['/admin/recetas']);
    }
  }

  protected copiar(): void {
    const resultado = this.servicio.copiarReceta(
      this.id,
      Number(this.copiarProducto()),
      this.copiarTalla(),
    );
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    if (resultado.ok && resultado.recetaId !== undefined) {
      void this.router.navigate(['/admin/recetas/editar', resultado.recetaId]);
    }
  }

  protected pedirArchivado(): void {
    this.archivando.set(true);
  }

  protected confirmarArchivado(): void {
    const resultado = this.servicio.archivarReceta(this.id);
    this.avisos.mostrar(resultado.ok ? 'advertencia' : 'error', resultado.mensaje);
    this.archivando.set(false);
    if (resultado.ok) {
      void this.router.navigate(['/admin/recetas']);
    }
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
        this.fb.nonNullable.group({
          materialCodigo: [codigo, Validators.required],
          cantidadCapturada: [1, [Validators.min(0)]],
          unidadCaptura: ['pieza' as const, Validators.required],
          factorConsumo: [1, [Validators.min(0.001)]],
          mermaPct: [0, [Validators.min(0), Validators.max(99.99)]],
          esEtiqueta: [true],
          nota: ['Etiqueta precargada según §11.4'],
        }),
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
