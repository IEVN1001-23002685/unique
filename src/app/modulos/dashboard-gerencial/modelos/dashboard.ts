/**
 * Modelos de interfaz de M20 · Dashboard gerencial (§6 y §7 del documento
 * UNIQUE v3.0). No son entidades MySQL: solo tipan la proyección de lectura
 * que se muestra en el frontend. Flask será la fuente autoritativa.
 */

import type { EstadoPedido } from '../../pedidos/modelos/pedido';
import type { CanalVenta } from '../../ventas/modelos/venta';

export type PeriodoDashboard = '30_DIAS' | '90_DIAS' | 'ANO_ACTUAL';
export type CanalDashboard = 'TODOS' | CanalVenta;
export type RolDashboard = 'Administrador' | 'Operativo';
export type TonoDashboard = 'ROJO' | 'AMBAR' | 'VERDE' | 'NEUTRO' | 'INFO';
export type SeccionDashboard =
  | 'resumen'
  | 'ventas-productos'
  | 'produccion-merma'
  | 'abastecimiento'
  | 'logistica-devoluciones';

export interface FiltrosDashboard {
  periodo: PeriodoDashboard;
  categoriaId: number;
  productoId: number;
  color: string;
  talla: string;
  canal: CanalDashboard;
}

export interface MetricaDashboard {
  etiqueta: string;
  valor: string;
  detalle: string;
  tono: TonoDashboard;
  /** Ventas o costos: no se muestra al rol Operativo. */
  soloAdmin?: boolean;
}

export interface FilaValor {
  etiqueta: string;
  valor: number;
  detalle?: string;
}

export interface AlertaDashboard {
  id: string;
  clave: string;
  titulo: string;
  detalle: string;
  severidad: 'CRITICA' | 'PREVENTIVA';
  origen: string;
  ruta: string[];
}

export interface IngresoSku {
  sku: string;
  producto: string;
  categoria: string;
  color: string;
  talla: string;
  piezas: number;
  ingresos: number;
  margen: number;
}

export interface LineaAgrupada {
  etiqueta: string;
  piezas: number;
  ingresos: number;
}

export interface OrdenProduccionDemo {
  folio: string;
  sku: string;
  tono: Exclude<TonoDashboard, 'INFO'>;
  planeadas: number;
  aprobadas: number;
  alcanzaPara: number;
  etapa: string;
}

export interface MermaDemo {
  etapa: string;
  causa: string;
  unidades: number;
  costo: number;
}

export interface MaterialDemo {
  material: string;
  sku: string;
  disponible: number;
  minimo: number;
  tono: Exclude<TonoDashboard, 'INFO' | 'NEUTRO'>;
  tono: 'ROJO' | 'AMBAR';
}

export interface CompraDemo {
  folio: string;
  proveedor: string;
  material: string;
  cantidad: number;
  compromiso: string;
  estado: 'PENDIENTE' | 'RETRASADA' | 'RECIBIDA';
}

export interface ProveedorDemo {
  proveedor: string;
  entregas: number;
  aTiempo: number;
  aceptacion: number;
}

export interface DevolucionDemo {
  motivo: string;
  producto: string;
  unidades: number;
  tasa: number;
}

export interface RepartidorMetric {
  repartidor: string;
  entregas: number;
  exitosas: number;
  primerIntento: number;
  tiempoHoras: number;
}

export interface EstadoPedidoMetric {
  estado: string;
  cantidad: number;
}

export const ETIQUETAS_ESTADO_PEDIDO_DASH: Record<EstadoPedido, string> = {
  RECIBIDO: 'Recibido',
  CONFIRMADO: 'Confirmado',
  EN_PRODUCCION: 'En producción',
  EN_PREPARACION: 'En preparación',
  LISTO_ENVIO: 'Listo para envío',
  EN_REPARTO: 'En reparto',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

const formatoDinero = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const formatoNumero = new Intl.NumberFormat('es-MX');

export function mxn(valor: number): string {
  return formatoDinero.format(valor);
}

export function numero(valor: number): string {
  return formatoNumero.format(valor);
}

export function porcentaje(valor: number): string {
  return `${formatoNumero.format(Math.round(valor * 10) / 10)} %`;
}

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
