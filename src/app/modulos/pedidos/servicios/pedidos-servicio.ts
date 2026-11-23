import { Injectable, computed, inject, signal } from '@angular/core';
import { VentasServicio } from '../../ventas/servicios/ventas-servicio';
import type { Venta } from '../../ventas/modelos/venta';
import { PEDIDOS_SIMULADOS } from '../datos-simulados/pedidos';
import type {
  EstadoPedido,
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

/**
 * Estado en memoria de M09 · Pedidos. La interfaz pública está pensada para
 * sustituirse por HttpClient contra:
 *   GET /pedidos · GET /pedidos/{id} · GET /pedidos/pendientes-produccion
 *   PATCH /pedidos/{id} (prioridad, nota) · POST /pedidos/{id}/cancelar
 * Nada persiste en servidor y no se escriben reservas ni estados de pago,
 * que son propiedad de M12 y M08 respectivamente.
 */
@Injectable({
  providedIn: 'root',
})
export class PedidosServicio {
  // Lectura de M08 (dueño del dinero). M09 no escribe ventas ni pagos.
  private readonly ventas = inject(VentasServicio);
  private readonly lista = signal<Pedido[]>(structuredClone(PEDIDOS_SIMULADOS));

  readonly pedidos = this.lista.asReadonly();

  readonly pendientesProduccion = computed<PendienteProduccion[]>(() => {
    const agrupados = new Map<string, PendienteProduccion>();

    for (const pedido of this.lista()) {
      if (pedido.estado === 'CANCELADO' || pedido.estado === 'ENTREGADO') {
        continue;
      }

      for (const linea of pedido.lineas) {
        if (linea.cantPendiente <= 0) {
          continue;
        }

        const actual = agrupados.get(linea.sku);
        if (actual) {
          actual.demanda += linea.cantPendiente;
          if (!actual.pedidos.includes(pedido.folio)) {
            actual.pedidos.push(pedido.folio);
          }
          if (actual.ordenFolio === null && linea.ordenProduccionFolio !== null) {
            actual.ordenFolio = linea.ordenProduccionFolio;
          }
          if (
            linea.fechaEstimada !== null &&
            (actual.fechaEstimada === null || linea.fechaEstimada < actual.fechaEstimada)
          ) {
            actual.fechaEstimada = linea.fechaEstimada;
          }
          continue;
        }

        agrupados.set(linea.sku, {
          sku: linea.sku,
          nombreProducto: linea.nombreProducto,
          talla: linea.talla,
          color: linea.color,
          demanda: linea.cantPendiente,
          pedidos: [pedido.folio],
          ordenFolio: linea.ordenProduccionFolio,
          fechaEstimada: linea.fechaEstimada,
        });
      }
    }

    return [...agrupados.values()].sort((a, b) => b.demanda - a.demanda);
  });

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
      demandaPendiente: this.pendientesProduccion().reduce(
        (suma, grupo) => suma + grupo.demanda,
        0,
      ),
      urgentes: activos.filter((pedido) => pedido.prioridad === 'ALTA').length,
      entregados: this.lista().filter((pedido) => pedido.estado === 'ENTREGADO').length,
    };
  });

  obtenerPedido(folio: string): Pedido | undefined {
    return this.lista().find((pedido) => pedido.folio === folio);
  }

  /** Permite no enlazar a M08 cuando el pedido de ejemplo no tiene venta asociada. */
  tieneVentaRegistrada(folioVenta: string): boolean {
    return this.ventas.ventas().some((venta) => venta.folio === folioVenta);
  }

  /**
   * Proyecta los dos eventos que M08 entrega a M09 según §5: pago validado y
   * cancelación. M09 conserva la propiedad del estado del pedido: solo aplica
   * la transición RECIBIDO → CONFIRMADO/EN_PRODUCCION cuando ya hay pago
   * aprobado, y la cancelación cuando la venta fue cancelada.
   * Se invoca desde las pantallas; sin Flask equivale a una sincronización local.
   */
  sincronizarDesdeVentas(): void {
    const cambios = new Map<string, Pedido>();
    const ahora = fechaAhoraIso();
    let siguienteId = this.siguienteEventoId();
    let siguientePedidoId = this.lista().reduce((maximo, pedido) => Math.max(maximo, pedido.id), 0) + 1;

    for (const venta of this.ventas.ventas()) {
      const pedido = this.lista().find((item) => item.folio === venta.pedidoFolio);
      if (!pedido) {
        // Una venta manual de M08 puede crear un folio nuevo. Se proyecta el
        // pedido sin inventar reservas: M12 es dueño de la existencia.
        cambios.set(
          venta.pedidoFolio,
          this.crearDesdeVenta(venta, siguienteId++, siguientePedidoId++),
        );
        continue;
      }

      if (venta.estadoPedido === 'CANCELADO' && pedido.estado !== 'CANCELADO') {
        cambios.set(pedido.folio, {
          ...pedido,
          estado: 'CANCELADO',
          estadoDesde: ahora,
          canceladoEn: ahora,
          canceladoPor: venta.creadaPor === 'Cliente' ? 'Cliente' : 'Administrador',
          motivoCancelacion:
            venta.motivoCancelacion ?? 'Cancelación registrada desde M08 · Ventas.',
          estadoPago: venta.estadoPago,
          eventos: [
            ...pedido.eventos,
            {
              id: siguienteId++,
              fecha: ahora,
              usuario: 'M08 · Ventas',
              descripcion: 'Cancelación recibida desde la venta; pendiente de reembolso real.',
              estado: 'CANCELADO',
              visibleCliente: true,
            },
          ],
        });
        continue;
      }

      if (venta.estadoPago === 'PAGADA' && pedido.estado === 'RECIBIDO') {
        const reservaCompleta = pedido.lineas.every(
          (linea) => linea.cantReservada >= linea.cantidad,
        );
        const estado: EstadoPedido = reservaCompleta ? 'CONFIRMADO' : 'EN_PRODUCCION';
        cambios.set(pedido.folio, {
          ...pedido,
          estado,
          estadoDesde: ahora,
          estadoPago: venta.estadoPago,
          eventos: [
            ...pedido.eventos,
            {
              id: siguienteId++,
              fecha: ahora,
              usuario: 'M08 · Ventas',
              descripcion: reservaCompleta
                ? 'Pago aprobado y reserva completa; pedido listo para preparación.'
                : 'Pago aprobado con líneas sin reserva; se mantiene demanda de producción.',
              estado,
              visibleCliente: true,
            },
          ],
        });
      }
    }

    if (cambios.size === 0) {
      return;
    }

    this.lista.update((actuales) => actuales.map((pedido) => cambios.get(pedido.folio) ?? pedido));
  }

  /** Horas transcurridas en el estado actual; para terminados se usa su fecha final. */
  horasEnEstado(pedido: Pedido): number {
    const fin = pedido.entregadoEn ?? pedido.canceladoEn;
    const referencia = fin ?? fechaAhoraIso();
    const diferencia =
      new Date(referencia).getTime() - new Date(pedido.estadoDesde).getTime();
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

  cambiarPrioridad(folio: string, prioridad: PrioridadPedido): boolean {
    const pedido = this.obtenerPedido(folio);
    if (!pedido || pedido.estado === 'CANCELADO' || pedido.prioridad === prioridad) {
      return false;
    }

    this.actualizar(folio, (actual) => ({
      ...actual,
      prioridad,
      eventos: [
        ...actual.eventos,
        {
          id: this.siguienteEventoId(),
          fecha: fechaAhoraIso(),
          usuario: 'Administrador',
          descripcion: `Prioridad cambiada a ${prioridad}.`,
          estado: actual.estado,
          visibleCliente: false,
        },
      ],
    }));

    return true;
  }

  agregarNota(folio: string, texto: string): boolean {
    const limpio = texto.trim();
    if (limpio === '' || !this.obtenerPedido(folio)) {
      return false;
    }

    this.actualizar(folio, (actual) => ({
      ...actual,
      notas: [
        ...actual.notas,
        {
          id: actual.notas.reduce((maximo, nota) => Math.max(maximo, nota.id), 0) + 1,
          fecha: fechaAhoraIso(),
          usuario: 'Administrador',
          texto: limpio,
        },
      ],
      eventos: [
        ...actual.eventos,
        {
          id: this.siguienteEventoId(),
          fecha: fechaAhoraIso(),
          usuario: 'Administrador',
          descripcion: 'Nota interna agregada al pedido.',
          estado: actual.estado,
          visibleCliente: false,
        },
      ],
    }));

    return true;
  }

  cancelarPedido(folio: string, motivo: string): boolean {
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
      return false;
    }

    this.actualizar(folio, (actual) => ({
      ...actual,
      estado: 'CANCELADO',
      estadoDesde: fechaAhoraIso(),
      canceladoEn: fechaAhoraIso(),
      canceladoPor: 'Administrador',
      motivoCancelacion: limpio,
      eventos: [
        ...actual.eventos,
        {
          id: this.siguienteEventoId(),
          fecha: fechaAhoraIso(),
          usuario: 'Administrador',
          descripcion: `Pedido cancelado. Motivo: ${limpio}. Liberación de reservas (M12), ajuste de orden (M16) y reembolso (M08) pendientes de integración.`,
          estado: 'CANCELADO',
          visibleCliente: true,
        },
      ],
    }));

    return true;
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

  /** Proyección de un pedido nuevo a partir de la copia histórica de una venta. */
  private crearDesdeVenta(venta: Venta, idEvento: number, idPedido: number): Pedido {
    const cancelada = venta.estadoPedido === 'CANCELADO';
    return {
      id: idPedido,
      folio: venta.pedidoFolio,
      ventaFolio: venta.folio,
      cliente: venta.cliente,
      estado: cancelada ? 'CANCELADO' : 'RECIBIDO',
      estadoDesde: venta.fecha,
      fechaCreacion: venta.fecha,
      fechaPromesa: venta.fechaPromesa,
      entregadoEn: null,
      prioridad: 'NORMAL',
      estadoPago: venta.estadoPago,
      canceladoEn: cancelada ? (venta.canceladaEn ?? venta.fecha) : null,
      motivoCancelacion: cancelada
        ? (venta.motivoCancelacion ?? 'Cancelación registrada desde M08 · Ventas.')
        : null,
      canceladoPor: cancelada
        ? venta.creadaPor === 'Cliente'
          ? 'Cliente'
          : 'Administrador'
        : null,
      preparacionFolio: null,
      entregaGuia: null,
      lineas: venta.lineas.map((linea) => ({
        sku: linea.sku,
        nombreProducto: linea.nombreProducto,
        talla: linea.talla,
        color: linea.color,
        cantidad: linea.cantidad,
        cantReservada: 0,
        cantPendiente: linea.cantidad,
        cantPreparada: 0,
        ordenProduccionFolio: null,
        fechaEstimada: null,
      })),
      eventos: [
        {
          id: idEvento,
          fecha: venta.fecha,
          usuario: 'Sistema',
          descripcion: cancelada
            ? 'Pedido creado y cancelado desde la venta de M08.'
            : 'Pedido creado a partir de la venta confirmada; reservas pendientes de M12.',
          estado: cancelada ? 'CANCELADO' : 'RECIBIDO',
          visibleCliente: true,
        },
      ],
      notas: [],
    };
  }

  private actualizar(folio: string, transformar: (pedido: Pedido) => Pedido): void {
    this.lista.update((actuales) =>
      actuales.map((pedido) => (pedido.folio === folio ? transformar(pedido) : pedido)),
    );
  }

  private siguienteEventoId(): number {
    return this.lista().reduce(
      (maximo, pedido) =>
        pedido.eventos.reduce((interno, evento) => Math.max(interno, evento.id), maximo),
      0,
    ) + 1;
  }
}
