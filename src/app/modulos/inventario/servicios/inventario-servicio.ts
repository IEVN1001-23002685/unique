import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, concatMap, forkJoin, from, map, of, tap, toArray } from 'rxjs';
import { ApiService, ValorParametro } from '../../../core/api/api.service';
import { mensajeError } from '../../../core/api/errores';
import { ProveedoresServicio } from '../../proveedores/servicios/proveedores-servicio';
import {
  type CambioPolitica,
  type DatosAjuste,
  type Existencia,
  type ExistenciaVista,
  type FiltrosKardex,
  type LoteMaterial,
  type Material,
  type MovimientoMaterial,
  type ResultadoAjuste,
  type TonoSemaforo,
} from '../modelos/inventario';

export function redondear4(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10000) / 10000;
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Pagina<T> {
  items: T[];
  total: number;
}

interface MaterialApi {
  id: number;
  categoria_material_id?: number;
  categoria: string | null;
  codigo: string;
  nombre: string;
  unidad_base: string;
  unidad_compra: string;
  factor_compra_base: string;
  costo_estandar_base?: string;
  merma_estandar_pct: string;
  por_color: boolean;
  activo: boolean;
}

interface InventarioApi {
  id: number;
  material_id: number;
  material_codigo: string;
  material_nombre: string;
  categoria: string | null;
  color_codigo: string | null;
  unidad_base: string;
  fisico: string;
  reservado: string;
  disponible: string;
  en_compra: string;
  posicion: string;
  consumo_diario: string;
  punto_reorden: string | null;
  cobertura_dias: string | null;
  semaforo: string;
  /** Opcional: si Flask no lo envía, la vista no finge que una orden quedó cubierta. */
  cubre_orden_confirmada?: boolean;
  stock_minimo: string;
  stock_seguridad: string;
  proveedor_principal_id: number | null;
  plazo_dias: number | null;
  factor_compra_base: string;
  activo: boolean;
  costo_estandar_base?: string;
}

interface LoteApi {
  id: number;
  inventario_material_id: number;
  folio: string;
  proveedor_id: number | null;
  fecha_entrada: string;
  material_codigo: string;
  color_codigo: string | null;
  cantidad_base_recibida: string;
  cantidad_base_disponible: string;
  costo_total?: string;
  costo_unitario_base?: string;
  estado: string;
}

interface MovimientoApi {
  id: number;
  lote_id: number;
  lote_folio: string | null;
  tipo: string;
  cantidad_base: string;
  costo_unitario_base?: string;
  documento_tipo: string;
  documento_id: number;
  motivo: string | null;
  fecha: string;
  usuario_id: number;
}

interface RequisicionApi {
  estado: string;
  lineas: { inventario_material_id: number }[];
}

/** Catálogo M22 leído en solo lectura para resolver la FK al dar de alta materiales. */
interface CategoriaMaterialApi {
  id: number;
  nombre: string;
  activa?: boolean;
}

function listarTodo<T>(
  api: ApiService,
  ruta: string,
  params: Record<string, ValorParametro> = {},
): Observable<T[]> {
  const porPagina = 100;
  /** Tope defensivo: una API que ignore `pagina` no debe generar un ciclo infinito. */
  const maxPaginas = 50;
  const pedir = (pagina: number, previos: T[], restantes: number): Observable<T[]> =>
    api
      .get<Pagina<T>>(ruta, { params: { ...params, pagina, por_pagina: porPagina } })
      .pipe(
        concatMap((respuesta) => {
          const items = respuesta.items ?? [];
          const acumulados = [...previos, ...items];
          const total = typeof respuesta.total === 'number' ? respuesta.total : acumulados.length;
          if (
            items.length === 0 ||
            items.length < porPagina ||
            acumulados.length >= total ||
            restantes <= 1
          ) {
            return of(acumulados);
          }
          return pedir(pagina + 1, acumulados, restantes - 1);
        }),
      );
  return pedir(1, [], maxPaginas);
}

function unidadApi(valor: string): 'M2' | 'M' | 'PZA' {
  if (valor === 'm²' || valor === 'M2') {
    return 'M2';
  }
  if (valor === 'm' || valor === 'M') {
    return 'M';
  }
  return 'PZA';
}

function unidadVista(valor: string): Material['unidadBase'] {
  if (valor === 'M2') {
    return 'm²';
  }
  if (valor === 'M') {
    return 'm';
  }
  return 'pieza';
}

/** M15 contra la API: catálogo, inventario base, lotes y kardex los persiste Flask. */
@Injectable({ providedIn: 'root' })
export class InventarioServicio {
  private readonly api = inject(ApiService);
  private readonly proveedores = inject(ProveedoresServicio);

  private readonly listaMateriales = signal<Material[]>([]);
  private readonly listaExistencias = signal<Existencia[]>([]);
  private readonly listaLotes = signal<LoteMaterial[]>([]);
  private readonly listaMovimientos = signal<MovimientoMaterial[]>([]);
  private readonly idsConRequisicion = signal<Set<number>>(new Set());
  private readonly catalogoCategorias = signal<CategoriaMaterialApi[]>([]);
  private readonly cargandoInterno = signal(false);
  private readonly errorCargaInterno = signal('');
  private readonly limitacionRequisicionesInterno = signal('');
  private readonly limitacionCatalogosInterno = signal('');

  /** El plazo llega de M13: se proyecta en cada lectura, nunca se guarda como dato de M15. */
  readonly materiales = computed<Material[]>(() =>
    this.listaMateriales().map((material) => ({
      ...material,
      plazoDias: this.plazoDe(material.id),
    })),
  );
  readonly existencias = this.listaExistencias.asReadonly();
  readonly lotes = this.listaLotes.asReadonly();
  readonly movimientos = this.listaMovimientos.asReadonly();
  readonly cargado = signal(false);
  readonly cargando = this.cargandoInterno.asReadonly();
  /** Una lista vacía no debe confundirse con un fallo de Flask. */
  readonly errorCarga = this.errorCargaInterno.asReadonly();
  /** M14 puede no autorizar GET /requisiciones al Operativo; no bloquea M15. */
  readonly limitacionRequisiciones = this.limitacionRequisicionesInterno.asReadonly();
  /** M22 puede no estar disponible; se conservan las FK ya conocidas en M15. */
  readonly limitacionCatalogos = this.limitacionCatalogosInterno.asReadonly();

  readonly vistas = computed<ExistenciaVista[]>(() =>
    this.listaExistencias()
      .filter((existencia) => existencia.activo)
      .map((existencia) => this.proyectar(existencia)),
  );

  readonly lotesOrdenados = computed(() =>
    [...this.listaLotes()].sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada)),
  );

  constructor() {
    this.recargar().subscribe();
  }

  recargar(): Observable<void> {
    this.cargandoInterno.set(true);
    this.errorCargaInterno.set('');
    this.limitacionRequisicionesInterno.set('');
    this.limitacionCatalogosInterno.set('');
    const categorias = listarTodo<CategoriaMaterialApi>(
      this.api,
      '/catalogos/categoria-material',
    ).pipe(
      catchError((error: unknown) => {
        this.limitacionCatalogosInterno.set(
          `No fue posible consultar categorías de material de M22: ${mensajeError(error)}. ` +
            'El alta usará solo las categorías ya presentes en el catálogo de M15.',
        );
        return of([] as CategoriaMaterialApi[]);
      }),
    );
    const requisiciones = listarTodo<RequisicionApi>(this.api, '/requisiciones').pipe(
      catchError((error: unknown) => {
        this.limitacionRequisicionesInterno.set(
          `No fue posible consultar requisiciones abiertas de M14: ${mensajeError(error)}. ` +
            'El indicador «Sin requisición» es orientativo: Flask debe confirmar la existencia ' +
            'de una requisición antes de generar una automática.',
        );
        return of([] as RequisicionApi[]);
      }),
    );
    return forkJoin({
      materiales: listarTodo<MaterialApi>(this.api, '/materiales', {
        incluir_inactivos: true,
      }),
      inventario: listarTodo<InventarioApi>(this.api, '/inventario/material'),
      lotes: listarTodo<LoteApi>(this.api, '/inventario/material/lotes'),
      movimientos: listarTodo<MovimientoApi>(this.api, '/inventario/material/movimientos'),
      requisiciones,
      categorias,
    }).pipe(
      tap(({ materiales, inventario, lotes, movimientos, requisiciones, categorias }) => {
        const materialesVista = materiales.map((fila) => this.adaptarMaterial(fila));
        this.listaMateriales.set(materialesVista);
        this.catalogoCategorias.set(categorias);
        this.listaExistencias.set(inventario.map((fila) => this.adaptarExistencia(fila)));
        this.listaLotes.set(
          lotes.map((fila) => {
            const posicion = this.listaExistencias().find(
              (existencia) => existencia.id === fila.inventario_material_id,
            );
            return {
              id: fila.id,
              folio: fila.folio,
              materialId: posicion?.materialId ?? 0,
              color: fila.color_codigo ?? posicion?.color ?? 'NA',
              proveedorId: fila.proveedor_id ?? 0,
              fechaEntrada: fila.fecha_entrada,
              cantidadRecibida: Number(fila.cantidad_base_recibida),
              cantidadDisponible: Number(fila.cantidad_base_disponible),
              costoUnitario: Number(fila.costo_unitario_base ?? 0),
              medidas: `${fila.material_codigo} · ${fila.folio}`,
              estado: fila.estado as LoteMaterial['estado'],
            };
          }),
        );
        const lotesPorId = new Map(this.listaLotes().map((lote) => [lote.id, lote]));
        this.listaMovimientos.set(
          movimientos.map((fila) => {
            const lote = lotesPorId.get(fila.lote_id);
            return {
              id: fila.id,
              fecha: fila.fecha,
              materialId: lote?.materialId ?? 0,
              color: lote?.color ?? 'NA',
              loteFolio: fila.lote_folio,
              tipo: fila.tipo as MovimientoMaterial['tipo'],
              cantidadBase: Number(fila.cantidad_base),
              costoUnitario: Number(fila.costo_unitario_base ?? 0),
              documento: `${fila.documento_tipo}-${fila.documento_id}`,
              motivo: fila.motivo ?? '',
              usuario: `Usuario ${fila.usuario_id}`,
            };
          }),
        );
        this.idsConRequisicion.set(
          new Set(
            requisiciones
              .filter((requisicion) => !['ATENDIDA', 'CANCELADA'].includes(requisicion.estado))
              .flatMap((requisicion) =>
                (requisicion.lineas ?? []).map((linea) => linea.inventario_material_id),
              ),
          ),
        );
      }),
      catchError((error: unknown) => {
        this.errorCargaInterno.set(
          mensajeError(error, 'No fue posible cargar el inventario de materia prima desde Flask.'),
        );
        this.listaMateriales.set([]);
        this.listaExistencias.set([]);
        this.listaLotes.set([]);
        this.listaMovimientos.set([]);
        this.idsConRequisicion.set(new Set());
        this.catalogoCategorias.set([]);
        return of(undefined);
      }),
      tap(() => {
        this.cargandoInterno.set(false);
        this.cargado.set(true);
      }),
      map(() => undefined),
    );
  }

  tieneHistoricoConsumo(materialId: number, color: string): boolean {
    const corte = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    return this.listaMovimientos().some(
      (movimiento) =>
        movimiento.tipo === 'CONSUMO' &&
        movimiento.materialId === materialId &&
        movimiento.color === color &&
        movimiento.fecha >= corte,
    );
  }

  obtenerMaterial(id: number): Material | undefined {
    return this.materiales().find((material) => material.id === id);
  }

  nombreMaterial(id: number): string {
    return this.obtenerMaterial(id)?.nombre ?? 'Material no disponible';
  }

  nombreProveedor(id: number): string {
    return this.proveedores.obtenerPorId(id)?.nombreComercial ?? 'Proveedor no disponible';
  }

  existeCodigo(codigo: string, exceptoId = 0): boolean {
    const normalizado = codigo.trim().toUpperCase();
    return this.materiales().some(
      (material) => material.id !== exceptoId && material.codigo.toUpperCase() === normalizado,
    );
  }

  obtenerExistencia(id: number): Existencia | undefined {
    return this.listaExistencias().find((existencia) => existencia.id === id);
  }

  vistaPorId(id: number): ExistenciaVista | undefined {
    return this.vistas().find((vista) => vista.id === id);
  }

  lotesDe(materialId: number, color?: string): LoteMaterial[] {
    return this.lotesOrdenados().filter(
      (lote) =>
        lote.materialId === materialId &&
        (color === undefined || color === '' || lote.color === color),
    );
  }

  esPrimerLotePEPS(lote: LoteMaterial): boolean {
    const primero = this.lotesDe(lote.materialId, lote.color).find(
      (candidato) => candidato.cantidadDisponible > 0,
    );
    return primero?.id === lote.id;
  }

  coloresDe(materialId: number): string[] {
    return [
      ...new Set(
        this.listaExistencias()
          .filter((existencia) => existencia.materialId === materialId && existencia.activo)
          .map((existencia) => existencia.color),
      ),
    ];
  }

  movimientosFiltrados(filtros: FiltrosKardex): MovimientoMaterial[] {
    return this.listaMovimientos()
      .filter((movimiento) => {
        if (filtros.materialId > 0 && movimiento.materialId !== filtros.materialId) {
          return false;
        }
        if (filtros.color !== '' && movimiento.color !== filtros.color) {
          return false;
        }
        if (filtros.loteFolio !== '' && movimiento.loteFolio !== filtros.loteFolio) {
          return false;
        }
        if (filtros.tipo !== 'TODOS' && movimiento.tipo !== filtros.tipo) {
          return false;
        }
        if (filtros.desde !== '' && movimiento.fecha < filtros.desde) {
          return false;
        }
        if (filtros.hasta !== '' && movimiento.fecha > filtros.hasta) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  }

  guardarMaterial(material: Material): Observable<Material | null> {
    const categoriaId = this.categoriaId(material.categoria);
    if (categoriaId === 0) {
      return of(null);
    }
    const cuerpo = {
      categoria_material_id: categoriaId,
      codigo: material.codigo.trim().toUpperCase(),
      nombre: material.nombre.trim(),
      unidad_base: unidadApi(material.unidadBase),
      unidad_compra: material.unidadCompra.trim(),
      factor_compra_base: redondear4(material.factorCompraBase),
      costo_estandar_base: material.costoEstandarBase,
      merma_estandar_pct: material.mermaEstandarPct,
      por_color: material.porColor,
      activo: material.activo,
    };
    const peticion =
      material.id === 0
        ? this.api.post<MaterialApi>('/materiales', cuerpo)
        : this.api.patch<MaterialApi>(`/materiales/${material.id}`, cuerpo);
    return peticion.pipe(
      concatMap((respuesta) => this.recargar().pipe(map(() => respuesta))),
      map((respuesta) => this.obtenerMaterial(respuesta.id) ?? null),
    );
  }

  /**
   * DELETE /materiales/{id} aplica baja lógica en Flask cuando hay historial.
   * La inferencia local solo describe lo esperado; Flask y M11 deciden de forma autoritativa.
   */
  eliminarMaterial(id: number): Observable<'eliminado' | 'desactivado' | 'no-encontrado'> {
    if (!this.obtenerMaterial(id)) {
      return of('no-encontrado' as const);
    }
    const conLotes = this.listaLotes().some((lote) => lote.materialId === id);
    return this.api.delete(`/materiales/${id}`).pipe(
      concatMap(() => this.recargar()),
      map(() => (conLotes ? ('desactivado' as const) : ('eliminado' as const))),
    );
  }

  guardarPoliticas(cambios: CambioPolitica[]): Observable<void> {
    return from(cambios).pipe(
      concatMap((cambio) =>
        this.api.patch(`/inventario/material/${cambio.existenciaId}/politica`, {
          stock_minimo: redondear4(cambio.stockMinimo),
          stock_seguridad: redondear4(cambio.stockSeguridad),
          consumo_diario_manual:
            cambio.consumoDiarioManual === 0 ? null : redondear4(cambio.consumoDiarioManual),
        }),
      ),
      toArray(),
      concatMap(() => this.recargar()),
      map(() => undefined),
    );
  }

  /** Flask escribe el movimiento de ajuste y, si aplica, la merma; Angular solo lee. */
  registrarAjuste(datos: DatosAjuste): Observable<ResultadoAjuste | null> {
    const existencia = this.obtenerExistencia(datos.existenciaId);
    if (!existencia || !Number.isFinite(datos.cantidadContada) || datos.cantidadContada < 0) {
      return of(null);
    }
    const diferencia = redondear4(datos.cantidadContada - existencia.fisico);
    return this.api
      .post<InventarioApi>('/inventario/material/ajuste', {
        inventario_material_id: datos.existenciaId,
        cantidad_contada: redondear4(datos.cantidadContada),
        motivo: datos.motivo.trim(),
        mandar_a_merma: datos.enviarAMerma && diferencia < 0,
      })
      .pipe(
        concatMap(() => this.recargar()),
        map(() => {
          // Si Flask no devuelve el movimiento en la recarga, no se inventa uno.
          const movimiento: MovimientoMaterial | null =
            this.listaMovimientos().find(
              (item) =>
                item.materialId === existencia.materialId &&
                item.color === existencia.color &&
                Math.abs(Math.abs(item.cantidadBase) - Math.abs(diferencia)) < 0.0001 &&
                item.motivo.includes(datos.motivo.trim()),
            ) ?? null;
          return {
            movimiento,
            diferencia,
            loteAfectado: movimiento?.loteFolio ?? null,
            merma:
              datos.enviarAMerma && diferencia < 0
                ? {
                    materialId: existencia.materialId,
                    color: existencia.color,
                    cantidadBase: Math.abs(diferencia),
                    unidadBase: this.obtenerMaterial(existencia.materialId)?.unidadBase ?? 'pieza',
                    causa: datos.motivo.trim(),
                    etapa: 'ALMACEN',
                  }
                : null,
          } satisfies ResultadoAjuste;
        }),
      );
  }

  private plazoDe(materialId: number): number | null {
    const lineas = this.proveedores.cobertura().get(materialId) ?? [];
    const plazos = lineas.map((linea) => linea.plazoDias).filter((dias) => dias > 0);
    return plazos.length > 0 ? Math.min(...plazos) : null;
  }

  private adaptarMaterial(fila: MaterialApi): Material {
    return {
      id: fila.id,
      codigo: fila.codigo,
      nombre: fila.nombre,
      categoria: (fila.categoria ?? 'Avío') as Material['categoria'],
      unidadBase: unidadVista(fila.unidad_base),
      unidadCompra: fila.unidad_compra,
      factorCompraBase: Number(fila.factor_compra_base),
      presentacion: fila.unidad_compra,
      costoEstandarBase: Number(fila.costo_estandar_base ?? 0),
      mermaEstandarPct: Number(fila.merma_estandar_pct),
      porColor: fila.por_color,
      plazoDias: null,
      activo: fila.activo,
      categoriaMaterialId: fila.categoria_material_id,
    };
  }

  private adaptarExistencia(fila: InventarioApi): Existencia {
    return {
      id: fila.id,
      materialId: fila.material_id,
      color: fila.color_codigo ?? 'NA',
      fisico: Number(fila.fisico),
      reservado: Number(fila.reservado),
      enCompra: Number(fila.en_compra),
      stockMinimo: Number(fila.stock_minimo),
      stockSeguridad: Number(fila.stock_seguridad),
      consumoDiarioManual: Number(fila.consumo_diario),
      cubreOrdenConfirmada: fila.cubre_orden_confirmada,
      activo: fila.activo,
      plazoDiasApi: fila.plazo_dias,
      consumoDiarioApi: Number(fila.consumo_diario),
      puntoReordenApi: fila.punto_reorden === null ? null : Number(fila.punto_reorden),
      coberturaDiasApi: fila.cobertura_dias === null ? null : Number(fila.cobertura_dias),
      posicionApi: Number(fila.posicion),
      semaforoApi: fila.semaforo as TonoSemaforo,
    };
  }

  private proyectar(existencia: Existencia): ExistenciaVista {
    const material = this.obtenerMaterial(existencia.materialId);
    if (!material) {
      throw new Error(`Existencia ${existencia.id} sin material válido`);
    }
    const disponible = redondear4(existencia.fisico - existencia.reservado);
    const consumoDiario = existencia.consumoDiarioApi ?? existencia.consumoDiarioManual;
    const puntoApi = existencia.puntoReordenApi;
    // El plazo calculado por Flask para la vista prevalece; M13 es la primera alternativa.
    const plazo = existencia.plazoDiasApi ?? material.plazoDias;
    const plazoPendiente = (puntoApi === undefined || puntoApi === null) && plazo === null;
    const puntoReorden =
      puntoApi ??
      (plazo === null ? 0 : redondear4(consumoDiario * plazo + existencia.stockSeguridad));
    const coberturaDias =
      existencia.coberturaDiasApi !== undefined
        ? existencia.coberturaDiasApi
        : consumoDiario > 0
          ? redondear4(disponible / consumoDiario)
          : null;
    const posicion = existencia.posicionApi ?? redondear4(disponible + existencia.enCompra);
    const requisicionAbierta = this.idsConRequisicion().has(existencia.id);
    const semaforo = existencia.semaforoApi ?? this.semaforoLocal(disponible, existencia, puntoReorden);

    return {
      ...existencia,
      material: { ...material, plazoDias: plazo },
      disponible,
      posicion,
      consumoDiario: redondear4(consumoDiario),
      puntoReorden,
      coberturaDias,
      semaforo,
      motivoSemaforo: this.motivoSemaforo(semaforo, disponible, existencia, puntoReorden),
      plazoPendiente,
      requisicionAbierta,
      requiereAtencion: !plazoPendiente && posicion <= puntoReorden && !requisicionAbierta,
    };
  }

  private semaforoLocal(
    disponible: number,
    existencia: Existencia,
    puntoReorden: number,
  ): TonoSemaforo {
    if (disponible <= existencia.stockMinimo || existencia.cubreOrdenConfirmada === false) {
      return 'ROJO';
    }
    return disponible <= puntoReorden ? 'AMBAR' : 'VERDE';
  }

  private motivoSemaforo(
    semaforo: TonoSemaforo,
    disponible: number,
    existencia: Existencia,
    puntoReorden: number,
  ): string {
    if (semaforo === 'VERDE') {
      return 'Cobertura suficiente según Flask.';
    }
    if (semaforo === 'ROJO') {
      if (disponible <= existencia.stockMinimo) {
        return 'Disponible en o por debajo del stock mínimo.';
      }
      return existencia.cubreOrdenConfirmada === false
        ? 'Una orden confirmada no queda cubierta por el disponible.'
        : 'Flask marcó la posición en rojo por demanda o fecha.';
    }
    return `Disponible en o por debajo del punto de reorden (${puntoReorden}).`;
  }

  private categoriaId(nombre: Material['categoria']): number {
    const normalizado = nombre.toLocaleLowerCase('es-MX');
    const delCatalogo = this.catalogoCategorias().find(
      (categoria) =>
        categoria.activa !== false && categoria.nombre.toLocaleLowerCase('es-MX') === normalizado,
    );
    return (
      delCatalogo?.id ??
      this.listaMateriales().find((material) => material.categoria === nombre)?.categoriaMaterialId ??
      0
    );
  }
}
