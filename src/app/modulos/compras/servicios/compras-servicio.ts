import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, concatMap, forkJoin, from, map, of, tap } from 'rxjs';
import { ApiService, ValorParametro } from '../../../core/api/api.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { InventarioServicio } from '../../inventario/servicios/inventario-servicio';
import type { MaterialProveedor } from '../../proveedores/modelos/proveedor';
import { ProveedoresServicio } from '../../proveedores/servicios/proveedores-servicio';
import type {
  Cotizacion,
  DatosRecepcion,
  LineaCotizacion,
  LineaOrdenCompra,
  LineaRequisicion,
  MaterialCompra,
  OrdenCompra,
  Recepcion,
  Requisicion,
  ResultadoRecepcion,
} from '../modelos/compra';

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

interface RequisicionLineaApi {
  id: number;
  inventario_material_id: number;
  material: string;
  nombre_material: string;
  color: string;
  unidad_base: string;
  cantidad_base_faltante: string;
  cantidad_compra_sugerida: string;
  cantidad_compra_atendida: string;
}

interface RequisicionApi {
  id: number;
  folio: string;
  origen: string;
  orden_produccion_id: number | null;
  estado: string;
  prioridad: string;
  solicitada_por: string | number;
  fecha: string | null;
  notas: string | null;
  lineas: RequisicionLineaApi[];
}

interface CotizacionLineaApi {
  id: number;
  requisicion_linea_id: number;
  cantidad_compra: string;
  precio_unitario_compra: string;
  subtotal: string;
}

interface CotizacionApi {
  id: number;
  requisicion_id: number;
  proveedor_id: number;
  proveedor: string;
  fecha: string;
  vigencia_hasta: string | null;
  plazo_dias: number;
  estado: string;
  total: string;
  notas: string | null;
  lineas: CotizacionLineaApi[];
}

interface OrdenLineaApi {
  id: number;
  inventario_material_id: number;
  material: string;
  nombre_material: string;
  color: string;
  unidad_compra: string;
  cantidad_compra: string;
  precio_unitario_compra: string;
  subtotal: string;
  cantidad_base_aceptada: string;
}

interface OrdenApi {
  id: number;
  folio: string;
  proveedor_id: number;
  proveedor: string;
  requisicion_id: number | null;
  cotizacion_id: number | null;
  estado: string;
  fecha_emision: string | null;
  fecha_prometida: string | null;
  total: string;
  condiciones_pago: string | null;
  notas: string | null;
  creada_por: string | number;
  lineas: OrdenLineaApi[];
}

interface RecepcionApi {
  id: number;
  folio: string;
  orden_compra_id: number;
  fecha: string;
  recibida_por: string | number;
  documento_proveedor: string | null;
  notas: string | null;
  lineas: {
    id: number;
    orden_compra_linea_id: number;
    cantidad_base_medida: string;
    cantidad_base_aceptada: string;
    cantidad_base_rechazada: string;
    motivo_rechazo: string | null;
  }[];
}

interface ResultadoRecepcionApi {
  recepcion: RecepcionApi;
  orden_compra: { id: number; folio: string; estado: string };
}

function listarTodo<T>(
  api: ApiService,
  ruta: string,
  params: Record<string, ValorParametro> = {},
): Observable<T[]> {
  const porPagina = 100;
  const pedir = (pagina: number, previos: T[]): Observable<T[]> =>
    api
      .get<Pagina<T>>(ruta, { params: { ...params, pagina, por_pagina: porPagina } })
      .pipe(
        concatMap((respuesta) => {
          const items = [...previos, ...(respuesta.items ?? [])];
          if (respuesta.items.length === 0 || items.length >= (respuesta.total ?? 0)) {
            return of(items);
          }
          return pedir(pagina + 1, items);
        }),
      );
  return pedir(1, []);
}

function codigoColor(color: string | null): string {
  const normalizado = (color ?? '').trim().toLocaleLowerCase('es-MX');
  if (normalizado.startsWith('bl')) {
    return 'BL';
  }
  if (normalizado.startsWith('ne')) {
    return 'NG';
  }
  if (normalizado.startsWith('gr')) {
    return 'GR';
  }
  return 'NA';
}

/** M14 contra la API: Flask genera folios, lotes, mermas y movimientos. */
@Injectable({ providedIn: 'root' })
export class ComprasServicio {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStateService);
  private readonly proveedores = inject(ProveedoresServicio);
  private readonly inventario = inject(InventarioServicio);

  private readonly listaRequisiciones = signal<Requisicion[]>([]);
  private readonly listaCotizaciones = signal<Cotizacion[]>([]);
  private readonly listaOrdenes = signal<OrdenCompra[]>([]);
  private readonly listaRecepciones = signal<Recepcion[]>([]);
  private readonly listaMateriales = signal<MaterialCompra[]>([]);

  readonly requisiciones = this.listaRequisiciones.asReadonly();
  readonly cotizaciones = this.listaCotizaciones.asReadonly();
  readonly ordenes = this.listaOrdenes.asReadonly();
  readonly recepciones = this.listaRecepciones.asReadonly();
  readonly materiales = computed(() => this.listaMateriales().filter((material) => material.id > 0));
  readonly proveedoresDisponibles = computed(() =>
    this.proveedores.proveedores().filter((proveedor) => proveedor.estatus !== 'INACTIVO'),
  );
  readonly cargado = signal(false);

  constructor() {
    effect(() => {
      if (this.auth.usuario()?.rol === 'ADMIN' || this.auth.usuario()?.rol === 'OPERATIVO') {
        this.recargar().subscribe();
      }
    });
  }

  recargar(): Observable<void> {
    // Cotizaciones y órdenes son de Administrador: un Operativo solo registra recepciones.
    const esAdmin = this.auth.puede(['ADMIN']);
    return forkJoin({
      requisiciones: listarTodo<RequisicionApi>(this.api, '/requisiciones'),
      cotizaciones: esAdmin ? listarTodo<CotizacionApi>(this.api, '/cotizaciones') : of([]),
      ordenes: esAdmin ? listarTodo<OrdenApi>(this.api, '/ordenes-compra') : of([]),
    }).pipe(
      tap(({ requisiciones, cotizaciones, ordenes }) => {
        const materiales = this.materialesDeM15();
        this.listaMateriales.set(materiales);
        this.listaRequisiciones.set(requisiciones.map((fila) => this.adaptarRequisicion(fila)));
        this.listaCotizaciones.set(cotizaciones.map((fila) => this.adaptarCotizacion(fila)));
        this.listaOrdenes.set(ordenes.map((fila) => this.adaptarOrden(fila)));
      }),
      tap(() => this.cargado.set(true)),
      map(() => undefined),
    );
  }

  obtenerMaterial(id: number): MaterialCompra | undefined {
    return this.listaMateriales().find((material) => material.id === id);
  }

  proveedorNombre(id: number): string {
    return this.proveedores.obtenerPorId(id)?.nombreComercial ?? 'Proveedor no disponible';
  }

  condicionesProveedor(id: number): string {
    return this.proveedores.obtenerPorId(id)?.condicionesPago ?? 'Contado';
  }

  coberturaMaterial(materialId: number): (MaterialProveedor & { proveedorId: number })[] {
    const opciones: (MaterialProveedor & { proveedorId: number })[] = [];
    for (const proveedor of this.proveedores.proveedores()) {
      if (proveedor.estatus === 'INACTIVO') {
        continue;
      }
      for (const material of proveedor.materiales) {
        if (material.activo && material.materialId === materialId) {
          opciones.push({ ...material, proveedorId: proveedor.id });
        }
      }
    }
    return opciones;
  }

  cantidadPresentaciones(materialId: number, faltanteBase: number): number {
    const material = this.obtenerMaterial(materialId);
    if (!material || !(faltanteBase > 0)) {
      return 0;
    }
    return Math.max(material.minimoCompra, Math.ceil(faltanteBase / material.factorPresentacion));
  }

  basePresentaciones(materialId: number, presentaciones: number): number {
    const material = this.obtenerMaterial(materialId);
    return material ? redondear4(presentaciones * material.factorPresentacion) : 0;
  }

  obtenerRequisicion(id: number): Requisicion | undefined {
    return this.requisiciones().find((requisicion) => requisicion.id === id);
  }

  guardarRequisicion(datos: Requisicion): Observable<Requisicion> {
    const cuerpo = {
      origen: datos.origen,
      orden_produccion_id: this.idOrdenDeProduccion(datos.ordenProduccion),
      prioridad: datos.prioridad,
      notas: datos.notas,
      lineas: datos.lineas.map((linea) => ({
        inventario_material_id: this.inventarioMaterialId(linea.materialId, linea.color),
        cantidad_base_faltante: redondear4(linea.cantidadBaseFaltante),
      })),
    };
    const peticion =
      datos.id === 0
        ? this.api.post<RequisicionApi>('/requisiciones', cuerpo)
        : this.api.patch<RequisicionApi>(`/requisiciones/${datos.id}`, {
            prioridad: datos.prioridad,
            notas: datos.notas,
          });
    return peticion.pipe(
      concatMap((respuesta) => this.recargar().pipe(map(() => respuesta))),
      map((respuesta) => this.obtenerRequisicion(respuesta.id) as Requisicion),
    );
  }

  cancelarRequisicion(id: number): Observable<void> {
    return this.api.delete(`/requisiciones/${id}`).pipe(
      concatMap(() => this.recargar()),
      map(() => undefined),
    );
  }

  /** El contrato crea una cotización por proveedor; la UI mantiene el comparador. */
  generarCotizaciones(requisicionId: number): Observable<{ cantidad: number; conAlterno: boolean } | null> {
    const requisicion = this.obtenerRequisicion(requisicionId);
    if (!requisicion || requisicion.lineas.length === 0 || requisicion.estado === 'CANCELADA') {
      return of(null);
    }

    const porProveedor = new Map<number, { lineas: CotizacionLineaApi[]; plazo: number }>();
    let conAlterno = false;
    for (const lineaReq of requisicion.lineas) {
      const opciones = this.coberturaMaterial(lineaReq.materialId);
      conAlterno ||= opciones.length > 1;
      const seleccionadas = [
        ...opciones.filter((opcion) => opcion.esPrincipal).slice(0, 1),
        ...opciones.filter((opcion) => !opcion.esPrincipal).slice(0, 1),
      ];
      if (seleccionadas.length === 0) {
        seleccionadas.push(...opciones.slice(0, 1));
      }
      for (const opcion of seleccionadas) {
        const cantidad = Math.max(lineaReq.cantidadCompraSugerida, opcion.minimoCompra);
        const actual = porProveedor.get(opcion.proveedorId) ?? { lineas: [], plazo: opcion.plazoDias };
        actual.lineas.push({
          id: 0,
          requisicion_linea_id: lineaReq.id,
          cantidad_compra: String(redondear4(cantidad)),
          precio_unitario_compra: String(opcion.precioCompra),
          subtotal: String(redondear4(cantidad * opcion.precioCompra)),
        });
        actual.plazo = Math.min(actual.plazo, opcion.plazoDias);
        porProveedor.set(opcion.proveedorId, actual);
      }
    }
    if (porProveedor.size === 0) {
      return of(null);
    }

    return from([...porProveedor.entries()]).pipe(
      concatMap(([proveedorId, valor]) =>
        this.api
          .post('/requisiciones/' + requisicionId + '/cotizaciones', {
            proveedor_id: proveedorId,
            plazo_dias: valor.plazo,
            vigencia_hasta: null,
            notas: 'Cotización comparativa generada desde el carrito de compras.',
            lineas: valor.lineas.map((linea) => ({
              requisicion_linea_id: linea.requisicion_linea_id,
              cantidad_compra: linea.cantidad_compra,
              precio_unitario_compra: linea.precio_unitario_compra,
            })),
          })
          .pipe(
            // Un proveedor que no surte todos los materiales se omite del comparador.
            map(() => 1),
          ),
      ),
      concatMap(() => this.recargar()),
      map(() => ({
        cantidad: this.cotizaciones().filter((item) => item.requisicionId === requisicionId).length,
        conAlterno,
      })),
    );
  }

  elegirCotizacion(cotizacionId: number): Observable<OrdenCompra | null> {
    return this.api.post<OrdenApi>(`/cotizaciones/${cotizacionId}/elegir`, {}).pipe(
      concatMap((respuesta) => this.recargar().pipe(map(() => respuesta))),
      map((respuesta) => this.obtenerOrden(respuesta.id) ?? null),
    );
  }

  /** Compra urgente: orden directa al proveedor principal y emisión inmediata. */
  emitirOrdenDirecta(requisicionId: number): Observable<OrdenCompra | null> {
    const requisicion = this.obtenerRequisicion(requisicionId);
    if (!requisicion || requisicion.estado === 'CANCELADA') {
      return of(null);
    }
    const lineas: LineaOrdenCompra[] = [];
    let proveedorId = 0;
    for (const lineaReq of requisicion.lineas) {
      const opciones = this.coberturaMaterial(lineaReq.materialId);
      const opcion = opciones.find((item) => item.esPrincipal) ?? opciones[0];
      if (!opcion) {
        continue;
      }
      proveedorId ||= opcion.proveedorId;
      const cantidad = Math.max(lineaReq.cantidadCompraSugerida, opcion.minimoCompra);
      lineas.push({
        id: 0,
        materialId: lineaReq.materialId,
        cantidadCompra: cantidad,
        cantidadBasePedida: this.basePresentaciones(lineaReq.materialId, cantidad),
        precioUnitarioCompra: opcion.precioCompra,
        subtotal: redondear4(cantidad * opcion.precioCompra),
        cantidadBaseAceptada: 0,
      });
    }
    if (lineas.length === 0 || proveedorId === 0) {
      return of(null);
    }
    return this.api
      .post<OrdenApi>('/ordenes-compra', {
        proveedor_id: proveedorId,
        requisicion_id: requisicion.id,
        condiciones_pago: this.condicionesProveedor(proveedorId),
        notas: 'Orden directa al proveedor principal.',
        lineas: lineas.map((linea) => ({
          inventario_material_id: this.inventarioMaterialId(linea.materialId, null),
          cantidad_compra: linea.cantidadCompra,
          precio_unitario_compra: linea.precioUnitarioCompra,
        })),
      })
      .pipe(
        concatMap((orden) =>
          this.api
            .post<OrdenApi>(`/ordenes-compra/${orden.id}/emitir`, {})
            .pipe(map(() => orden)),
        ),
        concatMap((respuesta) => this.recargar().pipe(map(() => respuesta))),
        map((respuesta) => this.obtenerOrden(respuesta.id) ?? null),
      );
  }

  obtenerOrden(id: number): OrdenCompra | undefined {
    return this.ordenes().find((orden) => orden.id === id);
  }

  guardarOrden(orden: OrdenCompra): Observable<OrdenCompra | null> {
    const cuerpo = {
      proveedor_id: orden.proveedorId,
      requisicion_id: orden.requisicionId,
      condiciones_pago: orden.condicionesPago,
      notas: orden.notas,
      lineas: orden.lineas.map((linea) => ({
        inventario_material_id: this.inventarioMaterialId(linea.materialId, null),
        cantidad_compra: linea.cantidadCompra,
        precio_unitario_compra: linea.precioUnitarioCompra,
      })),
    };
    const peticion =
      orden.id === 0
        ? this.api.post<OrdenApi>('/ordenes-compra', cuerpo)
        : this.api.patch<OrdenApi>(`/ordenes-compra/${orden.id}`, {
            proveedor_id: orden.proveedorId,
            condiciones_pago: orden.condicionesPago,
            notas: orden.notas,
            lineas: cuerpo.lineas,
          });
    return peticion.pipe(
      concatMap((respuesta) => this.recargar().pipe(map(() => respuesta))),
      map((respuesta) => this.obtenerOrden(respuesta.id) ?? null),
    );
  }

  emitirOrden(id: number): Observable<void> {
    return this.api.post(`/ordenes-compra/${id}/emitir`, {}).pipe(
      concatMap(() => this.recargar()),
      map(() => undefined),
    );
  }

  cancelarOrden(id: number): Observable<void> {
    return this.api.post(`/ordenes-compra/${id}/cancelar`, { motivo: 'Cancelada desde compras' }).pipe(
      concatMap(() => this.recargar()),
      map(() => undefined),
    );
  }

  eliminarOrden(id: number): Observable<'eliminado' | 'no-permitido'> {
    const orden = this.obtenerOrden(id);
    if (!orden || orden.estado !== 'BORRADOR') {
      return of('no-permitido' as const);
    }
    return this.api.delete(`/ordenes-compra/${id}`).pipe(
      concatMap(() => this.recargar()),
      map(() => 'eliminado' as const),
    );
  }

  descargarOrdenPdf(id: number): Observable<Blob> {
    return this.api.getBlob(`/ordenes-compra/${id}/pdf`);
  }

  retrasada(orden: OrdenCompra): boolean {
    if (!orden.fechaPrometida || ['RECIBIDA', 'CANCELADA'].includes(orden.estado)) {
      return false;
    }
    return new Date(`${orden.fechaPrometida}T23:59:59`) < new Date();
  }

  /** POST /recepciones con Idempotency-Key generada aquí; Flask crea lotes y mermas. */
  registrarRecepcion(datos: DatosRecepcion): Observable<ResultadoRecepcion | null> {
    const orden = this.obtenerOrden(datos.ordenCompraId);
    if (!orden || ['BORRADOR', 'CANCELADA', 'RECIBIDA'].includes(orden.estado)) {
      return of(null);
    }
    return this.api
      .post<ResultadoRecepcionApi>(
        '/recepciones',
        {
          orden_compra_id: datos.ordenCompraId,
          documento_proveedor: datos.documentoProveedor.trim() || null,
          notas: datos.notas.trim() || null,
          lineas: datos.lineas.map((linea) => ({
            orden_compra_linea_id: linea.ordenCompraLineaId,
            cantidad_base_medida: redondear4(linea.cantidadBaseMedida),
            cantidad_base_aceptada: redondear4(linea.cantidadBaseAceptada),
            cantidad_base_rechazada: redondear4(linea.cantidadBaseRechazada),
            peso_kg: linea.pesoKg,
            ancho_cm: linea.anchoCm,
            largo_m: linea.largoM,
            motivo_rechazo: linea.motivoRechazo,
          })),
        },
        { idempotencyKey: this.nuevaClaveIdempotencia() },
      )
      .pipe(
        concatMap((respuesta) => this.recargar().pipe(map(() => respuesta))),
        map((respuesta) => {
          this.listaRecepciones.update((actuales) => [
            this.adaptarRecepcion(respuesta.recepcion),
            ...actuales.filter((item) => item.id !== respuesta.recepcion.id),
          ]);
          return {
            recepcion: this.adaptarRecepcion(respuesta.recepcion),
            estadoOrden: respuesta.orden_compra.estado as ResultadoRecepcion['estadoOrden'],
            lotes: [],
            mermas: [],
          };
        }),
      );
  }

  private nuevaClaveIdempotencia(): string {
    return globalThis.crypto?.randomUUID?.() ?? `rec-${Date.now()}-${Math.random()}`;
  }

  private materialesDeM15(): MaterialCompra[] {
    return this.inventario
      .materiales()
      .filter((material) => material.activo)
      .map((material) => {
        const cobertura = this.coberturaMaterial(material.id);
        return {
          id: material.id,
          codigo: material.codigo,
          nombre: material.nombre,
          categoria: material.categoria,
          color: null,
          unidadBase: material.unidadBase,
          presentacion: material.unidadCompra,
          unidadPresentacion: material.unidadCompra,
          factorPresentacion: material.factorCompraBase,
          minimoCompra: cobertura.reduce((minimo, linea) => Math.min(minimo, linea.minimoCompra), 1),
        };
      });
  }

  private idOrdenDeProduccion(texto: string | null): number | null {
    if (!texto) {
      return null;
    }
    const coincidencia = texto.match(/(\d+)\s*$/);
    return coincidencia ? Number(coincidencia[1]) : null;
  }

  private inventarioMaterialId(materialId: number, color: string | null): number {
    const codigo = codigoColor(color);
    const vistas = this.inventario.vistas();
    return (
      vistas.find(
        (vista) => vista.material.id === materialId && vista.color === codigo,
      )?.id ??
      vistas.find((vista) => vista.material.id === materialId)?.id ??
      0
    );
  }

  private materialIdDe(inventarioMaterialId: number): number {
    return (
      this.inventario.vistas().find((vista) => vista.id === inventarioMaterialId)?.material.id ?? 0
    );
  }

  private factorDe(inventarioMaterialId: number): number {
    return (
      this.inventario.vistas().find((vista) => vista.id === inventarioMaterialId)?.material
        .factorCompraBase ?? 1
    );
  }

  private adaptarRequisicion(fila: RequisicionApi): Requisicion {
    return {
      id: fila.id,
      folio: fila.folio,
      origen: fila.origen as Requisicion['origen'],
      ordenProduccion:
        fila.orden_produccion_id === null ? null : `OP-${fila.orden_produccion_id}`,
      fecha: fila.fecha ?? '',
      estado: fila.estado as Requisicion['estado'],
      prioridad: fila.prioridad as Requisicion['prioridad'],
      solicitadaPor: String(fila.solicitada_por ?? ''),
      notas: fila.notas,
      lineas: (fila.lineas ?? []).map(
        (linea): LineaRequisicion => ({
          id: linea.id,
          materialId: this.materialIdDe(linea.inventario_material_id),
          color: linea.color,
          cantidadBaseFaltante: Number(linea.cantidad_base_faltante),
          cantidadCompraSugerida: Number(linea.cantidad_compra_sugerida),
          cantidadCompraAtendida: Number(linea.cantidad_compra_atendida),
        }),
      ),
    };
  }

  private adaptarCotizacion(fila: CotizacionApi): Cotizacion {
    return {
      id: fila.id,
      folio: `COT-${fila.fecha ? new Date(fila.fecha).getFullYear() : new Date().getFullYear()}-${String(fila.id).padStart(4, '0')}`,
      requisicionId: fila.requisicion_id,
      proveedorId: fila.proveedor_id,
      fecha: fila.fecha,
      vigenciaHasta: fila.vigencia_hasta,
      plazoDias: Number(fila.plazo_dias),
      estado: fila.estado as Cotizacion['estado'],
      total: Number(fila.total),
      notas: fila.notas,
      lineas: (fila.lineas ?? []).map(
        (linea): LineaCotizacion => ({
          id: linea.id,
          requisicionLineaId: linea.requisicion_linea_id,
          cantidadCompra: Number(linea.cantidad_compra),
          precioUnitarioCompra: Number(linea.precio_unitario_compra),
          subtotal: Number(linea.subtotal),
        }),
      ),
    };
  }

  private adaptarOrden(fila: OrdenApi): OrdenCompra {
    return {
      id: fila.id,
      folio: fila.folio,
      proveedorId: fila.proveedor_id,
      requisicionId: fila.requisicion_id,
      cotizacionId: fila.cotizacion_id,
      estado: fila.estado as OrdenCompra['estado'],
      fechaEmision: fila.fecha_emision,
      fechaPrometida: fila.fecha_prometida,
      total: Number(fila.total),
      condicionesPago: fila.condiciones_pago ?? this.condicionesProveedor(fila.proveedor_id),
      notas: fila.notas,
      creadaPor: String(fila.creada_por ?? ''),
      lineas: (fila.lineas ?? []).map(
        (linea): LineaOrdenCompra => ({
          id: linea.id,
          materialId: this.materialIdDe(linea.inventario_material_id),
          cantidadCompra: Number(linea.cantidad_compra),
          cantidadBasePedida: redondear4(
            Number(linea.cantidad_compra) * this.factorDe(linea.inventario_material_id),
          ),
          precioUnitarioCompra: Number(linea.precio_unitario_compra),
          subtotal: Number(linea.subtotal),
          cantidadBaseAceptada: Number(linea.cantidad_base_aceptada),
        }),
      ),
    };
  }

  private adaptarRecepcion(fila: RecepcionApi): Recepcion {
    return {
      id: fila.id,
      folio: fila.folio,
      ordenCompraId: fila.orden_compra_id,
      fecha: fila.fecha,
      recibidaPor: String(fila.recibida_por ?? ''),
      documentoProveedor: fila.documento_proveedor,
      notas: fila.notas,
      lineas: (fila.lineas ?? []).map((linea) => ({
        id: linea.id,
        ordenCompraLineaId: linea.orden_compra_linea_id,
        pesoKg: null,
        anchoCm: null,
        largoM: null,
        cantidadBaseMedida: Number(linea.cantidad_base_medida),
        cantidadBaseAceptada: Number(linea.cantidad_base_aceptada),
        cantidadBaseRechazada: Number(linea.cantidad_base_rechazada),
        motivoRechazo: linea.motivo_rechazo,
      })),
    };
  }
}
