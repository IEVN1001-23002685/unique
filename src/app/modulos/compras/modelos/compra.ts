/**
 * Modelos de interfaz de M14 · Compras (§6 del documento UNIQUE v3.0).
 * Solo se usan para tipar la UI: no representan tablas MySQL ni operaciones
 * persistentes. Los catálogos de proveedores y materiales se consultan a M13
 * y M15 mediante contratos de servicio, nunca se copian como reglas propias.
 */

export type OrigenRequisicion = 'ALERTA' | 'ORDEN_PRODUCCION' | 'MANUAL';
export type EstadoRequisicion =
  'PENDIENTE' | 'EN_COTIZACION' | 'COMPRA_EMITIDA' | 'ATENDIDA' | 'CANCELADA';
export type Prioridad = 'NORMAL' | 'URGENTE';
export type EstadoCotizacion = 'PENDIENTE' | 'ELEGIDA' | 'DESCARTADA';
export type EstadoOrdenCompra = 'BORRADOR' | 'EMITIDA' | 'PARCIAL' | 'RECIBIDA' | 'CANCELADA';

/** Unión de estados para el chip reutilizable del módulo. */
export type EstadoCompra = EstadoRequisicion | EstadoCotizacion | EstadoOrdenCompra | 'RETRASADA';

export type UnidadBase = 'm²' | 'm' | 'pieza';

/** Referencia de lectura al catálogo de materiales de M15. */
export interface MaterialCompra {
  id: number;
  codigo: string;
  nombre: string;
  categoria: string;
  color: string | null;
  unidadBase: UnidadBase;
  presentacion: string;
  unidadPresentacion: string;
  /** Factor de conversión: 1 presentación equivale a tantas unidades base. */
  factorPresentacion: number;
  minimoCompra: number;
}

export interface LineaRequisicion {
  id: number;
  materialId: number;
  color: string | null;
  cantidadBaseFaltante: number;
  cantidadCompraSugerida: number;
  cantidadCompraAtendida: number;
}

export interface Requisicion {
  id: number;
  folio: string;
  origen: OrigenRequisicion;
  ordenProduccion: string | null;
  fecha: string;
  estado: EstadoRequisicion;
  prioridad: Prioridad;
  solicitadaPor: string;
  notas: string | null;
  lineas: LineaRequisicion[];
}

export interface LineaCotizacion {
  id: number;
  requisicionLineaId: number;
  cantidadCompra: number;
  precioUnitarioCompra: number;
  subtotal: number;
}

export interface Cotizacion {
  id: number;
  folio: string;
  requisicionId: number;
  proveedorId: number;
  fecha: string;
  vigenciaHasta: string | null;
  plazoDias: number;
  estado: EstadoCotizacion;
  total: number;
  notas: string | null;
  lineas: LineaCotizacion[];
}

export interface LineaOrdenCompra {
  id: number;
  materialId: number;
  cantidadCompra: number;
  cantidadBasePedida: number;
  precioUnitarioCompra: number;
  subtotal: number;
  cantidadBaseAceptada: number;
}

export interface OrdenCompra {
  id: number;
  folio: string;
  proveedorId: number;
  requisicionId: number | null;
  cotizacionId: number | null;
  estado: EstadoOrdenCompra;
  fechaEmision: string | null;
  fechaPrometida: string | null;
  total: number;
  condicionesPago: string;
  notas: string | null;
  creadaPor: string;
  lineas: LineaOrdenCompra[];
}

export interface LineaRecepcion {
  id: number;
  ordenCompraLineaId: number;
  pesoKg: number | null;
  anchoCm: number | null;
  largoM: number | null;
  cantidadBaseMedida: number;
  cantidadBaseAceptada: number;
  cantidadBaseRechazada: number;
  motivoRechazo: string | null;
}

export interface Recepcion {
  id: number;
  folio: string;
  ordenCompraId: number;
  fecha: string;
  recibidaPor: string;
  documentoProveedor: string | null;
  notas: string | null;
  lineas: LineaRecepcion[];
}

export interface DatosRecepcion {
  ordenCompraId: number;
  documentoProveedor: string;
  notas: string;
  recibidaPor: string;
  cerrarConFaltante: boolean;
  lineas: Omit<LineaRecepcion, 'id'>[];
}

export interface ResultadoRecepcion {
  recepcion: Recepcion;
  estadoOrden: EstadoOrdenCompra;
}
