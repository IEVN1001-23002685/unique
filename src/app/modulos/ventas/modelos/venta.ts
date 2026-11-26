/** Modelos de interfaz de M08 · Ventas (§6 del documento UNIQUE v3.0). */
/** No son entidades MySQL: solo tipan la información que muestra el frontend. */

export type CanalVenta = 'TIENDA' | 'MANUAL' | 'CAMBIO';
export type EstadoVenta = 'ACTIVA' | 'CANCELADA';
export type EstadoPago = 'PENDIENTE' | 'PAGADA' | 'REEMBOLSADA_PARCIAL' | 'REEMBOLSADA';
export type EstadoPedido =
  | 'RECIBIDO'
  | 'CONFIRMADO'
  | 'EN_PRODUCCION'
  | 'EN_PREPARACION'
  | 'LISTO_ENVIO'
  | 'EN_REPARTO'
  | 'ENTREGADO'
  | 'CANCELADO';
export type MetodoPago = 'TARJETA' | 'CUENTA' | 'TRANSFERENCIA' | 'EFECTIVO';
export type TipoPago = 'COBRO' | 'REEMBOLSO';
export type EstadoTransaccion = 'APROBADO' | 'PENDIENTE' | 'RECHAZADO';
export type TipoDescuento = 'PORCENTAJE' | 'MONTO';
export type AplicacionDescuento = 'CUPON' | 'AUTOMATICO';
export type TipoDireccion = 'ENVIO' | 'FACTURACION';

/** Copia histórica: el SKU y el costo se conservan aunque cambie el catálogo. */
export interface LineaVenta {
  sku: string;
  nombreProducto: string;
  talla: string;
  color: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  costoEstandarUnitario: number;
}

export interface DireccionVenta {
  tipo: TipoDireccion;
  destinatario: string;
  telefono: string;
  calle: string;
  numeroExt: string;
  numeroInt: string | null;
  colonia: string;
  municipio: string;
  estado: string;
  codigoPostal: string;
  referencia: string | null;
  rfc: string | null;
  razonSocial: string | null;
}

export interface PagoVenta {
  id: number;
  tipo: TipoPago;
  metodo: MetodoPago;
  estado: EstadoTransaccion;
  monto: number;
  referencia: string;
  ultimos4: string | null;
  titular: string | null;
  motivoRechazo: string | null;
  fecha: string;
  registradoPor: string;
}

export interface Venta {
  id: number;
  folio: string;
  cliente: string;
  clienteId: number | null;
  fecha: string;
  canal: CanalVenta;
  estado: EstadoVenta;
  estadoPago: EstadoPago;
  estadoPedido: EstadoPedido | null;
  pedidoFolio: string;
  /** El listado M08 no expone subtotal; sólo está disponible al cargar el detalle. */
  subtotal: number | null;
  descuentoId: number | null;
  descuentoNombre: string | null;
  descuentoMonto: number;
  costoEnvio: number;
  total: number;
  /** Informativo: total ÷ 1.16 × 0.16. No representa un timbrado real. */
  ivaIncluido: number;
  requiereFactura: boolean;
  fechaPromesa: string | null;
  canceladaEn: string | null;
  motivoCancelacion: string | null;
  creadaPor: string;
  notas: string | null;
  lineas: LineaVenta[];
  direcciones: DireccionVenta[];
  pagos: PagoVenta[];
}

export interface Descuento {
  id: number;
  nombre: string;
  codigo: string | null;
  tipo: TipoDescuento;
  valor: number;
  aplicacion: AplicacionDescuento;
  soloPrimeraCompra: boolean;
  montoMinimo: number | null;
  minArticulos: number | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  usosMaximos: number | null;
  usosPorCliente: number;
  usosActuales: number;
  activo: boolean;
}

/** Variante de catálogo que se ofrece al registrar una venta manual. */
export interface VarianteVenta {
  sku: string;
  nombreProducto: string;
  talla: string;
  color: string;
  precioUnitario: number;
  costoEstandarUnitario: number;
}

export interface ClienteVenta {
  id: number;
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  esNuevoSinAcceso: boolean;
}

export interface ContextoDescuento {
  subtotal: number;
  cantidadArticulos: number;
  esPrimeraCompra: boolean;
}

export interface ValidacionDescuento {
  valido: boolean;
  motivo: string;
  monto: number;
}

export interface SolicitudVentaManual {
  cliente: ClienteVenta;
  lineas: { sku: string; cantidad: number }[];
  direccionEnvio: DireccionVenta;
  direccionFacturacion: DireccionVenta;
  descuentoId: number | null;
  metodoPago: MetodoPago;
  estadoPago: 'PAGADA' | 'PENDIENTE';
  ultimos4: string | null;
  titular: string | null;
  costoEnvio: number;
}
