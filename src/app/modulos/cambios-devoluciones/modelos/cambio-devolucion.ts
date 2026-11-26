/**
 * Modelos de interfaz de M07 · Cambios y devoluciones.
 * Flask sigue siendo la fuente autoritativa de estados, importes y catálogos.
 */

export type TipoSolicitudCaso = 'DEVOLUCION' | 'CAMBIO';
export type EstadoCaso = 'SOLICITADA' | 'APROBADA' | 'RECHAZADA' | 'RECIBIDA' | 'RESUELTA';
export type ResolucionCaso = 'REEMBOLSO' | 'CAMBIO' | 'RECHAZO';
export type DictamenLinea = 'PENDIENTE' | 'REINGRESO' | 'MERMA';
export type MotivoSolicitud =
  | 'DEFECTO'
  | 'AJUSTE'
  | 'DANO_ENVIO'
  | 'PRODUCTO_EQUIVOCADO'
  | 'ARREPENTIMIENTO';
export type EtapaMerma =
  | 'RECEPCION'
  | 'CORTE'
  | 'TEJIDO'
  | 'BORDADO'
  | 'CONFECCION'
  | 'ACABADOS'
  | 'ALMACEN'
  | 'ENTREGA'
  | 'DEVOLUCION';

export interface LineaDevolucionApi {
  id: number;
  venta_linea_id: number;
  sku: string | null;
  cantidad: number;
  cantidad_devuelta?: number | null;
  variante_cambio_id: number | null;
  dictamen: DictamenLinea | string;
  nombre_producto?: string | null;
  talla?: string | null;
  color?: string | null;
  precio_unitario?: string | null;
  subtotal?: string | null;
}

export interface EvidenciaCaso {
  id: number;
  url: string;
  nombre?: string;
}

export interface SolicitudCambioDevolucion {
  id: number;
  folioCaso: string;
  folioPedido: string;
  pedidoId: number | null;
  tipo: TipoSolicitudCaso;
  motivo: string;
  descripcion: string;
  estado: EstadoCaso;
  resolucion: ResolucionCaso | null;
  dictamen?: string;
  reembolsoMonto?: string | null;
  ventaReemplazoFolio?: string | null;
  motivoRechazo?: string | null;
  creadoEn: string;
  recibidoEn?: string | null;
  resueltaEn?: string | null;
  resueltaPor?: string | null;
  lineas: LineaDevolucionApi[];
  evidencias: EvidenciaCaso[];
}

export interface LineaPedidoDevolucion {
  ventaLineaId: number;
  varianteId: number;
  productoId: number;
  sku: string;
  descripcion: string;
  cantidad: number;
  cantidadDevuelta: number;
  cantidadSolicitada: number;
  precioUnitarioConIva: number;
  subtotalConIva: number;
  varianteCambioId: number | null;
  opcionesVariante: VarianteCatalogo[];
}

export interface VarianteCatalogo {
  id: number;
  sku: string;
  talla: string;
  color: string;
  disponibilidad: string;
  bajo_pedido: boolean;
  /** Flask calcula este valor; puede no venir serializado en el contrato público. */
  comprable?: boolean;
  activa?: boolean;
  fecha_estimada?: string | null;
}

export const TIPOS_SOLICITUD = [
  { valor: 'DEVOLUCION', etiqueta: 'Devolución con reembolso' },
  { valor: 'CAMBIO', etiqueta: 'Cambio por otra variante' },
] as const;

export const MOTIVOS_SOLICITUD = [
  { valor: 'DEFECTO', etiqueta: 'Defecto en la prenda' },
  { valor: 'AJUSTE', etiqueta: 'Ajuste de talla' },
  { valor: 'DANO_ENVIO', etiqueta: 'Daño durante el envío' },
  { valor: 'PRODUCTO_EQUIVOCADO', etiqueta: 'Producto equivocado' },
  { valor: 'ARREPENTIMIENTO', etiqueta: 'Arrepentimiento' },
] as const;

/** Catálogo de causas del documento (§11). Flask resuelve los identificadores definitivos. */
export const CAUSAS_MERMA = [
  { valor: 'DEFECTO_TELA', etiqueta: 'Defecto de tela' },
  { valor: 'RECHAZO_RECEPCION', etiqueta: 'Rechazo en recepción' },
  { valor: 'ERROR_CORTE', etiqueta: 'Error de corte' },
  { valor: 'ERROR_TEJIDO', etiqueta: 'Error de tejido' },
  { valor: 'DEFECTO_BORDADO', etiqueta: 'Defecto de bordado' },
  { valor: 'ERROR_CONFECCION', etiqueta: 'Error de confección' },
  { valor: 'DEFECTO_ACABADO', etiqueta: 'Defecto de acabado' },
  { valor: 'DANO_ALMACEN', etiqueta: 'Daño en almacén' },
  { valor: 'DANO_ENVIO', etiqueta: 'Daño en envío' },
  { valor: 'DEVOLUCION_DANADA', etiqueta: 'Devolución de cliente dañada' },
  { valor: 'ENCOGIMIENTO_DESGASTE', etiqueta: 'Encogimiento o desgaste' },
  { valor: 'SOBRANTE_INSERVIBLE', etiqueta: 'Sobrante inservible' },
  { valor: 'OTRO', etiqueta: 'Otro' },
] as const;

export const ETAPAS_MERMA = [
  { valor: 'RECEPCION', etiqueta: 'Recepción' },
  { valor: 'CORTE', etiqueta: 'Corte' },
  { valor: 'TEJIDO', etiqueta: 'Tejido' },
  { valor: 'BORDADO', etiqueta: 'Bordado' },
  { valor: 'CONFECCION', etiqueta: 'Confección' },
  { valor: 'ACABADOS', etiqueta: 'Acabados' },
  { valor: 'ALMACEN', etiqueta: 'Almacén' },
  { valor: 'ENTREGA', etiqueta: 'Entrega' },
  { valor: 'DEVOLUCION', etiqueta: 'Devolución' },
] as const;

export const ETIQUETAS_ESTADO: Record<string, string> = {
  SOLICITADA: 'Solicitada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  RECIBIDA: 'Recibida',
  RESUELTA: 'Resuelta',
};

export const ETIQUETAS_MOTIVO: Record<string, string> = {
  DEFECTO: 'Defecto en la prenda',
  AJUSTE: 'Ajuste de talla',
  DANO_ENVIO: 'Daño durante el envío',
  PRODUCTO_EQUIVOCADO: 'Producto equivocado',
  ARREPENTIMIENTO: 'Arrepentimiento',
};

export const ETIQUETAS_DICTAMEN: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  REINGRESO: 'Reingreso a existencia',
  MERMA: 'Merma',
};

export const ETIQUETAS_RESOLUCION: Record<string, string> = {
  REEMBOLSO: 'Reembolso simulado',
  CAMBIO: 'Venta de reemplazo (CAMBIO)',
  RECHAZO: 'Rechazada',
};

const ETIQUETAS_COLOR: Record<string, string> = {
  BL: 'Blanco',
  NG: 'Negro',
  GR: 'Gris',
  NA: 'No aplica',
};

export function etiquetaColor(codigo: string): string {
  return ETIQUETAS_COLOR[codigo] ?? codigo;
}

export function etiquetaTalla(codigo: string): string {
  return codigo === 'UN' ? 'Única' : codigo;
}

/** Umbral documentado para la alerta preventiva DEVOLUCION_PENDIENTE. */
export const HORAS_ALERTA = 48;

export function etiquetaEstado(codigo: string): string {
  return ETIQUETAS_ESTADO[codigo] ?? codigo;
}

export function etiquetaMotivo(codigo: string): string {
  return ETIQUETAS_MOTIVO[codigo] ?? codigo;
}

export function etiquetaDictamen(codigo: string): string {
  return ETIQUETAS_DICTAMEN[codigo] ?? codigo;
}

export function etiquetaResolucion(codigo: string | null | undefined): string {
  if (!codigo) return 'Sin resolución';
  return ETIQUETAS_RESOLUCION[codigo] ?? codigo;
}

export function claseEstado(codigo: string): string {
  if (codigo === 'RESUELTA') return 'cd-chip--exito';
  if (codigo === 'RECHAZADA') return 'cd-chip--error';
  if (codigo === 'RECIBIDA' || codigo === 'APROBADA') return 'cd-chip--info';
  return 'cd-chip--adv';
}

/** El envío solo se reembolsa en defecto, daño en envío o producto equivocado (§7 M07). */
export function motivoConEnvio(motivo: string): boolean {
  return ['DEFECTO', 'DANO_ENVIO', 'PRODUCTO_EQUIVOCADO'].includes(motivo);
}

/** Horas transcurridas desde la solicitud o desde la recepción sin inspeccionar. */
export function horasSinAtender(caso: SolicitudCambioDevolucion): number {
  const referencia = caso.estado === 'RECIBIDA' ? caso.recibidoEn : caso.creadoEn;
  if (!referencia) return 0;
  const fecha = new Date(referencia).getTime();
  if (Number.isNaN(fecha)) return 0;
  return Math.max(0, Math.floor((Date.now() - fecha) / 3_600_000));
}

export interface DatosEstimacionReembolso {
  motivo: string;
  subtotalPedido: number;
  descuentoPedido: number;
  envioPedido: number;
  lineas: Array<{ precioUnitarioConIva: number; cantidad: number }>;
}

/**
 * Estimación informativa de la interfaz. El importe definitivo lo calcula Flask:
 * prendas menos descuento proporcional y envío según el motivo.
 */
export function estimarReembolso(datos: DatosEstimacionReembolso): number {
  const prendas = datos.lineas.reduce(
    (total, linea) => total + linea.precioUnitarioConIva * linea.cantidad,
    0,
  );
  const factor =
    datos.subtotalPedido > 0
      ? Math.max(0, 1 - datos.descuentoPedido / datos.subtotalPedido)
      : 1;
  const envio = motivoConEnvio(datos.motivo) ? datos.envioPedido : 0;
  return Math.round((prendas * factor + envio) * 100) / 100;
}
