/** Modelos públicos de M04. El servidor es la fuente de verdad para el cliente con sesión. */

export type EstadoLineaCarrito =
  | 'Disponible'
  | 'Pocas unidades'
  | 'Bajo pedido'
  | 'Agotado';

export type OrigenCarrito = 'servidor' | 'navegador';

export interface ItemCarrito {
  idLinea: string;
  varianteId: number;
  productoId?: number;
  nombre: string;
  sku: string;
  colorNombre: string;
  talla: string;
  precioUnitarioConIva: number;
  cantidad: number;
  estadoDisponibilidad: EstadoLineaCarrito;
  fechaEstimada?: string;
  imagenUrl: string;
  /** El servidor marca aquí cambios de precio o disponibilidad detectados al revalidar. */
  cambioDetectado?: string;
}

export interface ResumenCarrito {
  items: ItemCarrito[];
  subtotal: number;
  totalArticulos: number;
  maxPiezasPorLinea: number;
  puedePagar: boolean;
  origen: OrigenCarrito;
}

/** Parámetro documentado en §7 M04 y §10.4; Flask puede enviar otro valor. */
export const MAX_PIEZAS_POR_LINEA = 10;

export const CARRITO_VACIO: ResumenCarrito = {
  items: [],
  subtotal: 0,
  totalArticulos: 0,
  maxPiezasPorLinea: MAX_PIEZAS_POR_LINEA,
  puedePagar: false,
  origen: 'servidor',
};
