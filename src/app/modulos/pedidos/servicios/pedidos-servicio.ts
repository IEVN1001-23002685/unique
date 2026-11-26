import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { mensajeError } from '../../../core/api/errores';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import type {
  EstadoPedido,
  EventoPedido,
  LineaPedido,
  Pedido,
  PendienteProduccion,
  PrioridadPedido,
  TonoSemaforo,
} from '../modelos/pedido';

const dos = (valor: number): string => String(valor).padStart(2, '0');

function fechaAhoraIso(): string {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:00`;
}

/** Umbrales propuestos en §8.2, editables en M22. Horas en el estado actual. */
export const UMBRALES_ESTADO: Partial<Record<EstadoPedido, number>> = {
  RECIBIDO: 2,
  CONFIRMADO: 24,
  EN_PRODUCCION: 168,
  EN_PREPARACION: 24,
  LISTO_ENVIO: 24,
  EN_REPARTO: 24,
};

export const ETIQUETAS_ESTADO: Record<EstadoPedido, string> = {
  RECIBIDO: 'Recibido',
  CONFIRMADO: 'Confirmado',
  EN_PRODUCCION: 'En producción',
  EN_PREPARACION: 'En preparación',
  LISTO_ENVIO: 'Listo para envío',
  EN_REPARTO: 'En reparto',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const ESTADOS_TABLERO: EstadoPedido[] = [
  'RECIBIDO',
  'CONFIRMADO',
  'EN_PRODUCCION',
  'EN_PREPARACION',
  'LISTO_ENVIO',
  'EN_REPARTO',
];

export interface ResultadoPedido {
  ok: boolean;
  mensaje: string;
  pedido?: Pedido;
}

interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

interface PedidoResumenApi {
  id: number;
  folio: string;
  cliente: { nombre?: string; apellidos?: string };
  estado: string;
  estado_desde: string;
  prioridad: string;
  semaforo: string;
  articulos: number;
  total: string;
  guia: string | null;
}

interface PedidoDetalleApi {
  id: number;
  folio: string;
  fecha: string;
  estado: string;
  estado_desde: string;
  cancelado_en?: string | null;
  motivo_cancelacion?: string | null;
  cancelado_por?: string | null;
  fecha_promesa?: string | null;
  prioridad: string;
  estado_pago: string;
  cliente?: { nombre?: string; apellidos?: string };
  venta_id?: number;
  guia?: string | null;
  repartidor?: { nombre?: string } | null;
  articulos?: Array<{
    id: number;
    sku: string;
    nombre_producto: string;
    talla: string;
    color: string;
    cantidad: number;
    cant_reservada: number;
    cant_pendiente: number;
    cant_preparada?: number;
    orden_produccion_folio?: string | null;
    fecha_estimada?: string | null;
    precio_unitario: string;
    subtotal: string;
  }>;
  eventos?: Array<{
    estado: string;
    descripcion: string;
    fecha: string;
    usuario?: string | null;
    visible_cliente: boolean;
  }>;
  ordenes?: Array<{ folio: string; cantidad: number }>;
  preparacion?: { id: number; estado: string } | null;
  entrega?: { id: number; folio: string; estado: string; intento: number } | null;
}

interface PendienteApi {
  variante_id: number;
  sku: string;
  orden_id: number;
  orden_folio: string;
  demanda: number;
  fecha_estimada: string | null;
  semaforo: string;
}

function nombreCliente(cliente: PedidoResumenApi['cliente'] | undefined): string {
  return [cliente?.nombre, cliente?.apellidos].filter(Boolean).join(' ').trim() || 'Cliente';
}

const PRENDA_POR_PREFIJO: Record<string, string> = {
  SD: 'Sudadera',
  PL: 'Playera',
  PN: 'Pantalón',
  GO: 'Gorro',
  BO: 'Bolsa de tela',
};

/** El contrato de pendientes sólo entrega SKU; se derivan etiquetas para la tabla. */
function dePendienteApi(item: PendienteApi): PendienteProduccion {
  const segmentos = item.sku.split('-');
  return {
    sku: item.sku,
    nombreProducto: PRENDA_POR_PREFIJO[segmentos[0] ?? ''] ?? item.sku,
    talla: segmentos[1] ?? '—',
    color: segmentos[2] ?? '—',
    demanda: item.demanda,
    pedidos: [],
    ordenFolio: item.orden_folio || null,
    fechaEstimada: item.fecha_estimada,
  };
}

function deResumenApi(item: PedidoResumenApi): Pedido {
  const cancelado = item.estado === 'CANCELADO';
  return {
    id: item.id,
    folio: item.folio,
    ventaFolio: '',
    cliente: nombreCliente(item.cliente),
    estado: item.estado as EstadoPedido,
    estadoDesde: item.estado_desde,
    fechaCreacion: item.estado_desde,
    fechaPromesa: null,
    entregadoEn: item.estado === 'ENTREGADO' ? item.estado_desde : null,
    prioridad: (item.prioridad === 'ALTA' ? 'ALTA' : 'NORMAL') as PrioridadPedido,
    estadoPago: null,
    canceladoEn: cancelado ? item.estado_desde : null,
    motivoCancelacion: null,
    canceladoPor: null,
    preparacionFolio: null,
    entregaGuia: item.guia,
    lineas: [],
    eventos: [],
    notas: [],
  };
}

function lineasDeApi(articulos: PedidoDetalleApi['articulos']): LineaPedido[] {
  return (articulos ?? []).map((articulo) => ({
    sku: articulo.sku,
    nombreProducto: articulo.nombre_producto,
    talla: articulo.talla,
    color: articulo.color,
    cantidad: articulo.cantidad,
    cantReservada: articulo.cant_reservada,
    cantPendiente: articulo.cant_pendiente,
    cantPreparada: articulo.cant_preparada ?? 0,
    ordenProduccionFolio: articulo.orden_produccion_folio ?? null,
    fechaEstimada: articulo.fecha_estimada ?? null,
  }));
}

function eventosDeApi(eventos: PedidoDetalleApi['eventos']): EventoPedido[] {
  return (eventos ?? []).map((evento, indice) => ({
    id: indice + 1,
    fecha: evento.fecha,
    descripcion: evento.descripcion,
    estado: evento.estado as EstadoPedido,
    visibleCliente: evento.visible_cliente,
    usuario: evento.usuario ?? '',
  }));
}

function deDetalleApi(item: PedidoDetalleApi): Pedido {
  const base = deResumenApi({
    id: item.id,
    folio: item.folio,
    cliente: item.cliente ?? {},
    estado: item.estado,
    estado_desde: item.estado_desde,
    prioridad: item.prioridad,
    semaforo: '',
    articulos: item.articulos?.length ?? 0,
    total: '0',
    guia: item.guia ?? null,
  });
  const eventos = eventosDeApi(item.eventos);
  return {
    ...base,
    fechaCreacion: item.fecha,
    fechaPromesa: item.fecha_promesa ?? null,
    estadoPago: item.estado_pago as Pedido['estadoPago'],
    canceladoEn:
      item.cancelado_en ??
      (item.estado === 'CANCELADO' ? item.estado_desde : base.canceladoEn),
    motivoCancelacion: item.motivo_cancelacion ?? base.motivoCancelacion,
    canceladoPor: item.cancelado_por ?? base.canceladoPor,
    preparacionFolio: null,
    entregaGuia: item.entrega?.folio ?? item.guia ?? null,
    lineas: lineasDeApi(item.articulos),
    eventos,
    notas: eventos
      .filter((evento) => !evento.visibleCliente)
      .map((evento, indice) => ({
        id: indice + 1,
        fecha: evento.fecha,
        usuario: evento.usuario,
        texto: evento.descripcion,
      })),
  };
}

/** Estado de M09 leído de /pedidos; M09 no escribe ventas, pagos ni inventario. */
@Injectable({ providedIn: 'root' })
export class PedidosServicio {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStateService);
  private readonly lista = signal<Pedido[]>([]);
  private readonly detalles = signal<Record<number, Pedido>>({});
  private readonly pendientes = signal<PendienteProduccion[]>([]);

  /** Errores de carga visibles en la interfaz; nunca se confunden con listados vacíos. */
  readonly errorCarga = signal('');
  readonly errorDetalle = signal('');

  /** Operativo consulta; las mutaciones son exclusivas del Administrador (§4 M09). */
  private puedeEditar(): boolean {
    return this.auth.puede(['ADMIN']);
  }

  /** API pública síncrona conservada para módulos externos. */
  pedidos(): Pedido[] {
    return this.lista();
  }

  pendientesProduccion(): PendienteProduccion[] {
    return this.pendientes();
  }

  readonly cancelados = computed(() =>
    this.lista()
      .filter((pedido) => pedido.estado === 'CANCELADO')
      .sort((a, b) => (b.canceladoEn ?? '').localeCompare(a.canceladoEn ?? '')),
  );

  readonly indicadores = computed(() => {
    const activos = this.lista().filter(
      (pedido) => pedido.estado !== 'CANCELADO' && pedido.estado !== 'ENTREGADO',
    );
    return {
      activos: activos.length,
      estancados: activos.filter((pedido) => this.tono(pedido) === 'rojo').length,
      demandaPendiente: this.pendientes().reduce((suma, grupo) => suma + grupo.demanda, 0),
      urgentes: activos.filter((pedido) => pedido.prioridad === 'ALTA').length,
      entregados: this.lista().filter((pedido) => pedido.estado === 'ENTREGADO').length,
    };
  });

  private listarTodo<T>(path: string, params: Record<string, string> = {}): Observable<T[]> {
    return this.api.get<Pagina<T>>(path, { params: { ...params, pagina: 1, por_pagina: 100 } }).pipe(
      switchMap((primera) => {
        const faltantes = Math.max(0, Math.ceil(primera.total / 100) - 1);
        if (faltantes === 0) {
          return of(primera.items);
        }
        return forkJoin(
          Array.from({ length: faltantes }, (_, indice) =>
            this.api.get<Pagina<T>>(path, {
              params: { ...params, pagina: indice + 2, por_pagina: 100 },
            }),
          ),
        ).pipe(map((paginas) => [...primera.items, ...paginas.flatMap((pagina) => pagina.items)]));
      }),
    );
  }

  recargar(): Observable<void> {
    this.errorCarga.set('');
    return forkJoin({
      pedidos: this.listarTodo<PedidoResumenApi>('/pedidos'),
      pendientes: this.listarTodo<PendienteApi>('/pedidos/pendientes-produccion'),
    }).pipe(
      tap(({ pedidos, pendientes }) => {
        this.lista.set(pedidos.map((item) => this.fusionarDetalle(item)));
        this.pendientes.set(pendientes.map(dePendienteApi));
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        this.errorCarga.set(
          mensajeError(error, 'No fue posible cargar pedidos ni demanda de producción.'),
        );
        this.lista.set([]);
        this.pendientes.set([]);
        return of(undefined);
      }),
    );
  }

  /** El resumen no trae motivo ni responsable; se conservan del detalle ya cargado. */
  private fusionarDetalle(item: PedidoResumenApi): Pedido {
    const base = deResumenApi(item);
    const detalle = this.detalles()[item.id];
    if (!detalle) {
      return base;
    }
    return {
      ...base,
      ventaFolio: detalle.ventaFolio || base.ventaFolio,
      canceladoEn: detalle.canceladoEn ?? base.canceladoEn,
      motivoCancelacion: detalle.motivoCancelacion ?? base.motivoCancelacion,
      canceladoPor: detalle.canceladoPor ?? base.canceladoPor,
    };
  }

  /** La ruta Angular usa `folio`; el contrato usa `id` para detalle y mutaciones. */
  private idPorFolio(folio: string): number | undefined {
    const exacto = this.lista().find((pedido) => pedido.folio === folio);
    if (exacto) {
      return exacto.id;
    }
    const porId = Number(folio);
    return Number.isInteger(porId) && porId > 0 ? porId : undefined;
  }

  private obtenerDetalle(id: number): Observable<Pedido> {
    return this.api.get<PedidoDetalleApi>(`/pedidos/${id}`).pipe(
      switchMap((item) => {
        const pedido = deDetalleApi(item);
        if (item.venta_id === undefined) {
          return of(pedido);
        }
        return this.api.get<{ folio: string }>(`/ventas/${item.venta_id}`).pipe(
          map((venta) => ({ ...pedido, ventaFolio: venta.folio })),
          catchError(() => of(pedido)),
        );
      }),
      tap((pedido) => this.detalles.update((actuales) => ({ ...actuales, [pedido.id]: pedido }))),
    );
  }

  cargarDetalle(folio: string): Observable<Pedido | undefined> {
    this.errorDetalle.set('');
    const porId = Number(folio);
    if (Number.isInteger(porId) && porId > 0) {
      return this.obtenerDetalle(porId).pipe(
        catchError((error: unknown) => this.fallaDetalle(error)),
      );
    }
    const conocido = this.idPorFolio(folio);
    if (conocido !== undefined) {
      return this.obtenerDetalle(conocido).pipe(
        catchError((error: unknown) => this.fallaDetalle(error)),
      );
    }
    return this.recargar().pipe(
      switchMap(() => {
        if (this.errorCarga()) {
          this.errorDetalle.set(this.errorCarga());
          return of(undefined);
        }
        const resuelto = this.idPorFolio(folio);
        return resuelto === undefined
          ? of(undefined)
          : this.obtenerDetalle(resuelto).pipe(
              catchError((error: unknown) => this.fallaDetalle(error)),
            );
      }),
    );
  }

  private fallaDetalle(error: unknown): Observable<undefined> {
    this.errorDetalle.set(mensajeError(error, 'No fue posible cargar el detalle del pedido.'));
    return of(undefined);
  }

  obtenerPedido(folio: string): Pedido | undefined {
    const id = this.idPorFolio(folio);
    return id === undefined ? undefined : (this.detalles()[id] ?? this.lista().find((p) => p.id === id));
  }

  tieneVentaRegistrada(folioVenta: string | null | undefined): boolean {
    if (!folioVenta) {
      return false;
    }
    return (
      this.lista().some((pedido) => pedido.ventaFolio === folioVenta) ||
      Object.values(this.detalles()).some((pedido) => pedido.ventaFolio === folioVenta)
    );
  }

  /** Horas transcurridas en el estado actual; para terminados se usa su fecha final. */
  horasEnEstado(pedido: Pedido): number {
    const fin = pedido.entregadoEn ?? pedido.canceladoEn;
    const referencia = fin ?? fechaAhoraIso();
    const diferencia = new Date(referencia).getTime() - new Date(pedido.estadoDesde).getTime();
    return Math.max(0, diferencia / 3_600_000);
  }

  tono(pedido: Pedido): TonoSemaforo {
    if (pedido.estado === 'CANCELADO') {
      return 'neutro';
    }
    if (pedido.estado === 'ENTREGADO') {
      return 'verde';
    }
    const umbral = UMBRALES_ESTADO[pedido.estado];
    if (umbral === undefined) {
      return 'neutro';
    }
    const razon = this.horasEnEstado(pedido) / umbral;
    if (razon > 1) {
      return 'rojo';
    }
    return razon >= 0.75 ? 'ambar' : 'verde';
  }

  formatoTiempo(horas: number): string {
    if (horas < 1) {
      return `${Math.max(1, Math.round(horas * 60))} min`;
    }
    if (horas < 48) {
      const minutos = Math.round((horas % 1) * 60);
      return minutos === 0 ? `${Math.floor(horas)} h` : `${Math.floor(horas)} h ${minutos} min`;
    }
    const dias = Math.floor(horas / 24);
    const restantes = Math.floor(horas % 24);
    return restantes === 0 ? `${dias} d` : `${dias} d ${restantes} h`;
  }

  private mutar(id: number, cuerpo: unknown, mensaje: string): Observable<ResultadoPedido> {
    return this.api.patch<PedidoDetalleApi>(`/pedidos/${id}`, cuerpo).pipe(
      map((item) => {
        const pedido = deDetalleApi(item);
        this.detalles.update((actuales) => ({ ...actuales, [pedido.id]: pedido }));
        return { ok: true, mensaje, pedido };
      }),
      tap(() => this.recargar().subscribe()),
      catchError((error) => of({ ok: false, mensaje: mensajeError(error) })),
    );
  }

  private mutarCancelacion(id: number, motivo: string): Observable<ResultadoPedido> {
    return this.api.post<PedidoDetalleApi>(`/pedidos/${id}/cancelar`, { motivo }).pipe(
      map((item) => {
        const pedido = deDetalleApi(item);
        this.detalles.update((actuales) => ({ ...actuales, [pedido.id]: pedido }));
        return {
          ok: true,
          mensaje: `Pedido ${pedido.folio} cancelado; reservas y orden ajustadas por el servidor.`,
          pedido,
        };
      }),
      tap(() => this.recargar().subscribe()),
      catchError((error) => of({ ok: false, mensaje: mensajeError(error) })),
    );
  }

  cambiarPrioridad(folio: string, prioridad: PrioridadPedido): Observable<ResultadoPedido> {
    if (!this.puedeEditar()) {
      return of({ ok: false, mensaje: 'Solo el Administrador puede cambiar la prioridad.' });
    }
    const pedido = this.obtenerPedido(folio);
    if (!pedido || pedido.estado === 'CANCELADO' || pedido.prioridad === prioridad) {
      return of({ ok: false, mensaje: 'No es posible cambiar la prioridad de este pedido.' });
    }
    return this.mutar(
      pedido.id,
      { prioridad },
      `Prioridad del pedido ${pedido.folio} actualizada a ${prioridad}.`,
    );
  }

  agregarNota(folio: string, texto: string): Observable<ResultadoPedido> {
    if (!this.puedeEditar()) {
      return of({ ok: false, mensaje: 'Solo el Administrador puede agregar notas internas.' });
    }
    const pedido = this.obtenerPedido(folio);
    const limpio = texto.trim();
    if (!pedido || limpio === '') {
      return of({ ok: false, mensaje: 'Captura una nota válida.' });
    }
    return this.mutar(
      pedido.id,
      { nota: limpio },
      `Nota interna agregada al pedido ${pedido.folio}.`,
    );
  }

  cancelarPedido(folio: string, motivo: string): Observable<ResultadoPedido> {
    if (!this.puedeEditar()) {
      return of({ ok: false, mensaje: 'Solo el Administrador puede cancelar pedidos.' });
    }
    const pedido = this.obtenerPedido(folio);
    const cancelables: EstadoPedido[] = [
      'RECIBIDO',
      'CONFIRMADO',
      'EN_PRODUCCION',
      'EN_PREPARACION',
      'LISTO_ENVIO',
    ];
    const limpio = motivo.trim();
    if (!pedido || limpio === '' || !cancelables.includes(pedido.estado)) {
      return of({ ok: false, mensaje: 'Este pedido no puede cancelarse.' });
    }
    return this.mutarCancelacion(pedido.id, limpio);
  }

  totalReservado(pedido: Pedido): number {
    return pedido.lineas.reduce((suma, linea) => suma + linea.cantReservada, 0);
  }

  totalPendiente(pedido: Pedido): number {
    return pedido.lineas.reduce((suma, linea) => suma + linea.cantPendiente, 0);
  }

  totalPreparado(pedido: Pedido): number {
    return pedido.lineas.reduce((suma, linea) => suma + linea.cantPreparada, 0);
  }

  articulos(pedido: Pedido): number {
    return pedido.lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  }
}
