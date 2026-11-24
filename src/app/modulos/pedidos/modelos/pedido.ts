/** Modelos de interfaz de M09 · Pedidos (§6 del documento UNIQUE v3.0). */
/** No son entidades MySQL: solo tipan lo que muestra el frontend. */

export type EstadoPedido =
  | 'RECIBIDO'
  | 'CONFIRMADO'
  | 'EN_PRODUCCION'
  | 'EN_PREPARACION'
  | 'LISTO_ENVIO'
  | 'EN_REPARTO'
  | 'ENTREGADO'
  | 'CANCELADO';

export type PrioridadPedido = 'NORMAL' | 'ALTA';

/** Proyección de lectura de M08. M09 no escribe el estado de pago. */
export type EstadoPagoPedido = 'PENDIENTE' | 'PAGADA' | 'REEMBOLSADA_PARCIAL' | 'REEMBOLSADA';

export type TonoSemaforo = 'verde' | 'ambar' | 'rojo' | 'neutro';

/** Copia histórica de una línea: cant_reservada + cant_pendiente = cantidad. */
export interface LineaPedido {
  sku: string;
  nombreProducto: string;
  talla: string;
  color: string;
  cantidad: number;
  cantReservada: number;
  cantPendiente: number;
  cantPreparada: number;
  ordenProduccionFolio: string | null;
  fechaEstimada: string | null;
}

export interface EventoPedido {
  id: number;
  fecha: string;
  usuario: string;
  descripcion: string;
  estado: EstadoPedido;
  visibleCliente: boolean;
}

export interface NotaPedido {
  id: number;
  fecha: string;
  usuario: string;
  texto: string;
}

export interface Pedido {
  id: number;
  folio: string;
  ventaFolio: string;
  cliente: string;
  estado: EstadoPedido;
  estadoDesde: string;
  fechaCreacion: string;
  fechaPromesa: string | null;
  entregadoEn: string | null;
  prioridad: PrioridadPedido;
  estadoPago: EstadoPagoPedido;
  canceladoEn: string | null;
  motivoCancelacion: string | null;
  canceladoPor: string | null;
  preparacionFolio: string | null;
  entregaGuia: string | null;
  lineas: LineaPedido[];
  eventos: EventoPedido[];
  notas: NotaPedido[];
}

/** Agrupación de la pantalla «Pendientes de producción». */
export interface PendienteProduccion {
  sku: string;
  nombreProducto: string;
  talla: string;
  color: string;
  demanda: number;
  pedidos: string[];
  ordenFolio: string | null;
  fechaEstimada: string | null;
}
