import { Injectable, computed, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, catchError, concatMap, forkJoin, map, of, tap } from 'rxjs';
import { ApiService, type ValorParametro } from '../../../core/api/api.service';
import { mensajeError } from '../../../core/api/errores';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { PerfilSesionServicio } from '../../../nucleo/servicios/perfil-sesion-servicio';
import { decimalPositivo } from '../../../compartido/validadores/validadores-negocio';
import type { LoteMaterial, Material } from '../../inventario/modelos/inventario';
import { InventarioServicio } from '../../inventario/servicios/inventario-servicio';
import type { FilaVariante } from '../../productos/modelos/producto-maestro';
import { ProductosServicio } from '../../productos/servicios/productos-servicio';
import { ProduccionServicio } from '../../produccion/servicios/produccion-servicio';
import type {
  AlertaMerma,
  CausaMerma,
  DatosNuevaMerma,
  EtapaMerma,
  FilaEvolucion,
  FilaIndicador,
  FiltrosZona,
  IndicadoresMerma,
  Merma,
  MermaVista,
  OpcionLote,
  OpcionMaterial,
  OpcionVariante,
  OrigenMerma,
  ProcedenciaMerma,
  ResultadoAccion,
  ResultadoRegistro,
} from '../modelos/merma';
import {
  ETAPAS_MERMA,
  ETIQUETAS_ETAPA,
  ETIQUETAS_PROCEDENCIA,
  META_MERMA_PCT,
} from '../modelos/merma';

/** Fecha local de México; toISOString() usaría UTC y podría cambiar el día. */
export function hoyISO(): string {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export function redondear4(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10000) / 10000;
}

function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function numero(valor: unknown): number {
  const resultado = Number(valor ?? 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

function mesesDelPeriodo(periodo: string, cantidad: number): string[] {
  const [anioTexto, mesTexto] = periodo.split('-');
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  const resultado: string[] = [];
  for (let indice = cantidad - 1; indice >= 0; indice -= 1) {
    const fecha = new Date(anio, mes - 1 - indice, 1);
    resultado.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`);
  }
  return resultado;
}

interface PaginaApi<T> {
  items: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

/**
 * Lectura paginada con tope defensivo. Acepta envelope paginado o arreglo plano;
 * una API que ignore `pagina` no debe generar un ciclo infinito.
 */
function listarTodo<T>(
  api: ApiService,
  ruta: string,
  params: Record<string, ValorParametro> = {},
): Observable<T[]> {
  const porPagina = 100;
  const maxPaginas = 50;
  const pedir = (pagina: number, previos: T[], restantes: number): Observable<T[]> =>
    api
      .get<PaginaApi<T> | T[]>(ruta, { params: { ...params, pagina, por_pagina: porPagina } })
      .pipe(
        concatMap((respuesta) => {
          const items = Array.isArray(respuesta) ? respuesta : (respuesta.items ?? []);
          const acumulados = [...previos, ...items];
          const total = Array.isArray(respuesta)
            ? acumulados.length
            : typeof respuesta.total === 'number'
              ? respuesta.total
              : acumulados.length;
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

const PROCEDENCIAS: readonly ProcedenciaMerma[] = [
  'MANUAL',
  'M14',
  'M15',
  'M16',
  'M07',
  'M12',
  'REVERSION',
];

function extraerReverso(
  respuesta:
    | MermaApi
    | { merma?: MermaApi; reverso?: MermaApi; merma_inversa?: MermaApi },
): MermaApi {
  if ('id' in respuesta && typeof respuesta.id === 'number') {
    return respuesta;
  }
  if ('reverso' in respuesta && respuesta.reverso) {
    return respuesta.reverso;
  }
  if ('merma_inversa' in respuesta && respuesta.merma_inversa) {
    return respuesta.merma_inversa;
  }
  if ('merma' in respuesta && respuesta.merma) {
    return respuesta.merma;
  }
  throw new Error('Flask no devolvió el registro inverso de la corrección.');
}

interface MermaApi {
  id: number;
  /** Si Flask define un folio propio se muestra; si no, se usa el id como referencia. */
  folio?: string | null;
  /**
   * Procedencia declarada por Flask (M07, M12, M14, M15, M16). Se respeta cuando
   * viene: el frontend no puede inferir de forma fiable una merma de M15 o M12.
   */
  procedencia?: string | null;
  origen: OrigenMerma;
  inventario_material_id: number | null;
  lote_id: number | null;
  variante_id: number | null;
  orden_produccion_id: number | null;
  recepcion_linea_id: number | null;
  devolucion_linea_id: number | null;
  reversa_de_id: number | null;
  etapa: EtapaMerma;
  causa_id: number;
  causa_nombre: string | null;
  cantidad: string;
  descripcion: string | null;
  evidencia_url: string | null;
  registrada_por: number | string | null;
  fecha: string | null;
  sku?: string | null;
  material_codigo?: string | null;
  costo_perdido?: string;
}

interface CausaApi {
  id: number;
  nombre: string;
  aplica_a: OrigenMerma | 'AMBOS';
  etapa_sugerida: string | null;
  activa: boolean;
}

interface DetalleIndicadorApi {
  fecha: string;
  etapa: string;
  causa: string;
  producto: string | null;
  material: string | null;
  cantidad: string;
  costo_perdido: string;
  /** Lo calcula Flask en v_merma_resumen; si no viene, la vista lo deriva del detalle. */
  porcentaje_etapa?: string | null;
}

interface IndicadoresApi {
  meta_pct: string;
  merma_producto: string;
  merma_material: string;
  unidades_producidas: string;
  material_consumido: string;
  merma_producto_pct: string;
  merma_material_pct: string;
  costo_perdido: string;
  por_etapa?: Record<string, { cantidad: string; costo_perdido: string }>;
  top_causas?: { causa: string; cantidad: string }[];
  detalle: DetalleIndicadorApi[];
}

interface IndicadoresVacios {
  metaPct: number;
  periodo: string;
  mermaProductoPct: number;
  mermaMaterialPct: number;
  referenciaProducto: number;
  referenciaMaterial: number;
  cantidadProducto: number;
  cantidadMaterial: number;
  costoPerdido: number;
  costoPerdidoMes: number;
  totalRegistros: number;
  porEtapa: FilaIndicador[];
  porCausa: FilaIndicador[];
  porProducto: FilaIndicador[];
  porMaterial: FilaIndicador[];
  causasTop5: FilaIndicador[];
  evolucion: FilaEvolucion[];
  alertas: AlertaMerma[];
}

/**
 * Estado de M17 alimentado por Flask. GET /mermas y POST /mermas son A,O;
 * el catálogo de causas, los indicadores y el reverso son exclusivos de ADMIN.
 * Nunca se edita un registro: un error se corrige con una nueva fila de reverso.
 */
@Injectable({ providedIn: 'root' })
export class MermasServicio {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStateService);
  private readonly perfilSesion = inject(PerfilSesionServicio);
  private readonly inventario = inject(InventarioServicio);
  private readonly productos = inject(ProductosServicio);
  private readonly produccion = inject(ProduccionServicio);

  private readonly lista = signal<Merma[]>([]);
  private readonly listaCausas = signal<CausaMerma[]>([]);
  private readonly total = signal(0);
  private readonly indicadoresApi = signal<IndicadoresApi | null>(null);
  private readonly reversados = signal<Set<number>>(new Set());
  private readonly cargandoInterno = signal(false);
  private readonly errorCargaInterno = signal('');
  private readonly limitacionAdminInterno = signal('');

  readonly cargado = signal(false);
  readonly cargando = this.cargandoInterno.asReadonly();
  /** Lista vacía no debe confundirse con un fallo de Flask. */
  readonly errorCarga = this.errorCargaInterno.asReadonly();
  /** Catálogo e indicadores son de Administrador; si fallan, el historial sigue útil. */
  readonly limitacionAdmin = this.limitacionAdminInterno.asReadonly();
  readonly esAdministrador = computed(() =>
    this.auth.puede(['ADMIN']),
  );

  readonly mermas = this.lista.asReadonly();
  readonly causas = this.listaCausas.asReadonly();

  readonly vistas = computed<MermaVista[]>(() => {
    const reversados = this.reversados();
    return [...this.lista()]
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)
      .map((merma) => ({
        ...merma,
        etiquetaItem: this.etiquetaItem(merma),
        etiquetaProcedencia: ETIQUETAS_PROCEDENCIA[merma.procedencia],
        reversada: reversados.has(merma.id),
      }));
  });

  constructor() {
    this.recargar().subscribe();
  }

  /** Recarga desde Flask. Nunca sustituye datos buenos por listas vacías ante un error. */
  recargar(): Observable<void> {
    const admin = this.esAdministrador();
    this.cargandoInterno.set(true);
    this.errorCargaInterno.set('');
    this.limitacionAdminInterno.set('');

    const causas = listarTodo<CausaApi>(this.api, '/catalogos/causa-merma').pipe(
      map((respuesta) => respuesta.map((causa) => this.adaptarCausa(causa))),
      catchError((error: unknown) => {
        this.limitacionAdminInterno.set(
          `No fue posible consultar el catálogo de causas de M22: ${mensajeError(error)}. ` +
            'Se muestran solo las causas observadas en el historial.',
        );
        return of([] as CausaMerma[]);
      }),
    );

    const indicadores = admin
      ? this.api.get<IndicadoresApi>('/mermas/indicadores').pipe(
          catchError((error: unknown) => {
            const aviso =
              `No fue posible consultar los indicadores de M17: ${mensajeError(error)}. ` +
              'Las cifras se muestran como no disponibles hasta reintentar.';
            this.limitacionAdminInterno.set(
              this.limitacionAdminInterno()
                ? `${this.limitacionAdminInterno()} ${aviso}`
                : aviso,
            );
            return of(null);
          }),
        )
      : of(null);

    return forkJoin({
      mermas: listarTodo<MermaApi>(this.api, '/mermas'),
      causas: admin ? causas : of([] as CausaMerma[]),
      indicadores,
    }).pipe(
      tap(({ mermas, causas: catalogoCausas, indicadores: datosIndicadores }) => {
        const filas = mermas.map((fila) => this.adaptarMerma(fila, admin));
        this.lista.set(filas);
        this.total.set(filas.length);
        this.listaCausas.set(
          catalogoCausas.length > 0 ? catalogoCausas : this.causasObservadas(filas),
        );
        this.indicadoresApi.set(datosIndicadores);
      }),
      tap(() => {
        this.cargandoInterno.set(false);
        this.cargado.set(true);
      }),
      catchError((error: unknown) => {
        this.errorCargaInterno.set(
          mensajeError(error, 'No fue posible cargar las mermas desde Flask.'),
        );
        this.cargandoInterno.set(false);
        this.cargado.set(true);
        return of(undefined);
      }),
      map(() => undefined),
    );
  }

  private adaptarCausa(causa: CausaApi): CausaMerma {
    const etapa = ETAPAS_MERMA.find((item) => item === causa.etapa_sugerida) ?? null;
    return {
      id: causa.id,
      nombre: causa.nombre,
      aplicaA: causa.aplica_a,
      etapaSugerida: etapa,
      activa: causa.activa,
    };
  }

  private causasObservadas(filas: Merma[]): CausaMerma[] {
    const vistas = new Map<number, CausaMerma>();
    filas.forEach((merma) => {
      if (!vistas.has(merma.causaId)) {
        vistas.set(merma.causaId, {
          id: merma.causaId,
          nombre: merma.causaNombre,
          aplicaA: 'AMBOS',
          etapaSugerida: merma.etapa,
          activa: true,
        });
      }
    });
    return [...vistas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-MX'));
  }

  private adaptarMerma(datos: MermaApi, incluirCostos: boolean): Merma {
    const fecha = datos.fecha ?? hoyISO();
    const existencia =
      datos.inventario_material_id === null
        ? undefined
        : this.inventario.vistaPorId(datos.inventario_material_id);
    const lote =
      datos.lote_id === null
        ? undefined
        : this.inventario.lotes().find((item) => item.id === datos.lote_id);
    const filaVariante =
      datos.variante_id === null
        ? undefined
        : this.productos
            .filasVariantes()
            .find((item) => item.variante.id === datos.variante_id);
    const orden =
      datos.orden_produccion_id === null
        ? undefined
        : this.produccion.ordenes().find((item) => item.id === datos.orden_produccion_id);
    const procedencia = this.procedencia(datos);
    const registradaPor = this.nombreRegistrador(datos.registrada_por);
    const motivo = datos.descripcion ?? null;

    return {
      id: datos.id,
      // El documento no define prefijo de folio para merma: no se inventa uno.
      folio: datos.folio?.trim() || `Registro ${datos.id}`,
      origen: datos.origen,
      procedencia,
      automatica: procedencia !== 'MANUAL' && procedencia !== 'REVERSION',
      materialId: datos.inventario_material_id,
      materialCodigo: datos.material_codigo ?? existencia?.material.codigo ?? null,
      materialNombre: existencia?.material.nombre ?? null,
      color:
        datos.origen === 'MATERIAL'
          ? (lote?.color ?? existencia?.color ?? 'NA')
          : filaVariante
            ? this.productos.nombreColor(filaVariante.variante.color)
            : 'NA',
      loteId: datos.lote_id,
      loteFolio: lote?.folio ?? null,
      unidadBase: existencia?.material.unidadBase ?? 'pieza',
      varianteId: datos.variante_id,
      sku: datos.sku ?? filaVariante?.variante.sku ?? null,
      nombreProducto: filaVariante?.productoNombre ?? null,
      talla: filaVariante
        ? this.productos.nombreTalla(filaVariante.variante.talla)
        : null,
      cantidad: datos.reversa_de_id !== null ? -numero(datos.cantidad) : numero(datos.cantidad),
      costoPerdido: incluirCostos ? numero(datos.costo_perdido) : 0,
      etapa: datos.etapa,
      causaId: datos.causa_id,
      causaNombre:
        datos.causa_nombre ??
        this.listaCausas().find((causa) => causa.id === datos.causa_id)?.nombre ??
        `Causa ${datos.causa_id}`,
      ordenFolio: orden?.folio ?? null,
      descripcion: motivo,
      evidenciaNombre: datos.evidencia_url,
      registradaPor,
      fecha,
      esReversion: datos.reversa_de_id !== null,
      reversionDeId: datos.reversa_de_id,
      motivoReversion: datos.reversa_de_id !== null ? motivo : null,
    };
  }

  private procedencia(datos: MermaApi): ProcedenciaMerma {
    if (datos.reversa_de_id !== null) {
      return 'REVERSION';
    }
    const declarada = datos.procedencia as ProcedenciaMerma | undefined;
    if (declarada && declarada !== 'REVERSION' && PROCEDENCIAS.includes(declarada)) {
      return declarada;
    }
    if (datos.orden_produccion_id !== null) {
      return 'M16';
    }
    if (datos.recepcion_linea_id !== null) {
      return 'M14';
    }
    if (datos.devolucion_linea_id !== null) {
      return 'M07';
    }
    return 'MANUAL';
  }

  private nombreRegistrador(valor: number | string | null): string {
    if (valor === null || valor === '') {
      return 'Sin usuario';
    }
    const usuario = this.auth.usuario();
    return usuario && String(usuario.id) === String(valor) ? usuario.nombre : `Usuario ${valor}`;
  }

  private etiquetaItem(merma: Merma): string {
    if (merma.origen === 'MATERIAL') {
      return `${merma.materialNombre ?? merma.materialCodigo ?? 'Material'} · ${merma.color ?? 'NA'} · ${merma.loteFolio ?? 'sin lote'}`;
    }
    return `${merma.sku ?? 'SKU'} · ${merma.nombreProducto ?? ''} · ${merma.talla ?? 'UN'}/${merma.color ?? 'NA'}`;
  }

  porId(id: number): MermaVista | undefined {
    return this.vistas().find((merma) => merma.id === id);
  }

  esReversada(id: number): boolean {
    return this.reversados().has(id);
  }

  filtrar(filtros: FiltrosZona): MermaVista[] {
    const texto = filtros.texto.trim().toLocaleLowerCase('es-MX');
    const producto = filtros.producto.trim().toLocaleLowerCase('es-MX');

    return this.vistas().filter((merma) => {
      if (filtros.periodo !== 'TODOS' && !merma.fecha.startsWith(filtros.periodo)) {
        return false;
      }
      if (filtros.etapa !== 'TODAS' && merma.etapa !== filtros.etapa) {
        return false;
      }
      if (filtros.causaId !== 'TODAS' && merma.causaId !== filtros.causaId) {
        return false;
      }
      if (filtros.origen !== 'TODOS' && merma.origen !== filtros.origen) {
        return false;
      }
      if (
        producto !== '' &&
        `${merma.sku ?? ''} ${merma.nombreProducto ?? ''} ${merma.materialCodigo ?? ''} ${merma.materialNombre ?? ''}`
          .toLocaleLowerCase('es-MX')
          .includes(producto) === false
      ) {
        return false;
      }
      if (texto === '') {
        return true;
      }
      return [
        merma.folio,
        merma.etiquetaItem,
        ETIQUETAS_ETAPA[merma.etapa],
        merma.causaNombre,
        merma.ordenFolio ?? '',
        merma.descripcion ?? '',
        merma.etiquetaProcedencia,
      ]
        .join(' ')
        .toLocaleLowerCase('es-MX')
        .includes(texto);
    });
  }

  causasPara(origen: OrigenMerma): CausaMerma[] {
    return this.listaCausas().filter(
      (causa) => causa.activa && (causa.aplicaA === 'AMBOS' || causa.aplicaA === origen),
    );
  }

  opcionesMateriales(): OpcionMaterial[] {
    return this.inventario
      .vistas()
      .filter((existencia) => existencia.activo)
      .map((existencia) => ({
        materialId: existencia.materialId,
        codigo: existencia.material.codigo,
        nombre: existencia.material.nombre,
        color: existencia.color,
        unidadBase: existencia.material.unidadBase,
        etiqueta: `${existencia.material.codigo} · ${existencia.material.nombre} · ${existencia.color} (${existencia.material.unidadBase})`,
      }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es-MX'));
  }

  lotesDe(materialId: number, color?: string): OpcionLote[] {
    return this.inventario
      .lotes()
      .filter(
        (lote) =>
          lote.materialId === materialId &&
          lote.estado === 'DISPONIBLE' &&
          lote.cantidadDisponible > 0 &&
          (color === undefined || color === '' || lote.color === color),
      )
      .sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada))
      .map((lote) => ({
        id: lote.id,
        folio: lote.folio,
        color: lote.color,
        costoUnitario: lote.costoUnitario,
        disponible: lote.cantidadDisponible,
        etiqueta: `${lote.folio} · ${lote.color} · ${lote.fechaEntrada} · ${lote.cantidadDisponible} disponibles`,
      }));
  }

  opcionesVariantes(): OpcionVariante[] {
    return this.productos
      .filasVariantes()
      .filter((fila) => fila.variante.activa)
      .map((fila) => ({
        varianteId: fila.variante.id,
        sku: fila.variante.sku,
        nombreProducto: fila.productoNombre,
        talla: this.productos.nombreTalla(fila.variante.talla),
        color: this.productos.nombreColor(fila.variante.color),
        etiqueta: `${fila.variante.sku} · ${fila.productoNombre} · ${this.productos.nombreTalla(fila.variante.talla)} / ${this.productos.nombreColor(fila.variante.color)}`,
      }))
      .sort((a, b) => a.sku.localeCompare(b.sku, 'es-MX'));
  }

  ordenesDisponibles(): { id: number; folio: string }[] {
    return this.produccion
      .ordenes()
      .map((orden) => ({ id: orden.id, folio: orden.folio }))
      .sort((a, b) => b.folio.localeCompare(a.folio, 'es-MX'));
  }

  /** Costo estimado solo para la vista; el servidor calcula el costo real al registrar. */
  costoEstimado(
    origen: OrigenMerma,
    materialId: number | null,
    loteId: number | null,
    sku: string,
    cantidad: number | null,
  ): number {
    if (!this.esAdministrador() || cantidad === null || !Number.isFinite(cantidad) || cantidad <= 0) {
      return 0;
    }
    if (origen === 'MATERIAL') {
      const lote = loteId === null ? undefined : this.inventario.lotes().find((item) => item.id === loteId);
      if (lote) {
        return redondear2(lote.costoUnitario * cantidad);
      }
      const material = materialId === null ? undefined : this.inventario.obtenerMaterial(materialId);
      return material ? redondear2(material.costoEstandarBase * cantidad) : 0;
    }
    const fila = this.productos.filasVariantes().find((item) => item.variante.sku === sku.trim());
    const costo = fila ? (this.productos.obtenerProducto(fila.productoId)?.costoEstandar ?? 0) : 0;
    return redondear2(costo * cantidad);
  }

  registrar(datos: DatosNuevaMerma): Observable<ResultadoRegistro> {
    const controlCantidad = new FormControl<number | null>(datos.cantidad);
    if (decimalPositivo(controlCantidad) !== null) {
      return of({
        ok: false,
        mensaje: 'La cantidad debe ser mayor que cero y tener hasta 4 decimales.',
      });
    }
    if (datos.origen === 'PRODUCTO' && !Number.isInteger(datos.cantidad)) {
      return of({ ok: false, mensaje: 'Las prendas se registran en unidades enteras.' });
    }

    const causa = this.causasPara(datos.origen).find((item) => item.id === datos.causaId);
    if (!causa) {
      return of({
        ok: false,
        mensaje: this.listaCausas().length === 0
          ? 'El catálogo de causas no está disponible para este perfil; solicita permiso de Administrador.'
          : 'Selecciona una causa vigente que aplique al origen elegido.',
      });
    }

    let material: Material | undefined;
    let lote: LoteMaterial | undefined;
    let variante: FilaVariante | undefined;
    let ordenProduccionId: number | null = null;

    if (datos.origen === 'MATERIAL') {
      if (datos.materialId === null || datos.loteId === null) {
        return of({ ok: false, mensaje: 'Para materiales indica el material, el color y el lote.' });
      }
      material = this.inventario.obtenerMaterial(datos.materialId);
      lote = this.inventario.lotes().find((item) => item.id === datos.loteId);
      if (!material || !lote || lote.materialId !== datos.materialId) {
        return of({ ok: false, mensaje: 'El lote seleccionado no corresponde al material indicado.' });
      }
    } else {
      variante = this.productos
        .filasVariantes()
        .find((item) => item.variante.sku === datos.sku.trim());
      if (!variante) {
        return of({ ok: false, mensaje: 'Selecciona un SKU válido generado por M10.' });
      }
    }

    if (datos.ordenFolio.trim() !== '') {
      const orden = this.produccion.ordenes().find((item) => item.folio === datos.ordenFolio.trim());
      if (!orden) {
        return of({ ok: false, mensaje: 'La orden de producción indicada ya no está disponible.' });
      }
      ordenProduccionId = orden.id;
    }

    const descripcion = datos.descripcion.trim();
    const evidencia = datos.evidenciaNombre?.trim();
    const cuerpo = {
      origen: datos.origen,
      inventario_material_id: material?.id ?? null,
      lote_id: lote?.id ?? null,
      variante_id: variante?.variante.id ?? null,
      orden_produccion_id: ordenProduccionId,
      etapa: datos.etapa,
      causa_id: causa.id,
      cantidad: redondear4(datos.cantidad),
      descripcion:
        evidencia === undefined || evidencia === ''
          ? descripcion || null
          : `${descripcion || 'Merma registrada'} · Evidencia referida: ${evidencia}`,
    };

    return this.api.post<MermaApi | { merma: MermaApi }>('/mermas', cuerpo).pipe(
      map((respuesta) => {
        const datosRespuesta = 'merma' in respuesta ? respuesta.merma : respuesta;
        const registro = this.adaptarMerma(datosRespuesta, this.esAdministrador());
        this.lista.update((actuales) => [
          registro,
          ...actuales.filter((item) => item.id !== registro.id),
        ]);
        this.total.set(this.lista().length);
        const mensaje = `${registro.folio} registrado en Flask. El descuento de existencias y el movimiento MERMA los ejecuta el servidor.`;
        return { ok: true as const, folio: registro.folio, mensaje };
      }),
      tap(() => this.recargarIndicadores()),
      catchError((error: unknown) =>
        of({ ok: false as const, mensaje: mensajeError(error, 'No fue posible registrar la merma.') }),
      ),
    );
  }

  /** Corrección permitida solo al Administrador: crea un reverso, nunca edita el original. */
  reversar(id: number, motivo: string): Observable<ResultadoAccion> {
    if (!this.esAdministrador()) {
      return of({ ok: false, mensaje: 'Corregir una merma requiere perfil Administrador.' });
    }
    if (motivo.trim().length < 3) {
      return of({ ok: false, mensaje: 'Indica el motivo de la corrección.' });
    }
    const original = this.lista().find((merma) => merma.id === id);
    if (!original) {
      return of({ ok: false, mensaje: 'No se encontró la merma.' });
    }
    if (this.esReversada(id) || original.esReversion) {
      return of({ ok: false, mensaje: 'Esta merma ya fue corregida con un reverso.' });
    }

    return this.api
      .post<MermaApi | { merma?: MermaApi; reverso?: MermaApi; merma_inversa?: MermaApi }>(
        `/mermas/${id}/reversar`,
        { motivo: motivo.trim() },
      )
      .pipe(
        map((respuesta) => {
          const reverso = this.adaptarMerma(extraerReverso(respuesta), true);
          this.lista.update((actuales) => [
            reverso,
            ...actuales.filter((item) => item.id !== reverso.id),
          ]);
          this.total.set(this.lista().length);
          this.reversados.update((actuales) => new Set([...actuales, id]));
          return {
            ok: true,
            mensaje: `${reverso.folio} registrado como inverso de ${original.folio}. El original se conserva sin cambios.`,
          };
        }),
        tap(() => this.recargarIndicadores()),
        catchError((error: unknown) =>
          of({ ok: false, mensaje: mensajeError(error, 'No fue posible reversar la merma.') }),
        ),
      );
  }

  private recargarIndicadores(): void {
    if (!this.esAdministrador()) {
      return;
    }
    this.api
      .get<IndicadoresApi>('/mermas/indicadores')
      .pipe(catchError(() => of(null)))
      .subscribe((respuesta) => this.indicadoresApi.set(respuesta));
  }

  indicadores(): IndicadoresMerma {
    const datos = this.indicadoresApi();
    if (!datos) {
      return this.indicadoresVacios();
    }

    const periodo = hoyISO().slice(0, 7);
    const detalle = datos.detalle ?? [];
    const porEtapaApi = datos.por_etapa ?? {};
    const topCausasApi = datos.top_causas ?? [];
    const metaPct = numero(datos.meta_pct);
    const productoPct = numero(datos.merma_producto_pct);
    const materialPct = numero(datos.merma_material_pct);
    const cantidadProducto = redondear4(numero(datos.merma_producto));
    const cantidadMaterial = redondear4(numero(datos.merma_material));
    const referenciaProducto = numero(datos.unidades_producidas);
    const referenciaMaterial = numero(datos.material_consumido);
    const costo = numero(datos.costo_perdido);

    const porEtapa: FilaIndicador[] = ETAPAS_MERMA.map((etapa) => {
      const filas = detalle.filter((fila) => fila.etapa === etapa);
      const cantidadPiezas = redondear4(
        filas.reduce((total, fila) => total + (fila.producto ? numero(fila.cantidad) : 0), 0),
      );
      const cantidadM2 = redondear4(
        filas.reduce((total, fila) => total + (fila.material ? numero(fila.cantidad) : 0), 0),
      );
      const referencia = cantidadPiezas > 0 ? referenciaProducto : referenciaMaterial;
      // Flask calcula el porcentaje por etapa en v_merma_resumen; solo se deriva
      // si la respuesta no lo informa, para no redefinir una regla de negocio.
      const informado = filas.find(
        (fila) =>
          fila.porcentaje_etapa !== undefined &&
          fila.porcentaje_etapa !== null &&
          fila.porcentaje_etapa !== '',
      );
      const porcentaje = informado
        ? redondear2(numero(informado.porcentaje_etapa))
        : referencia > 0
          ? redondear2((numero(porEtapaApi[etapa]?.cantidad ?? 0) / referencia) * 100)
          : 0;
      return {
        clave: etapa,
        etiqueta: ETIQUETAS_ETAPA[etapa],
        cantidad: cantidadPiezas,
        cantidadMaterial: cantidadM2,
        costoPerdido: numero(porEtapaApi[etapa]?.costo_perdido),
        referencia,
        porcentaje,
        base: 'meta' as const,
        superaMeta: porcentaje > metaPct,
        unidad: cantidadPiezas > 0 ? 'piezas' : 'unidad base',
      };
    }).filter((fila) => fila.cantidad !== 0 || fila.cantidadMaterial !== 0);

    const causas = new Map<string, string>();
    this.listaCausas().forEach((causa) => causas.set(causa.nombre, causa.nombre));
    topCausasApi.forEach((causa) => causas.set(causa.causa, causa.causa));

    const porCausa: FilaIndicador[] = [...new Set(detalle.map((fila) => fila.causa))]
      .map((nombre) => {
        const filas = detalle.filter((fila) => fila.causa === nombre);
        const cantidad = redondear4(
          filas.reduce((total, fila) => total + numero(fila.cantidad), 0),
        );
        return {
          clave: nombre,
          etiqueta: causas.get(nombre) ?? nombre,
          cantidad,
          cantidadMaterial: 0,
          costoPerdido: redondear2(
            filas.reduce((total, fila) => total + numero(fila.costo_perdido), 0),
          ),
          referencia: detalle.length,
          porcentaje: detalle.length > 0 ? redondear2((filas.length / detalle.length) * 100) : 0,
          base: 'participacion' as const,
          superaMeta: false,
          unidad: 'registros',
        };
      })
      .sort((a, b) => b.porcentaje - a.porcentaje);

    const porProducto = this.agruparDetalle(
      detalle.filter((fila) => fila.producto !== null),
      'producto',
      referenciaProducto,
      'piezas',
    );
    const porMaterial = this.agruparDetalle(
      detalle.filter((fila) => fila.material !== null),
      'material',
      referenciaMaterial,
      'unidad base',
    );

    const causasTop5: FilaIndicador[] = topCausasApi.map((causa) => {
      const filas = detalle.filter((fila) => fila.causa === causa.causa);
      return {
        clave: causa.causa,
        etiqueta: causas.get(causa.causa) ?? causa.causa,
        cantidad: numero(causa.cantidad),
        cantidadMaterial: 0,
        costoPerdido: redondear2(
          filas.reduce((total, fila) => total + numero(fila.costo_perdido), 0),
        ),
        referencia: filas.length,
        porcentaje:
          detalle.length > 0 ? redondear2((filas.length / detalle.length) * 100) : 0,
        base: 'participacion' as const,
        superaMeta: false,
        unidad: 'registros',
      };
    });

    const evolucion: FilaEvolucion[] = mesesDelPeriodo(periodo, 6).map((mes) => {
      const filas = detalle.filter((fila) => fila.fecha.startsWith(mes));
      const fecha = new Date(`${mes}-01T12:00:00`);
      return {
        mes,
        etiqueta: new Intl.DateTimeFormat('es-MX', { month: 'short' })
          .format(fecha)
          .replace('.', ''),
        cantidadProducto: redondear4(
          filas.reduce(
            (total, fila) => total + (fila.producto ? numero(fila.cantidad) : 0),
            0,
          ),
        ),
        cantidadMaterial: redondear4(
          filas.reduce(
            (total, fila) => total + (fila.material ? numero(fila.cantidad) : 0),
            0,
          ),
        ),
        costoPerdido: redondear2(
          filas.reduce((total, fila) => total + numero(fila.costo_perdido), 0),
        ),
      };
    });

    const costoPeriodo = redondear2(
      detalle
        .filter((fila) => fila.fecha.startsWith(periodo))
        .reduce((total, fila) => total + numero(fila.costo_perdido), 0),
    );

    const alertas: AlertaMerma[] = [];
    if (productoPct > metaPct || materialPct > metaPct) {
      alertas.push({
        id: 'general',
        ambito: 'general',
        etiqueta: 'MERMA_ALTA · merma acumulada',
        detalle: `Producto ${productoPct}% y materiales ${materialPct}% contra una meta menor a ${metaPct}%.`,
        porcentaje: Math.max(productoPct, materialPct),
      });
    }
    porEtapa.filter((fila) => fila.superaMeta).forEach((fila) => {
      alertas.push({
        id: `etapa-${fila.clave}`,
        ambito: 'etapa',
        etiqueta: `MERMA_ALTA · etapa ${fila.etiqueta}`,
        detalle: `${fila.cantidad + fila.cantidadMaterial} en merma sobre ${fila.referencia} de referencia (${fila.porcentaje}%).`,
        porcentaje: fila.porcentaje,
      });
    });
    porProducto.filter((fila) => fila.superaMeta).forEach((fila) => {
      alertas.push({
        id: `producto-${fila.clave}`,
        ambito: 'producto',
        etiqueta: `MERMA_ALTA · ${fila.clave}`,
        detalle: `${fila.cantidad} piezas en merma sobre ${fila.referencia} producidas (${fila.porcentaje}%).`,
        porcentaje: fila.porcentaje,
      });
    });

    return {
      metaPct,
      periodo,
      mermaProductoPct: productoPct,
      mermaMaterialPct: materialPct,
      referenciaProducto,
      referenciaMaterial,
      cantidadProducto,
      cantidadMaterial,
      costoPerdido: costo,
      costoPerdidoMes: costoPeriodo,
      // Los reversos compensan, pero no cuentan como registros analizados.
      totalRegistros: this.lista().length
        ? this.lista().filter((merma) => !merma.esReversion).length
        : this.total(),
      porEtapa,
      porCausa,
      porProducto,
      porMaterial,
      causasTop5,
      evolucion,
      alertas,
    };
  }

  private agruparDetalle(
    filas: DetalleIndicadorApi[],
    campo: 'producto' | 'material',
    referencia: number,
    unidad: string,
  ): FilaIndicador[] {
    const meta = numero(this.indicadoresApi()?.meta_pct);
    const claves = [...new Set(filas.map((fila) => fila[campo] as string))];
    return claves
      .map((clave) => {
        const delGrupo = filas.filter((fila) => fila[campo] === clave);
        const cantidad = redondear4(
          delGrupo.reduce((total, fila) => total + numero(fila.cantidad), 0),
        );
        const porcentaje = referencia > 0 ? redondear2((cantidad / referencia) * 100) : 0;
        return {
          clave,
          etiqueta: clave,
          cantidad,
          cantidadMaterial: 0,
          costoPerdido: redondear2(
            delGrupo.reduce((total, fila) => total + numero(fila.costo_perdido), 0),
          ),
          referencia,
          porcentaje,
          base: 'meta' as const,
          superaMeta: porcentaje > meta,
          unidad,
        };
      })
      .sort((a, b) => b.cantidad - a.cantidad);
  }

  private indicadoresVacios(): IndicadoresMerma {
    return {
      metaPct: META_MERMA_PCT,
      periodo: hoyISO().slice(0, 7),
      mermaProductoPct: 0,
      mermaMaterialPct: 0,
      referenciaProducto: 0,
      referenciaMaterial: 0,
      cantidadProducto: 0,
      cantidadMaterial: 0,
      costoPerdido: 0,
      costoPerdidoMes: 0,
      totalRegistros: 0,
      porEtapa: [],
      porCausa: [],
      porProducto: [],
      porMaterial: [],
      causasTop5: [],
      evolucion: [],
      alertas: [],
    };
  }
}
