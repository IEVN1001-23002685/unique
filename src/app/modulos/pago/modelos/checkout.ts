/** Modelos de interfaz de M05 · Pago. Flask calcula y valida todos los importes. */

import type { DireccionCliente } from '../../micuenta/modelos/cuenta';

export type OpcionDireccionCheckout = DireccionCliente;

export interface OpcionPagoCheckout {
  id: number;
  tipo: 'tarjeta' | 'cuenta' | 'nueva-tarjeta';
  alias: string;
  detalle: string;
  saldoDisponible?: number;
}

export interface ResumenItemCheckout {
  idLinea: string;
  nombre: string;
  sku: string;
  colorNombre: string;
  talla: string;
  cantidad: number;
  precioUnitarioConIva: number;
}

export interface ConfirmacionPedidoCheckout {
  folio: string;
  pedidoId: number;
  ventaId: number;
  direccionEnvioId: number | 'nueva';
  requiereFactura: boolean;
  medioPagoId: number | null;
  totalPagado: number;
}

/** Etiquetas de la barra de pasos; el orden coincide con §7 M05. */
export const PASOS_CHECKOUT = [
  'Mi información',
  'Facturación',
  'Envío',
  'Paquete',
  'Descuentos',
  'Pago',
  'Confirmación',
] as const;

/** Valor centinela del formulario para capturar una tarjeta simulada nueva. */
export const NUEVA_TARJETA_ID = -1;
export const VALOR_NUEVA_TARJETA = String(NUEVA_TARJETA_ID);
export const VALOR_NUEVA_DIRECCION = 'nueva';
