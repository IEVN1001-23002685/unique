/**
 * Modelos de interfaz de M12 · Inventario de producto terminado.
 * Son una proyección de las entidades del §6 (stock_variante y
 * movimiento_producto) para la capa de presentación. La persistencia, los
 * bloqueos y la creación real de órdenes de producción corresponden a Flask.
 */

import type { CodigoColor, CodigoTalla } from '../../productos/modelos/producto-maestro';

export type SemaforoInventario = 'ROJO' | 'AMBAR' | 'VERDE';

export type TipoMovimientoProducto =
  'PRODUCCION' | 'RESERVA' | 'LIBERA_RESERVA' | 'SALIDA_ENVIO' | 'REINGRESO' | 'MERMA' | 'AJUSTE';

export type TipoDocumentoMovimiento = 'ORDEN' | 'PEDIDO' | 'DEVOLUCION' | 'ENTREGA' | 'AJUSTE';

/** Fila de stock_variante enriquecida con la lectura de M10 y de órdenes abiertas. */
export interface FilaInventario {
  varianteId: number;
  /** SKU generado por M10; nunca se edita desde M12. */
  sku: string;
  productoId: number;
  productoNombre: string;
  categoriaId: number;
  categoriaNombre: string;
  talla: CodigoTalla;
  color: CodigoColor;
  existencia: number;
  reservado: number;
  stockMinimo: number;
  cantidadReposicion: number;
  /** Unidades de órdenes abiertas de M16. No incluye proceso ni revisión. */
  enProduccion: number;
  /** Promedio de salidas de los últimos 30 días; 0 cuando no hay historial. */
  ventasDiarias30: number;
}

export interface FilaExistencia extends FilaInventario {
  /** existencia − reservado, limitada a cero por la restricción de integridad. */
  disponible: number;
  semaforo: SemaforoInventario;
  /** disponible ÷ ventas diarias de 30 días; null cuando no hay ventas. */
  diasCobertura: number | null;
}

/** Los movimientos solo se agregan: una corrección es otro movimiento. */
export interface MovimientoProducto {
  id: number;
  varianteId: number;
  sku: string;
  tipo: TipoMovimientoProducto;
  deltaExistencia: number;
  deltaReservado: number;
  documentoTipo: TipoDocumentoMovimiento;
  documentoId: string;
  motivo: string;
  usuario: string;
  fecha: string;
}

export interface AlertaInventarioProducto {
  id: number;
  fecha: string;
  clave: 'PT_STOCK_MINIMO' | 'AJUSTE_DIFERENCIA';
  sku: string;
  mensaje: string;
  severidad: 'PREVENTIVA' | 'INFORMATIVA';
}

/**
 * Intención de reposición pendiente de integración. No representa una orden
 * creada: Flask debe crearla o sumarle unidades en M16.
 */
export interface SenalReposicion {
  id: number;
  fecha: string;
  sku: string;
  cantidad: number;
  origen: 'STOCK_MINIMO';
  estado: 'PENDIENTE_M16';
}

export interface DatosAjuste {
  varianteId: number;
  cantidadContada: number;
  motivo: string;
}

export interface ResultadoAjuste {
  ok: boolean;
  mensaje: string;
  senal?: SenalReposicion;
}

export interface ReglaReposicion {
  varianteId: number;
  stockMinimo: number;
  cantidadReposicion: number;
}

export interface ResultadoReglas {
  ok: boolean;
  mensaje: string;
}

export interface ResumenInventario {
  skus: number;
  existencia: number;
  reservado: number;
  disponible: number;
  enRiesgo: number;
  agotados: number;
  senales: number;
}
