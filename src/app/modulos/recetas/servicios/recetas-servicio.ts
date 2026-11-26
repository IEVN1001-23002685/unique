import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  concatMap,
  forkJoin,
  from,
  map,
  of,
  switchMap,
  tap,
  throwError,
  toArray,
} from 'rxjs';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { ApiService, type ValorParametro } from '../../../core/api/api.service';
import { codigoError, mensajeError } from '../../../core/api/errores';
import { PerfilDemoServicio } from '../../../nucleo/servicios/perfil-demo-servicio';
import { ProductosServicio } from '../../productos/servicios/productos-servicio';
import type { CodigoTalla } from '../../productos/modelos/producto-maestro';
import type {
  CategoriaMaterial,
  CosteoReceta,
  DatosDiseno,
  DatosReceta,
  DisenoBordado,
  FilaHistorial,
  LineaReceta,
  MaterialCatalogo,
  Receta,
  ResultadoM11,
  UnidadCaptura,
} from '../modelos/receta';
import { MARGEN_OBJETIVO_PCT } from './calculos-receta';

const POR_PAGINA = 100;

interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

interface DetalleResuelto {
  item: RecetaApi;
  receta?: RecetaApi;
  error?: unknown;
}

interface CatalogoApi {
  id: number;
  codigo: string;
  nombre: string;
}

interface MaterialApi {
  id: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad_base: string;
  unidad_compra: string;
  factor_compra_base: string;
  costo_estandar_base: string;
  merma_estandar_pct: string;
  por_color: boolean;
  activo: boolean;
}

interface LineaApi {
  id: number;
  material_id: number;
  material_codigo: string;
  material_nombre: string;
  unidad_base: string;
  cantidad_neta: string;
  factor_consumo: string;
  merma_pct: string;
  cantidad_bruta: string;
  costo_unitario_base?: string;
  costo_linea?: string;
  nota?: string | null;
}

interface BordadoApi {
  id: number;
  diseno_id: number;
  diseno_codigo: string;
  diseno_nombre: string;
  estado_diseno: string;
  aplicaciones: number;
  ubicacion?: string | null;
}

interface RecetaApi {
  id: number;
  producto_id: number;
  producto: string;
  categoria: string;
  talla_id: number;
  talla: string;
  version: number;
  estado: string;
  creada_por: number | null;
  activada_en: string | null;
  actualizado_en: string;
  nota?: string | null;
  precio_venta?: string | null;
  mano_obra?: string;
  costo_bordado?: string;
  costos_indirectos?: string;
  costo_materia_prima?: string;
  costo_hilo_bordado?: string;
  costo_empaque?: string;
  costo_estandar?: string;
  precio_sugerido?: string;
  margen_real?: string | null;
  lineas?: LineaApi[];
  bordados?: BordadoApi[];
}

interface CosteoFilaApi {
  producto_id: number;
  producto: string;
  talla_id: number;
  talla: string;
  receta_id: number;
  mano_obra: string;
  costo_bordado: string;
  costos_indirectos: string;
  costo_materia_prima: string;
  costo_hilo_bordado: string;
  costo_empaque: string;
  costo_estandar: string;
  precio_sugerido: string;
  precio_venta: string;
  margen_real: string;
}

interface DisenoApi {
  id: number;
  codigo: string;
  nombre: string;
  ancho_cm: string;
  alto_cm: string;
  estado: string;
  notas?: string | null;
  activo: boolean;
  hilos: Array<{
    material_id: number;
    material_codigo: string;
    material_nombre: string;
    metros_por_aplicacion: string;
  }>;
}

interface LineaPreviewApi {
  material_id: number;
  material_codigo: string;
  cantidad_neta: string;
  factor_consumo: string;
  merma_pct: string;
  cantidad_bruta: string;
  costo_linea: string;
}

interface PreviewApi {
  producto_id: number;
  talla_id: number;
  capacidad: number;
  mano_obra: string;
  costo_bordado: string;
  costos_indirectos: string;
  costo_materia_prima: string;
  costo_hilo_bordado: string;
  costo_empaque: string;
  costo_estandar: string;
  precio_sugerido: string;
  margen_real: string | null;
  lineas: LineaPreviewApi[];
}

export interface PreviewReceta {
  costo: CosteoReceta;
  capacidad: number;
  margen: number | null;
  lineas: LineaPreviewApi[];
}

export interface FilaCosteo {
  productoId: number;
  producto: string;
  talla: string;
  recetaId: number;
  manoObra: number;
  bordado: number;
  indirectos: number;
  materiaPrima: number;
  hiloBordado: number;
  empaque: number;
  costoEstandar: number;
  precioSugerido: number;
  precioVigente: number;
  margen: number;
}

function numero(valor: string | number | null | undefined): number {
  const resultado = Number(valor ?? 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

function texto(valor: string | null | undefined): string {
  return valor ?? '';
}

/**
 * M11 lee y escribe recetas, costeo y diseños únicamente mediante Flask.
 * La etiqueta de los diseños nuevos se propone aquí porque `/disenos` exige
 * `codigo`; Flask valida unicidad y es la fuente autoritativa del valor final.
 * No existe un endpoint de archivado manual ni de sustitución completa de
 * líneas: esas dos operaciones se documentan como pendientes del contrato.
 */
@Injectable({ providedIn: 'root' })
export class RecetasServicio {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStateService);
  private readonly perfilDemo = inject(PerfilDemoServicio);
  private readonly maestro = inject(ProductosServicio);

  private readonly lista = signal<Receta[]>([]);
  private readonly disenosLista = signal<DisenoBordado[]>([]);
  private readonly materialesLista = signal<MaterialCatalogo[]>([]);
  private readonly tallasApi = signal<CatalogoApi[]>([]);
  private readonly costeoLista = signal<FilaCosteo[]>([]);

  readonly recetas = this.lista.asReadonly();
  readonly disenos = this.disenosLista.asReadonly();
  readonly materiales = computed(() => this.materialesLista());
  readonly costeoFilas = this.costeoLista.asReadonly();

  /** Fallos de API visibles en la interfaz; nunca se confunden con catálogos vacíos. */
  private readonly errorCargaInterno = signal('');
  private readonly errorDetalleInterno = signal('');
  readonly errorCarga = this.errorCargaInterno.asReadonly();
  readonly errorDetalle = this.errorDetalleInterno.asReadonly();

  /**
   * Sin autenticación real, el perfil de demostración permite explorar el panel.
   * Con sesión, manda el rol del token: Operativo nunca ve costos (§3).
   */
  readonly puedeVerCostos = computed(() =>
    this.auth.autenticado()
      ? this.auth.puede(['ADMIN'])
      : this.perfilDemo.puedeVerCostos(),
  );

  readonly productos = computed(() => {
    const productos = this.maestro.productos();
    if (productos.length > 0) {
      return productos.map((producto) => ({ id: producto.id, nombre: producto.nombre }));
    }
    const vistos = new Map<number, { id: number; nombre: string }>();
    for (const receta of this.lista()) {
      if (receta.producto) {
        vistos.set(receta.productoId, { id: receta.productoId, nombre: receta.producto });
      }
    }
    return [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-MX'));
  });

  readonly totales = computed(() => {
    const recetas = this.lista();
    return {
      total: recetas.length,
      vigentes: recetas.filter((receta) => receta.estado === 'VIGENTE').length,
      borradores: recetas.filter((receta) => receta.estado === 'BORRADOR').length,
      archivadas: recetas.filter((receta) => receta.estado === 'ARCHIVADA').length,
      disenos: this.disenosLista().length,
    };
  });

  recargar(): Observable<void> {
    const admin = this.puedeVerCostos();
    this.errorCargaInterno.set('');
    this.errorDetalleInterno.set('');
    return forkJoin({
      recetas: this.listarPagina<RecetaApi>('/recetas'),
      materiales: this.listarPagina<MaterialApi>('/materiales'),
      disenos: admin ? this.listarPagina<DisenoApi>('/disenos') : of([] as DisenoApi[]),
      tallas: admin ? this.listarPagina<CatalogoApi>('/catalogos/talla') : of([] as CatalogoApi[]),
      costeo: admin ? this.listarCosteo() : of([] as CosteoFilaApi[]),
      productos: admin ? this.maestro.recargar() : of(undefined),
    }).pipe(
      switchMap(({ recetas, materiales, disenos, tallas, costeo }) => {
        this.materialesLista.set(materiales.filter((item) => item.activo).map(deMaterialApi));
        this.disenosLista.set(disenos.map(deDisenoApi));
        this.tallasApi.set(tallas);
        this.costeoLista.set(costeo.map(deCosteoApi));

        if (recetas.length === 0) {
          this.lista.set([]);
          return of(undefined);
        }
        return forkJoin(
          recetas.map((item) =>
            this.api
              .get<RecetaApi>(`/recetas/${item.id}`)
              .pipe(
                map((receta): DetalleResuelto => ({ item, receta })),
                catchError((error: unknown) => of<DetalleResuelto>({ item, error })),
              ),
          ),
        ).pipe(
          tap((respuestas) => {
            const fallos = respuestas.filter((respuesta) => respuesta.error !== undefined);
            this.lista.set(
              respuestas
                .filter((respuesta) => respuesta.receta !== undefined)
                .map((respuesta) => deRecetaApi(respuesta.receta as RecetaApi)),
            );
            if (fallos.length > 0) {
              this.errorDetalleInterno.set(
                `No fue posible cargar ${fallos.length} receta(s). ${mensajeError(
                  fallos[0].error,
                  'Revisa la conexión con Flask.',
                )}`,
              );
            }
          }),
          map(() => undefined),
        );
      }),
      catchError((error: unknown) => {
        this.errorCargaInterno.set(
          mensajeError(error, 'No fue posible cargar recetas, materiales o catálogos desde Flask.'),
        );
        this.lista.set([]);
        this.materialesLista.set([]);
        this.disenosLista.set([]);
        this.tallasApi.set([]);
        this.costeoLista.set([]);
        return of(undefined);
      }),
    );
  }

  materialDe(codigo: string): MaterialCatalogo | undefined {
    return this.materialesLista().find((material) => material.codigo === codigo);
  }

  nombreMaterial(codigo: string): string {
    return this.materialDe(codigo)?.nombre ?? codigo;
  }

  etiquetasHilo(): MaterialCatalogo[] {
    return this.materialesLista().filter((material) => material.codigo.startsWith('HIL-BOR-'));
  }

  productoDe(id: number): { id: number; nombre: string } | undefined {
    return this.productos().find((producto) => producto.id === id);
  }

  nombreProducto(id: number): string {
    return this.productoDe(id)?.nombre ?? 'Producto sin identificar';
  }

  precioVigente(id: number): number {
    const producto = this.maestro.productos().find((item) => item.id === id);
    if (producto) {
      return producto.precioVenta;
    }
    const receta = this.lista().find((item) => item.productoId === id && item.precioVenta !== undefined);
    return receta?.precioVenta ?? 0;
  }

  recetaDe(id: number): Receta | undefined {
    return this.lista().find((receta) => receta.id === id);
  }

  disenoDe(id: number): DisenoBordado | undefined {
    return this.disenosLista().find((diseno) => diseno.id === id);
  }

  nombreDiseno(id: number): string {
    const diseno = this.disenoDe(id);
    return diseno ? `${diseno.codigo} · ${diseno.nombre}` : 'Diseño sin identificar';
  }

  tallasDeProducto(id: number): CodigoTalla[] {
    const producto = this.maestro.productos().find((item) => item.id === id);
    if (producto?.tallas.length) {
      return producto.tallas;
    }
    return Array.from(
      new Set(
        this.lista()
          .filter((receta) => receta.productoId === id)
          .map((receta) => receta.talla),
      ),
    );
  }

  recetasDeProducto(productoId: number, talla?: CodigoTalla): Receta[] {
    return this.lista()
      .filter(
        (receta) =>
          receta.productoId === productoId && (talla === undefined || receta.talla === talla),
      )
      .sort((a, b) => b.version - a.version);
  }

  vigenteDe(productoId: number, talla: CodigoTalla): Receta | undefined {
    return this.lista().find(
      (receta) =>
        receta.productoId === productoId && receta.talla === talla && receta.estado === 'VIGENTE',
    );
  }

  tallasVigentesDe(productoId: number): CodigoTalla[] {
    return this.lista()
      .filter((receta) => receta.productoId === productoId && receta.estado === 'VIGENTE')
      .map((receta) => receta.talla);
  }

  /** Proyección de los importes devueltos por Flask; no los recalcula en el cliente. */
  costeo(receta: Receta): CosteoReceta {
    return {
      materiaPrima: receta.materiaPrima ?? 0,
      hiloBordado: receta.hiloBordado ?? 0,
      empaque: receta.costoEmpaque ?? 0,
      manoObra: receta.manoObra,
      bordado: receta.costoBordado,
      indirectos: receta.costosIndirectos,
      costoEstandar: receta.costoEstandar ?? 0,
      precioSugerido: receta.precioSugerido ?? 0,
      margenObjetivo: MARGEN_OBJETIVO_PCT,
    };
  }

  /** Flask devolve el margen como fracción; la UI lo muestra como porcentaje. */
  margenDe(_precio: number, receta: Receta): number | null {
    return receta.margenReal === undefined ? null : Math.round(receta.margenReal * 1000) / 10;
  }

  /**
   * La capacidad se calcula en `/recetas/previsualizar` para el borrador que se edita;
   * el editor consume esa respuesta directamente. No se guarda una capacidad con un
   * identificador inventado: Flask aún no expone capacidad por receta persistida.
   */
  alcanzaPara(_receta: Receta): number | null {
    return null;
  }

  costoEstandarDe(productoId: number): number | null {
    const filas = this.costeoLista().filter((fila) => fila.productoId === productoId);
    return filas.length === 0 ? null : Math.max(...filas.map((fila) => fila.costoEstandar));
  }

  previsualizar(datos: DatosReceta): Observable<PreviewReceta> {
    const body = {
      producto_id: datos.productoId,
      talla_id: this.tallaId(datos.talla),
      mano_obra: datos.manoObra.toFixed(2),
      costo_bordado: datos.costoBordado.toFixed(2),
      costos_indirectos: datos.costosIndirectos.toFixed(2),
      precio_venta: this.precioVigente(datos.productoId).toFixed(2),
      lineas: this.lineasParaApi(datos),
    };
    if (body.talla_id === 0) {
      return of({
        costo: this.costeoVacio(),
        capacidad: 0,
        margen: null,
        lineas: [],
      });
    }
    return this.api.post<PreviewApi>('/recetas/previsualizar', body).pipe(
      map((respuesta) => ({
        costo: this.costeoDePreview(respuesta),
        capacidad: respuesta.capacidad,
        margen:
          respuesta.margen_real === null
            ? null
            : Math.round(numero(respuesta.margen_real) * 1000) / 10,
        lineas: respuesta.lineas,
      })),
    );
  }

  guardarBorrador(datos: DatosReceta, id?: number): Observable<ResultadoM11> {
    const lineas = this.lineasParaApi(datos);
    if (lineas.some((linea) => Number(linea['material_id']) === 0)) {
      return of({ ok: false, mensaje: 'Hay líneas con materiales que no están en el catálogo.' });
    }
    if (datos.bordados.some((bordado) => !this.disenoDe(bordado.disenoId))) {
      return of({ ok: false, mensaje: 'Hay bordados con diseños que no están disponibles.' });
    }

    const economicos = {
      mano_obra: datos.manoObra.toFixed(2),
      costo_bordado: datos.costoBordado.toFixed(2),
      costos_indirectos: datos.costosIndirectos.toFixed(2),
      nota: datos.nota.trim(),
    };
    const peticion =
      id === undefined
        ? this.api.post<RecetaApi>('/recetas', {
            producto_id: datos.productoId,
            talla_id: this.tallaId(datos.talla),
            ...economicos,
          })
        : this.api.patch<RecetaApi>(`/recetas/${id}`, economicos);

    return peticion.pipe(
      switchMap((respuesta) =>
        this.sincronizarLineas(respuesta.id, datos).pipe(
          switchMap(() =>
            this.recargar().pipe(
              map(() => ({
                ok: true,
                recetaId: respuesta.id,
                mensaje:
                  `Borrador v${respuesta.version} guardado por Flask con ${lineas.length} línea(s) y ${datos.bordados.length} bordado(s). ` +
                  'La sustitución completa de líneas eliminadas queda pendiente en el contrato.',
              })),
            ),
          ),
        ),
      ),
      catchError((error) =>
        this.recargar().pipe(
          map(() => ({
            ok: false,
            mensaje: mensajeError(error, 'No fue posible guardar la receta.'),
          })),
        ),
      ),
    );
  }

  copiarReceta(id: number, productoId?: number, talla?: CodigoTalla): Observable<ResultadoM11> {
    const cuerpo: Record<string, number> = {};
    if (productoId !== undefined) {
      cuerpo['producto_id'] = productoId;
    }
    if (talla !== undefined && this.tallaId(talla) > 0) {
      cuerpo['talla_id'] = this.tallaId(talla);
    }
    return this.api.post<RecetaApi>(`/recetas/${id}/copiar`, cuerpo).pipe(
      switchMap((respuesta) =>
        this.recargar().pipe(
          map(() => ({
            ok: true,
            recetaId: respuesta.id,
            mensaje: `Copia creada como borrador v${respuesta.version}. Puedes ajustarla antes de activarla.`,
          })),
        ),
      ),
      catchError((error) =>
        of({ ok: false, mensaje: mensajeError(error, 'No fue posible copiar la receta.') }),
      ),
    );
  }

  activarReceta(id: number): Observable<ResultadoM11> {
    return this.api.post<RecetaApi>(`/recetas/${id}/activar`, {}).pipe(
      switchMap((respuesta) =>
        this.recargar().pipe(
          map(() => ({
            ok: true,
            recetaId: respuesta.id,
            mensaje: `Versión v${respuesta.version} activada por Flask; la anterior pasó a ARCHIVADA.`,
          })),
        ),
      ),
      catchError((error) => this.resultadoError(error, 'No fue posible activar la receta.')),
    );
  }

  archivarReceta(_id: number): Observable<ResultadoM11> {
    return of({
      ok: false,
      pendiente: true,
      mensaje:
        'Archivado manual pendiente de contrato: Flask archiva la versión anterior al activar otra. No se ejecutó ninguna baja.',
    });
  }

  guardarDiseno(datos: DatosDiseno, id?: number): Observable<ResultadoM11> {
    const hilos = datos.hilos
      .filter((hilo) => hilo.metrosPorAplicacion > 0)
      .map((hilo) => ({
        material_id: this.materialDe(hilo.materialCodigo)?.id ?? 0,
        metros_por_aplicacion: hilo.metrosPorAplicacion.toFixed(3),
      }));
    if (hilos.some((hilo) => hilo.material_id === 0)) {
      return of({ ok: false, mensaje: 'Selecciona hilos de bordado del catálogo de materiales.' });
    }

    const comun = {
      nombre: datos.nombre.trim(),
      ancho_cm: datos.anchoCm.toFixed(2),
      alto_cm: datos.altoCm.toFixed(2),
      notas: datos.notas.trim(),
      activo: datos.activo,
      hilos,
    };
    const actual = id === undefined ? undefined : this.disenoDe(id);
    const peticion =
      actual === undefined
        ? this.crearDiseno({ codigo: this.siguienteCodigoDiseno(), ...comun })
        : this.api.patch<DisenoApi>(`/disenos/${actual.id}`, { codigo: actual.codigo, ...comun });

    return peticion.pipe(
      switchMap((respuesta) =>
        this.recargar().pipe(
          map(() => ({
            ok: true,
            disenoId: respuesta.id,
            mensaje:
              actual === undefined
                ? `Diseño ${respuesta.codigo} creado en estado ${respuesta.estado}. Consumo: ${respuesta.hilos.reduce((suma, hilo) => suma + numero(hilo.metros_por_aplicacion), 0)} m por aplicación.`
                : `Diseño ${respuesta.codigo} actualizado por Flask; estado ${respuesta.estado}.`,
          })),
        ),
      ),
      catchError((error) => this.resultadoError(error, 'No fue posible guardar el diseño.')),
    );
  }

  /**
   * Digitalizar exige guardar primero los metros capturados por hilo (§7.4, paso 2).
   * Sin hilos con metros mayores que cero el diseño seguiría consumiendo 0 m.
   */
  digitalizarDiseno(id: number, datos: DatosDiseno): Observable<ResultadoM11> {
    if (!datos.hilos.some((hilo) => hilo.metrosPorAplicacion > 0)) {
      return of({
        ok: false,
        mensaje: 'Captura los metros por aplicación de al menos un hilo antes de digitalizar.',
      });
    }
    return this.guardarDiseno(datos, id).pipe(
      switchMap((guardado) => {
        if (!guardado.ok) {
          return of(guardado);
        }
        return this.api.patch<DisenoApi>(`/disenos/${id}`, { estado: 'DIGITALIZADO' }).pipe(
          switchMap((respuesta) =>
            this.recargar().pipe(
              map(() => ({
                ok: true,
                disenoId: respuesta.id,
                mensaje: `${respuesta.codigo} guardado y marcado como DIGITALIZADO por Flask. Las recetas que lo usan suman el hilo a su costo.`,
              })),
            ),
          ),
          catchError((error) => this.resultadoError(error, 'No fue posible digitalizar el diseño.')),
        );
      }),
    );
  }

  eliminarDiseno(id: number): Observable<ResultadoM11> {
    const diseno = this.disenoDe(id);
    return this.api.delete<void>(`/disenos/${id}`).pipe(
      switchMap(() =>
        this.recargar().pipe(
          map(() => ({
            ok: true,
            mensaje: `${diseno?.codigo ?? 'Diseño'} eliminado por Flask. Consulta la biblioteca para verificar el resultado; las versiones de receta no se alteran.`,
          })),
        ),
      ),
      catchError((error) => this.resultadoError(error, 'No fue posible dar de baja el diseño.')),
    );
  }

  comparar(idA: number, idB: number): FilaHistorial[] {
    const a = this.recetaDe(idA);
    const b = this.recetaDe(idB);
    if (!a || !b) {
      return [];
    }

    const filas: FilaHistorial[] = [];
    const claves = new Set([
      ...a.lineas.map((linea) => linea.materialCodigo),
      ...b.lineas.map((linea) => linea.materialCodigo),
    ]);
    for (const clave of claves) {
      const lineaA = a.lineas.find((linea) => linea.materialCodigo === clave);
      const lineaB = b.lineas.find((linea) => linea.materialCodigo === clave);
      const detalle = (linea: LineaReceta | undefined): string =>
        linea
          ? `${linea.cantidadNeta} ${linea.unidadCaptura} · factor ${linea.factorConsumo} · merma ${linea.mermaPct} % · bruta ${linea.cantidadBruta}`
          : '—';
      filas.push({
        id: filas.length + 1,
        clave,
        descripcion: this.nombreMaterial(clave),
        detalleA: detalle(lineaA),
        detalleB: detalle(lineaB),
        estado: !lineaA
          ? 'NUEVA'
          : !lineaB
            ? 'ELIMINADA'
            : detalle(lineaA) === detalle(lineaB)
              ? 'IGUAL'
              : 'CAMBIO',
      });
    }

    filas.push(
      {
        id: filas.length + 1,
        clave: 'COSTOS',
        descripcion: 'Mano de obra / bordado / indirectos',
        detalleA: `${a.manoObra} / ${a.costoBordado} / ${a.costosIndirectos}`,
        detalleB: `${b.manoObra} / ${b.costoBordado} / ${b.costosIndirectos}`,
        estado:
          a.manoObra === b.manoObra &&
          a.costoBordado === b.costoBordado &&
          a.costosIndirectos === b.costosIndirectos
            ? 'IGUAL'
            : 'CAMBIO',
      },
      {
        id: filas.length + 1,
        clave: 'BORDADOS',
        descripcion: 'Diseños de bordado enlazados',
        detalleA:
          a.bordados
            .map((bordado) => `${this.nombreDiseno(bordado.disenoId)} ×${bordado.aplicaciones}`)
            .join('; ') || '—',
        detalleB:
          b.bordados
            .map((bordado) => `${this.nombreDiseno(bordado.disenoId)} ×${bordado.aplicaciones}`)
            .join('; ') || '—',
        estado:
          a.bordados.length === b.bordados.length &&
          a.bordados.every(
            (bordado, indice) =>
              bordado.disenoId === b.bordados[indice]?.disenoId &&
              bordado.aplicaciones === b.bordados[indice]?.aplicaciones,
          )
            ? 'IGUAL'
            : 'CAMBIO',
      },
    );
    return filas;
  }

  validarActivacion(receta: Receta): string[] {
    const razones: string[] = [];
    const codigos = receta.lineas.map((linea) => linea.materialCodigo);
    const esTejido = receta.lineas.some((linea) => {
      const material = this.materialDe(linea.materialCodigo);
      return material?.categoria === 'Tela' || linea.materialCodigo === 'HIL-EST';
    });

    if (!esTejido) {
      razones.push('Falta una línea de tela o de hilo de tejido.');
    }
    if (!codigos.includes('HIL-COS')) {
      razones.push('Falta una línea de hilo de costura (HIL-COS).');
    }

    const faltantes = this.etiquetasEsperadas(receta.productoId, receta.talla).filter(
      (codigo) => !codigos.includes(codigo),
    );
    if (faltantes.length > 0) {
      razones.push(`Faltan etiquetas: ${faltantes.join(', ')}.`);
    }

    if (receta.lineas.some((linea) => !Number.isFinite(linea.mermaPct) || linea.mermaPct >= 100)) {
      razones.push('La merma debe ser entre 0 % y menos de 100 % en todas las líneas.');
    }
    if (receta.estado === 'ARCHIVADA') {
      razones.push('Una versión archivada no puede activarse; cópiala a un borrador nuevo.');
    }
    return razones;
  }

  etiquetasEsperadas(productoId: number, talla: CodigoTalla): string[] {
    const prefijo = this.maestro.categoriaDe(productoId)?.prefijo ?? 'SD';
    return [
      'ETQ-MAR',
      ...(talla === 'UN' ? [] : [`ETQ-TAL-${talla}`]),
      `ETQ-COM-${prefijo}`,
    ];
  }

  disenosPendientes(receta: Receta): string[] {
    return receta.bordados
      .map((bordado) => this.disenoDe(bordado.disenoId))
      .filter(
        (diseno): diseno is DisenoBordado => diseno !== undefined && diseno.estado === 'PENDIENTE',
      )
      .map((diseno) => diseno.codigo);
  }

  private lineasParaApi(datos: DatosReceta): Array<Record<string, string | number>> {
    const materiales = datos.lineas
      .filter((linea) => linea.cantidadNeta > 0)
      .map((linea) => ({
        material_id: this.materialDe(linea.materialCodigo)?.id ?? 0,
        cantidad_neta: linea.cantidadNeta.toFixed(4),
        factor_consumo: linea.factorConsumo.toFixed(3),
        merma_pct: linea.mermaPct.toFixed(2),
        nota: linea.nota.trim().slice(0, 300),
      }));
    const bordados = datos.bordados.map((bordado) => ({
      diseno_id: bordado.disenoId,
      aplicaciones: Math.max(1, Math.trunc(bordado.aplicaciones)),
      ubicacion: bordado.ubicacion.trim().slice(0, 60),
    }));
    return [...materiales, ...bordados];
  }

  private sincronizarLineas(recetaId: number, datos: DatosReceta): Observable<void> {
    const cargas = this.lineasParaApi(datos).map((cuerpo) =>
      this.api.post<RecetaApi>(`/recetas/${recetaId}/lineas`, cuerpo),
    );
    return from(cargas).pipe(
      concatMap((carga) => carga),
      toArray(),
      map(() => undefined),
    );
  }

  private tallaId(codigo: CodigoTalla): number {
    return (
      this.tallasApi().find((talla) => talla.codigo === codigo)?.id ??
      this.lista().find((receta) => receta.talla === codigo)?.tallaId ??
      0
    );
  }

  private crearDiseno(cuerpo: Record<string, unknown>, intento = 0): Observable<DisenoApi> {
    return this.api.post<DisenoApi>('/disenos', cuerpo).pipe(
      catchError((error) => {
        if (codigoError(error) !== 'DISENO_DUPLICADO' || intento >= 20) {
          return throwError(() => error);
        }
        const codigo = this.siguienteCodigoDiseno(String(cuerpo['codigo']));
        return this.crearDiseno({ ...cuerpo, codigo }, intento + 1);
      }),
    );
  }

  private siguienteCodigoDiseno(excluir?: string): string {
    const usados = new Set(this.disenosLista().map((diseno) => diseno.codigo));
    if (excluir) {
      usados.add(excluir);
    }
    let consecutivo = 1;
    while (usados.has(`DIS-${String(consecutivo).padStart(3, '0')}`)) {
      consecutivo += 1;
    }
    return `DIS-${String(consecutivo).padStart(3, '0')}`;
  }

  private costeoDePreview(respuesta: PreviewApi): CosteoReceta {
    return {
      materiaPrima: numero(respuesta.costo_materia_prima),
      hiloBordado: numero(respuesta.costo_hilo_bordado),
      empaque: numero(respuesta.costo_empaque),
      manoObra: numero(respuesta.mano_obra),
      bordado: numero(respuesta.costo_bordado),
      indirectos: numero(respuesta.costos_indirectos),
      costoEstandar: numero(respuesta.costo_estandar),
      precioSugerido: numero(respuesta.precio_sugerido),
      margenObjetivo: MARGEN_OBJETIVO_PCT,
    };
  }

  private costeoVacio(): CosteoReceta {
    return {
      materiaPrima: 0,
      hiloBordado: 0,
      empaque: 0,
      manoObra: 0,
      bordado: 0,
      indirectos: 0,
      costoEstandar: 0,
      precioSugerido: 0,
      margenObjetivo: MARGEN_OBJETIVO_PCT,
    };
  }

  private resultadoError(error: unknown, predeterminado: string): Observable<ResultadoM11> {
    return of({ ok: false, mensaje: mensajeError(error, predeterminado) });
  }

  private listarPagina<T>(
    path: string,
    params: Record<string, ValorParametro> = {},
    pagina = 1,
    acumulado: T[] = [],
  ): Observable<T[]> {
    return this.api
      .get<Pagina<T>>(path, { params: { ...params, pagina, por_pagina: POR_PAGINA } })
      .pipe(
        switchMap((respuesta) => {
          const items = [...acumulado, ...respuesta.items];
          return items.length < respuesta.total
            ? this.listarPagina(path, params, pagina + 1, items)
            : of(items);
        }),
      );
  }

  private listarCosteo(): Observable<CosteoFilaApi[]> {
    return this.api
      .get<CosteoFilaApi[] | Pagina<CosteoFilaApi>>('/recetas/costeo')
      .pipe(map((respuesta) => (Array.isArray(respuesta) ? respuesta : respuesta.items)));
  }
}

function deMaterialApi(item: MaterialApi): MaterialCatalogo {
  return {
    id: item.id,
    codigo: item.codigo,
    nombre: item.nombre,
    categoria: item.categoria as CategoriaMaterial,
    unidadBase: item.unidad_base as MaterialCatalogo['unidadBase'],
    costoBase: numero(item.costo_estandar_base),
    mermaPct: numero(item.merma_estandar_pct),
    conColor: item.por_color,
    presentacion: `${item.unidad_compra} · factor ${item.factor_compra_base}`,
    porPrenda: item.categoria === 'Empaque',
  };
}

function deRecetaApi(item: RecetaApi): Receta {
  return {
    id: item.id,
    productoId: item.producto_id,
    producto: item.producto,
    talla: item.talla as CodigoTalla,
    tallaId: item.talla_id,
    version: item.version,
    estado: item.estado as Receta['estado'],
    origenRecetaId: null,
    manoObra: numero(item.mano_obra),
    costoBordado: numero(item.costo_bordado),
    costosIndirectos: numero(item.costos_indirectos),
    nota: texto(item.nota),
    creadaPor: item.creada_por === null ? 'No disponible' : `Usuario ${item.creada_por}`,
    creadaEn: item.actualizado_en,
    activadaEn: item.activada_en,
    precioVenta: item.precio_venta === null || item.precio_venta === undefined ? undefined : numero(item.precio_venta),
    materiaPrima: item.costo_materia_prima === undefined ? undefined : numero(item.costo_materia_prima),
    hiloBordado: item.costo_hilo_bordado === undefined ? undefined : numero(item.costo_hilo_bordado),
    costoEmpaque: item.costo_empaque === undefined ? undefined : numero(item.costo_empaque),
    costoEstandar: item.costo_estandar === undefined ? undefined : numero(item.costo_estandar),
    precioSugerido: item.precio_sugerido === undefined ? undefined : numero(item.precio_sugerido),
    margenReal:
      item.margen_real === null || item.margen_real === undefined
        ? undefined
        : numero(item.margen_real),
    lineas: (item.lineas ?? []).map((linea) => ({
      id: linea.id,
      materialCodigo: linea.material_codigo,
      cantidadNeta: numero(linea.cantidad_neta),
      unidadCaptura: linea.unidad_base as UnidadCaptura,
      factorConsumo: numero(linea.factor_consumo),
      mermaPct: numero(linea.merma_pct),
      cantidadBruta: numero(linea.cantidad_bruta),
      costoLinea: linea.costo_linea === undefined ? undefined : numero(linea.costo_linea),
      esEtiqueta: linea.material_codigo.startsWith('ETQ') || linea.material_codigo.startsWith('ETI'),
      nota: texto(linea.nota),
    })),
    bordados: (item.bordados ?? []).map((bordado) => ({
      id: bordado.id,
      disenoId: bordado.diseno_id,
      aplicaciones: bordado.aplicaciones,
      ubicacion: texto(bordado.ubicacion),
    })),
    bitacora: [],
  };
}

function deDisenoApi(item: DisenoApi): DisenoBordado {
  return {
    id: item.id,
    codigo: item.codigo,
    nombre: item.nombre,
    anchoCm: numero(item.ancho_cm),
    altoCm: numero(item.alto_cm),
    estado: item.estado as DisenoBordado['estado'],
    notas: texto(item.notas),
    activo: item.activo,
    hilos: item.hilos.map((hilo) => ({
      id: hilo.material_id,
      materialCodigo: hilo.material_codigo,
      metrosPorAplicacion: numero(hilo.metros_por_aplicacion),
    })),
  };
}

function deCosteoApi(item: CosteoFilaApi): FilaCosteo {
  return {
    productoId: item.producto_id,
    producto: item.producto,
    talla: item.talla,
    recetaId: item.receta_id,
    manoObra: numero(item.mano_obra),
    bordado: numero(item.costo_bordado),
    indirectos: numero(item.costos_indirectos),
    materiaPrima: numero(item.costo_materia_prima),
    hiloBordado: numero(item.costo_hilo_bordado),
    empaque: numero(item.costo_empaque),
    costoEstandar: numero(item.costo_estandar),
    precioSugerido: numero(item.precio_sugerido),
    precioVigente: numero(item.precio_venta),
    margen: numero(item.margen_real),
  };
}
