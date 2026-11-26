import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { mensajeError } from '../../../core/api/errores';
import type { PendienteProduccion } from '../../pedidos/modelos/pedido';
import type {
  CoberturaCompra,
  DatosNuevaOrden,
  EstadoMaterial,
  FilaPlanSugerido,
  FiltroTablero,
  LineaDictamen,
  MaterialOrden,
  MaterialOrdenVista,
  OpcionVariante,
  OrdenProduccion,
  OrdenVista,
  ResultadoAccion,
  ResultadoCrearOrden,
  ResultadoReserva,
  TonoSemaforo,
} from '../modelos/produccion';
import { ETIQUETAS_ESTADO, ETIQUETAS_ORIGEN, ETIQUETAS_TONO } from '../modelos/produccion';

export function redondear4(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10000) / 10000;
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const TOLERANCIA = 0.0001;
const ESTADOS_CERRADOS: OrdenProduccion['estado'][] = ['CERRADA', 'CANCELADA'];

const TALLAS: Record<string, string> = {
  CH: 'Chica',
  MD: 'Mediana',
  GD: 'Grande',
  UN: 'Única',
};

const COLORES: Record<string, string> = {
  BL: 'Blanco',
  NG: 'Negro',
  GR: 'Gris',
  NA: 'No aplica',
};

function numero(valor: unknown): number {
  const resultado = Number(valor ?? 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

function nombreTalla(codigo: string): string {
  return TALLAS[codigo] ?? codigo;
}

function nombreColor(codigo: string): string {
  return COLORES[codigo] ?? codigo;
}

function colorDeSku(sku: string): string {
  return nombreColor(sku.split('-')[2] ?? 'NA');
}

function nombreProductoDeSku(sku: string): string {
  return sku.split('-')[0] || 'Prenda UNIQUE';
}

interface PaginaApi<T> {
  items: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

interface ResumenOrdenApi {
  id: number;
  folio: string;
  origen: OrdenProduccion['origen'];
  estado: OrdenProduccion['estado'];
  semaforo: TonoSemaforo;
  fecha_requerida: string | null;
  iniciada_en: string | null;
  cerrada_en: string | null;
  total_planeado: number;
  total_aprobado: number;
  total_merma: number;
  total_reproceso: number;
  materiales: number;
  creada_por: number | string | null;
  notas: string | null;
}

interface LineaOrdenApi {
  id: number;
  variante_id: number;
  sku: string;
  producto: string;
  receta_id: number;
  cantidad_planeada: number;
  cantidad_aprobada: number;
  cantidad_merma: number;
  cantidad_reproceso: number;
}

interface MaterialOrdenApi {
  id: number;
  inventario_material_id: number;
  material_codigo: string;
  material_nombre: string;
  color_codigo: string | null;
  unidad_base: string;
  cantidad_requerida: string;
  cantidad_reservada: string;
  cantidad_consumida: string;
  cantidad_faltante: string;
  estado: EstadoMaterial;
}

interface PedidoVinculoApi {
  pedido_id: number;
  pedido_estado: string;
  sku: string;
  cantidad: number;
}

interface RevisionOrdenApi {
  id: number;
  orden_linea_id: number;
  fecha: string | null;
  cantidad_revisada: number;
  cantidad_aprobada: number;
  cantidad_reproceso: number;
  cantidad_merma: number;
  observaciones: string | null;
}

type DetalleOrdenApi = Omit<ResumenOrdenApi, 'materiales'> & {
  lineas: LineaOrdenApi[];
  materiales: MaterialOrdenApi[];
  pedidos: PedidoVinculoApi[];
  revisiones: RevisionOrdenApi[];
};

type OrdenInterna = OrdenProduccion & {
  pedidosApi?: PedidoVinculoApi[];
  revisionesApi?: RevisionOrdenApi[];
};

interface CatalogoApi {
  id: number;
  nombre: string;
  variantes: { id: number; sku: string; talla: string; color: string }[];
}

interface InventarioMaterialApi {
  id: number;
  material_id: number;
  color_codigo: string | null;
  disponible: string;
}

interface PlanSugeridoApi {
  variante_id: number;
  sku: string;
  disponible: string;
  stock_minimo: number;
  pendiente_pedidos: number;
  produccion_en_curso: number;
  cantidad_sugerida: number;
}

interface ReservaApi {
  inventario_material_id: number;
  reservada: string;
  estado: EstadoMaterial;
}

interface RequisicionApi {
  id: number;
  folio: string;
  estado: string;
}

interface SolicitudCompraApi {
  requisicion: RequisicionApi;
  duplicada: boolean;
}

/** Estado de M16 alimentado por los endpoints reales de Flask bajo /api/v1. */
@Injectable({ providedIn: 'root' })
export class ProduccionServicio {
  private readonly api = inject(ApiService);

  private readonly lista = signal<OrdenInterna[]>([]);
  private readonly planes = signal<FilaPlanSugerido[]>([]);
  private readonly opcionesVariantes = signal<OpcionVariante[]>([]);
  private readonly disponiblesMateriales = signal<Map<number, number>>(new Map());

  readonly cargado = signal(false);
  readonly ordenes = this.lista.asReadonly();

  readonly vistas = computed<OrdenVista[]>(() => this.lista().map((orden) => this.proyectar(orden)));

  readonly revisiones = computed(() =>
    this.lista().flatMap((orden) =>
      (orden.revisionesApi ?? []).map((revision) => {
        const sku =
          orden.lineas.find((linea) => linea.id === revision.orden_linea_id)?.sku ?? '';
        const linea: LineaDictamen = {
          lineaId: revision.orden_linea_id,
          sku,
          medidasOk: true,
          costurasOk: true,
          bordadoOk: true,
          etiquetasOk: true,
          cantidadRevisada: revision.cantidad_revisada,
          cantidadAprobada: revision.cantidad_aprobada,
          cantidadReproceso: revision.cantidad_reproceso,
          cantidadMerma: revision.cantidad_merma,
          causaMerma: revision.observaciones ?? '',
          etapaMerma: 'ACABADOS',
        };
        return {
          id: revision.id,
          folio: `REV-${revision.id}`,
          ordenId: orden.id,
          ordenFolio: orden.folio,
          fecha: revision.fecha ?? '',
          revisadaPor: 'Registro de calidad',
          lineas: [linea],
        };
      }),
    ),
  );

  constructor() {
    this.recargar().subscribe({ error: () => this.cargado.set(true) });
  }

  recargar(): Observable<void> {
    const paginaVacia = <T>(): PaginaApi<T> => ({
      items: [],
      total: 0,
      pagina: 1,
      por_pagina: 100,
    });

    return forkJoin({
      ordenes: this.api.get<PaginaApi<ResumenOrdenApi>>('/produccion/ordenes', {
        params: { por_pagina: 100 },
      }),
      planes: this.api
        .get<PaginaApi<PlanSugeridoApi>>('/produccion/plan-sugerido', {
          params: { por_pagina: 100 },
        })
        .pipe(catchError(() => of(paginaVacia<PlanSugeridoApi>()))),
      catalogo: this.api.get<CatalogoApi[]>('/catalogo').pipe(catchError(() => of([]))),
      inventario: this.api
        .get<PaginaApi<InventarioMaterialApi>>('/inventario/material', {
          params: { por_pagina: 100 },
        })
        .pipe(catchError(() => of(paginaVacia<InventarioMaterialApi>()))),
    }).pipe(
      switchMap(({ ordenes, planes, catalogo, inventario }) => {
        const detalles$ = ordenes.items.length
          ? forkJoin(ordenes.items.map((resumen) => this.cargarDetalle(resumen)))
          : of([] as OrdenInterna[]);

        return detalles$.pipe(
          map((detalles) => {
            const disponibles = new Map<number, number>();
            inventario.items.forEach((fila) => disponibles.set(fila.id, numero(fila.disponible)));
            this.disponiblesMateriales.set(disponibles);

            const opciones: OpcionVariante[] = catalogo.flatMap((producto) =>
              producto.variantes.map((variante) => ({
                varianteId: variante.id,
                sku: variante.sku,
                nombreProducto: producto.nombre,
                talla: nombreTalla(variante.talla),
                color: nombreColor(variante.color),
                origen: 'M10' as const,
              })),
            );
            this.opcionesVariantes.set(
              [...opciones].sort((a, b) => a.sku.localeCompare(b.sku, 'es-MX')),
            );

            this.lista.set(detalles);
            this.planes.set(this.adaptarPlanes(planes.items, catalogo, detalles));
          }),
        );
      }),
      tap(() => this.cargado.set(true)),
      catchError((error: unknown) => {
        this.cargado.set(true);
        return throwError(() => error);
      }),
    );
  }

  private recargarSilenciosamente(): void {
    this.recargar().subscribe({ error: () => undefined });
  }

  private cargarDetalle(resumen: ResumenOrdenApi): Observable<OrdenInterna> {
    return this.api
      .get<DetalleOrdenApi>(`/produccion/ordenes/${resumen.id}`)
      .pipe(
        map((detalle) => this.adaptarOrden(detalle)),
        catchError(() => of(this.adaptarOrden(resumen))),
      );
  }

  private adaptarOrden(datos: ResumenOrdenApi | DetalleOrdenApi): OrdenInterna {
    const lineas = 'lineas' in datos ? (datos.lineas ?? []) : [];
    const materiales = 'materiales' in datos && Array.isArray(datos.materiales) ? datos.materiales : [];
    const pedidos = 'pedidos' in datos ? (datos.pedidos ?? []) : [];
    const revisiones = 'revisiones' in datos ? (datos.revisiones ?? []) : [];

    return {
      id: datos.id,
      folio: datos.folio,
      origen: datos.origen,
      estado: datos.estado,
      semaforo: datos.semaforo,
      fechaRequerida: datos.fecha_requerida,
      iniciadaEn: datos.iniciada_en,
      cerradaEn: datos.cerrada_en,
      creadaPor: String(datos.creada_por ?? ''),
      notas: datos.notas,
      lineas: lineas.map((linea) => ({
        id: linea.id,
        sku: linea.sku,
        nombreProducto: linea.producto || nombreProductoDeSku(linea.sku),
        talla: nombreTalla(linea.sku.split('-')[1] ?? 'UN'),
        color: colorDeSku(linea.sku),
        cantidadPlaneada: numero(linea.cantidad_planeada),
        cantidadAprobada: numero(linea.cantidad_aprobada),
        cantidadMerma: numero(linea.cantidad_merma),
        cantidadReproceso: numero(linea.cantidad_reproceso),
      })),
      materiales: materiales.map((material) => ({
        id: material.id,
        materialId: material.inventario_material_id,
        nombreMaterial: material.material_nombre || material.material_codigo,
        color: nombreColor(material.color_codigo ?? 'NA'),
        unidadBase: material.unidad_base,
        cantidadRequerida: numero(material.cantidad_requerida),
        cantidadReservada: numero(material.cantidad_reservada),
        cantidadConsumida: numero(material.cantidad_consumida),
      })),
      pedidosApi: pedidos,
      revisionesApi: revisiones,
    };
  }

  private adaptarPlanes(
    filas: PlanSugeridoApi[],
    catalogo: CatalogoApi[],
    ordenes: OrdenInterna[],
  ): FilaPlanSugerido[] {
    const variantes = new Map(
      catalogo.flatMap((producto) =>
        producto.variantes.map(
          (variante): [string, { nombre: string; talla: string; color: string }] => [
            variante.sku,
            {
              nombre: producto.nombre,
              talla: nombreTalla(variante.talla),
              color: nombreColor(variante.color),
            },
          ],
        ),
      ),
    );
    const abiertas = ordenes.filter((orden) => !ESTADOS_CERRADOS.includes(orden.estado));

    return filas.map((fila) => {
      const referencia = variantes.get(fila.sku);
      const pendienteNoCubierto = redondear4(
        Math.max(0, fila.pendiente_pedidos - fila.produccion_en_curso - numero(fila.disponible)),
      );
      const abierta = abiertas.find((orden) => orden.lineas.some((linea) => linea.sku === fila.sku));
      return {
        sku: fila.sku,
        nombreProducto: referencia?.nombre ?? nombreProductoDeSku(fila.sku),
        talla: referencia?.talla ?? nombreTalla(fila.sku.split('-')[1] ?? 'UN'),
        color: referencia?.color ?? colorDeSku(fila.sku),
        disponible: numero(fila.disponible),
        minimo: numero(fila.stock_minimo),
        pendientePedidos: numero(fila.pendiente_pedidos),
        pedidos: [],
        produccionEnCurso: numero(fila.produccion_en_curso),
        pendienteNoCubierto,
        cantidadReposicion: redondear4(
          Math.max(0, numero(fila.cantidad_sugerida) - pendienteNoCubierto),
        ),
        cantidadSugerida: numero(fila.cantidad_sugerida),
        ordenAbiertaFolio: abierta?.folio ?? null,
        varianteId: fila.variante_id,
      };
    });
  }

  private proyectar(orden: OrdenInterna): OrdenVista {
    const materiales = orden.materiales.map((material) =>
      this.proyectarMaterial(material, orden.semaforo),
    );
    const completos = materiales.filter(
      (material) => material.estadoMaterial === 'COMPLETO',
    ).length;
    const faltantes = materiales.filter((material) => material.faltante > TOLERANCIA);
    const vencida =
      orden.fechaRequerida !== null &&
      orden.fechaRequerida < hoyISO() &&
      !ESTADOS_CERRADOS.includes(orden.estado);

    let motivoSemaforo = 'Todos los materiales están cubiertos y la orden va en tiempo.';
    if (orden.estado === 'CANCELADA') {
      motivoSemaforo = 'La orden fue cancelada; no debe reanudarse sin una orden nueva.';
    } else if (orden.semaforo === 'ROJO') {
      motivoSemaforo =
        faltantes.length > 0
          ? 'Falta material sin cobertura vigente o con compra retrasada.'
          : 'La fecha requerida ya pasó o la orden presenta una condición crítica.';
    } else if (vencida) {
      motivoSemaforo = 'Venció la fecha requerida sin que la orden se cerrara.';
    } else if (faltantes.length > 0) {
      motivoSemaforo = 'Falta material, pero existe cobertura de compra vigente.';
    }

    const unidadesPlaneadas = orden.lineas.reduce(
      (suma, linea) => suma + linea.cantidadPlaneada,
      0,
    );
    const unidadesAprobadas = orden.lineas.reduce(
      (suma, linea) => suma + linea.cantidadAprobada,
      0,
    );
    const unidadesMerma = orden.lineas.reduce((suma, linea) => suma + linea.cantidadMerma, 0);

    return {
      ...orden,
      materiales,
      materialesCompletos: completos,
      vencida,
      semaforo: orden.semaforo,
      motivoSemaforo,
      unidadesPlaneadas,
      unidadesAprobadas,
      unidadesMerma,
      cumplimientoPct:
        unidadesPlaneadas > 0 ? redondear4((unidadesAprobadas / unidadesPlaneadas) * 100) : 0,
      mermaRealPct:
        unidadesAprobadas + unidadesMerma > 0
          ? redondear4((unidadesMerma / (unidadesAprobadas + unidadesMerma)) * 100)
          : 0,
    };
  }

  private proyectarMaterial(material: MaterialOrden, semaforoOrden: TonoSemaforo): MaterialOrdenVista {
    const disponibleM15 = this.disponiblesMateriales().get(material.materialId) ?? 0;
    const faltante = redondear4(
      Math.max(
        0,
        material.cantidadRequerida -
          material.cantidadReservada -
          material.cantidadConsumida,
      ),
    );

    const estadoMaterial: EstadoMaterial =
      faltante <= TOLERANCIA
        ? 'COMPLETO'
        : material.cantidadReservada + material.cantidadConsumida > TOLERANCIA
          ? 'PARCIAL'
          : 'FALTANTE';

    let cobertura: CoberturaCompra = 'NINGUNA';
    let etiquetaCobertura = 'No requerida';
    if (faltante > TOLERANCIA) {
      cobertura = semaforoOrden === 'AMBAR' ? 'REQUISICION' : 'NINGUNA';
      etiquetaCobertura =
        cobertura === 'REQUISICION'
          ? 'Cobertura de compra vigente'
          : 'Sin cobertura de compra';
    }

    const semaforo: TonoSemaforo =
      estadoMaterial === 'COMPLETO'
        ? 'VERDE'
        : semaforoOrden === 'AMBAR'
          ? 'AMBAR'
          : 'ROJO';

    return {
      ...material,
      disponibleM15: redondear4(disponibleM15),
      faltante,
      estadoMaterial,
      semaforo,
      cobertura,
      etiquetaCobertura,
    };
  }

  vistaPorId(id: number): OrdenVista | undefined {
    return this.vistas().find((orden) => orden.id === id);
  }

  filtrar(tab: FiltroTablero, texto: string): OrdenVista[] {
    const busqueda = texto.trim().toLocaleLowerCase('es-MX');
    return this.vistas().filter((orden) => {
      switch (tab) {
        case 'ROJAS':
          if (orden.semaforo !== 'ROJO') return false;
          break;
        case 'AMBAR':
          if (orden.semaforo !== 'AMBAR') return false;
          break;
        case 'VERDES':
          if (orden.semaforo !== 'VERDE') return false;
          break;
        case 'EN_PROCESO':
          if (orden.estado !== 'EN_PROCESO') return false;
          break;
        case 'EN_REVISION':
          if (orden.estado !== 'EN_REVISION') return false;
          break;
        case 'CERRADAS':
          if (orden.estado !== 'CERRADA') return false;
          break;
        case 'TODAS':
          break;
      }

      if (busqueda === '') return true;
      return [
        orden.folio,
        ETIQUETAS_ORIGEN[orden.origen],
        ETIQUETAS_ESTADO[orden.estado],
        ETIQUETAS_TONO[orden.semaforo],
        ...orden.lineas.map((linea) => linea.sku),
      ]
        .join(' ')
        .toLocaleLowerCase('es-MX')
        .includes(busqueda);
    });
  }

  indicadores() {
    const vistas = this.vistas();
    const vigentes = vistas.filter((orden) => !ESTADOS_CERRADOS.includes(orden.estado));
    const consideradas = vistas.filter((orden) => orden.estado !== 'CANCELADA');
    const planeadas = consideradas.reduce((suma, orden) => suma + orden.unidadesPlaneadas, 0);
    const aprobadas = consideradas.reduce((suma, orden) => suma + orden.unidadesAprobadas, 0);
    const mermas = consideradas.reduce((suma, orden) => suma + orden.unidadesMerma, 0);

    return {
      abiertas: vigentes.length,
      rojas: vigentes.filter((orden) => orden.semaforo === 'ROJO').length,
      cumplimientoPct: planeadas > 0 ? redondear4((aprobadas / planeadas) * 100) : 0,
      mermaRealPct: aprobadas + mermas > 0 ? redondear4((mermas / (aprobadas + mermas)) * 100) : 0,
    };
  }

  variantesDisponibles(): OpcionVariante[] {
    return this.opcionesVariantes();
  }

  pedidosDeOrden(orden: OrdenVista): PendienteProduccion[] {
    const interna = this.lista().find((item) => item.id === orden.id);
    const skus = new Set(orden.lineas.map((linea) => linea.sku));
    return (interna?.pedidosApi ?? [])
      .filter((pedido) => skus.has(pedido.sku))
      .map((pedido) => ({
        sku: pedido.sku,
        nombreProducto: nombreProductoDeSku(pedido.sku),
        talla: nombreTalla(pedido.sku.split('-')[1] ?? 'UN'),
        color: colorDeSku(pedido.sku),
        demanda: pedido.cantidad,
        pedidos: [`#${pedido.pedido_id}`],
        ordenFolio: orden.folio,
        fechaEstimada: orden.fechaRequerida,
      }));
  }

  faltantesDeOrden(id: number) {
    const orden = this.vistaPorId(id);
    if (!orden) {
      return [];
    }
    return orden.materiales
      .filter((material) => material.faltante > TOLERANCIA)
      .map((material) => ({
        materialId: material.materialId,
        nombreMaterial: material.nombreMaterial,
        color: material.color,
        unidadBase: material.unidadBase,
        faltante: material.faltante,
        tieneRequisicion: material.cobertura === 'REQUISICION',
        tieneOrdenCompra: false,
        ordenRetrasada: material.cobertura === 'RETRASADA',
      }));
  }

  planSugerido(): FilaPlanSugerido[] {
    return this.planes();
  }

  ordenesDisponibles(): { id: number; folio: string }[] {
    return this.lista()
      .map((orden) => ({ id: orden.id, folio: orden.folio }))
      .sort((a, b) => b.folio.localeCompare(a.folio, 'es-MX'));
  }

  crearOrden(
    datos: DatosNuevaOrden,
    _origen?: OrdenProduccion['origen'],
  ): Observable<ResultadoCrearOrden> {
    const lineasValidas = datos.lineas.filter(
      (linea) => Number.isInteger(linea.cantidad) && linea.cantidad > 0 && linea.varianteId > 0,
    );
    if (lineasValidas.length === 0) {
      return of({
        ok: false,
        mensaje: 'Agrega al menos una variante activa con cantidad entera mayor a cero.',
      });
    }

    const cuerpo = {
      lineas: lineasValidas.map((linea) => ({
        variante_id: linea.varianteId,
        cantidad: linea.cantidad,
      })),
      fecha_requerida: datos.fechaRequerida || null,
      notas: datos.notas.trim() === '' ? null : datos.notas.trim(),
    };

    return this.api.post<DetalleOrdenApi>('/produccion/ordenes', cuerpo).pipe(
      map((respuesta) => {
        const orden = this.adaptarOrden(respuesta);
        this.lista.update((actuales) => [orden, ...actuales.filter((item) => item.id !== orden.id)]);
        this.recargarSilenciosamente();
        return {
          ok: true,
          mensaje: `Orden ${orden.folio} creada en estado ${orden.estado}.`,
          folio: orden.folio,
        };
      }),
      catchError((error: unknown) =>
        of({ ok: false, mensaje: mensajeError(error, 'No fue posible crear la orden.') }),
      ),
    );
  }

  reservar(id: number): Observable<ResultadoReserva> {
    return this.api.post<{ orden: DetalleOrdenApi; reservas: ReservaApi[] }>(
      `/produccion/ordenes/${id}/reservar`,
      {},
    ).pipe(
      map((respuesta) => {
        this.actualizarDesdeDetalle(respuesta.orden);
        const completa = respuesta.reservas.filter((item) => item.estado === 'COMPLETO').length;
        return {
          ok: true,
          mensaje:
            reservasTexto(respuesta.reservas, completa) ||
            `Reserva registrada en ${respuesta.orden.folio}.`,
          materialesReservados: respuesta.reservas.filter((item) => numero(item.reservada) > 0)
            .length,
          materialesCompletos: completa,
        };
      }),
      catchError((error: unknown) =>
        of({
          ok: false,
          mensaje: mensajeError(error, 'No fue posible reservar los materiales.'),
          materialesReservados: 0,
          materialesCompletos: 0,
        }),
      ),
    );
  }

  solicitarCompraAccion(id: number): Observable<ResultadoAccion> {
    return this.api
      .post<SolicitudCompraApi>(`/produccion/ordenes/${id}/solicitar-compra`, {})
      .pipe(
        map((respuesta) => ({
          ok: true,
          mensaje: respuesta.duplicada
            ? `Ya existía la requisición ${respuesta.requisicion.folio}; no se duplicaron faltantes.`
            : `Requisición ${respuesta.requisicion.folio} creada con los faltantes de la orden.`,
        })),
        tap(() => this.recargarSilenciosamente()),
        catchError((error: unknown) =>
          of({ ok: false, mensaje: mensajeError(error, 'No fue posible crear la requisición.') }),
        ),
      );
  }

  iniciar(id: number): Observable<ResultadoAccion> {
    return this.api
      .post<{ orden: DetalleOrdenApi }>(`/produccion/ordenes/${id}/iniciar`, {}, {
        idempotencyKey: this.nuevaClaveIdempotencia(),
      })
      .pipe(
        map((respuesta) => {
          this.actualizarDesdeDetalle(respuesta.orden);
          return {
            ok: true,
            mensaje: `Producción iniciada en ${respuesta.orden.folio}; consumo PEPS registrado.`,
          };
        }),
        catchError((error: unknown) =>
          of({ ok: false, mensaje: mensajeError(error, 'No fue posible iniciar la producción.') }),
        ),
      );
  }

  enviarRevision(id: number, notas?: string): Observable<ResultadoAccion> {
    return this.api
      .post<DetalleOrdenApi>(`/produccion/ordenes/${id}/revision`, {
        notas: notas?.trim() || null,
      })
      .pipe(
        map((respuesta) => {
          this.actualizarDesdeDetalle(respuesta);
          return { ok: true, mensaje: `Orden ${respuesta.folio} enviada a revisión de calidad.` };
        }),
        catchError((error: unknown) =>
          of({ ok: false, mensaje: mensajeError(error, 'No fue posible enviar a revisión.') }),
        ),
      );
  }

  dictaminar(id: number, lineas: LineaDictamen[]): Observable<ResultadoAccion> {
    if (lineas.length === 0) {
      return of({ ok: false, mensaje: 'Captura el dictamen de al menos una línea.' });
    }
    for (const linea of lineas) {
      const total = linea.cantidadAprobada + linea.cantidadReproceso + linea.cantidadMerma;
      if (total !== linea.cantidadRevisada) {
        return of({
          ok: false,
          mensaje: `En ${linea.sku}, aprobadas + reproceso + merma deben igualar la cantidad revisada.`,
        });
      }
      if (
        linea.cantidadAprobada > 0 &&
        (!linea.medidasOk || !linea.costurasOk || !linea.bordadoOk || !linea.etiquetasOk)
      ) {
        return of({
          ok: false,
          mensaje: `Completa la verificación de ${linea.sku} antes de aprobar unidades.`,
        });
      }
    }

    const cuerpo = {
      lineas: lineas.map((linea) => ({
        orden_linea_id: linea.lineaId,
        cantidad_revisada: linea.cantidadRevisada,
        cantidad_aprobada: linea.cantidadAprobada,
        cantidad_reproceso: linea.cantidadReproceso,
        cantidad_merma: linea.cantidadMerma,
        medidas_ok: linea.medidasOk,
        costuras_ok: linea.costurasOk,
        bordado_ok: linea.bordadoOk,
        etiquetas_ok: linea.etiquetasOk,
        observaciones: linea.causaMerma.trim() === '' ? null : linea.causaMerma.trim(),
        etapa_merma: linea.etapaMerma,
      })),
    };

    return this.api.post<DetalleOrdenApi>(`/produccion/ordenes/${id}/dictamen`, cuerpo).pipe(
      map((respuesta) => {
        this.actualizarDesdeDetalle(respuesta);
        return {
          ok: true,
          mensaje: `Dictamen registrado en ${respuesta.folio}. Estado: ${respuesta.estado}.`,
        };
      }),
      tap(() => this.recargarSilenciosamente()),
      catchError((error: unknown) =>
        of({ ok: false, mensaje: mensajeError(error, 'No fue posible registrar el dictamen.') }),
      ),
    );
  }

  cancelar(id: number, motivo = 'Cancelación solicitada desde el tablero'): Observable<ResultadoAccion> {
    if (motivo.trim().length < 3) {
      return of({ ok: false, mensaje: 'Indica el motivo de la cancelación.' });
    }
    return this.api
      .post<DetalleOrdenApi>(`/produccion/ordenes/${id}/cancelar`, { motivo: motivo.trim() })
      .pipe(
        map((respuesta) => {
          this.actualizarDesdeDetalle(respuesta);
          return { ok: true, mensaje: `Orden ${respuesta.folio} cancelada.` };
        }),
        catchError((error: unknown) =>
          of({ ok: false, mensaje: mensajeError(error, 'No fue posible cancelar la orden.') }),
        ),
      );
  }

  private actualizarDesdeDetalle(detalle: DetalleOrdenApi): void {
    const actualizado = this.adaptarOrden(detalle);
    this.lista.update((actuales) =>
      actuales.map((orden) => (orden.id === actualizado.id ? actualizado : orden)),
    );
  }

  private nuevaClaveIdempotencia(): string {
    return globalThis.crypto?.randomUUID?.() ?? `prod-${Date.now()}-${Math.random()}`;
  }
}

function reservasTexto(reservas: ReservaApi[], completos: number): string {
  const tomadas = reservas.filter((item) => numero(item.reservada) > 0).length;
  if (tomadas === 0) {
    return 'No había material disponible para reservar; revisa la cobertura de compra.';
  }
  return completos === reservas.length
    ? `Materiales completos (${completos}/${reservas.length}). La orden pasó a LISTA.`
    : `Se reservaron ${tomadas} material(es); faltan ${reservas.length - completos} por cubrir.`;
}
