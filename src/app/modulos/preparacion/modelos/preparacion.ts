/** Modelos de interfaz de M18 · Preparación (§6 y §7 del documento UNIQUE v3.0). */
/** No son entidades MySQL: solo tipan lo que muestra y manipula el frontend. */

export type EstadoPreparacion =
  | 'POR_SURTIR'
  | 'EN_PICKING'
  | 'EN_VERIFICACION'
  | 'EN_EMPAQUE'
  | 'LISTA';

export type PasoPreparacion = 'PICKING' | 'VERIFICACION' | 'EMPAQUE' | 'LISTA';

export type TipoIncidencia = 'SKU' | 'CANTIDAD' | 'CALIDAD';

export type EstadoIncidencia = 'ABIERTA' | 'RESUELTA' | 'PENDIENTE_PRODUCCION';

export type PrioridadPreparacion = 'NORMAL' | 'ALTA';

/** Proyección de lectura de venta_direccion (M05/M08). M18 no la modifica. */
export interface DireccionEntrega {
  destinatario: string;
  calle: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  telefono: string;
}

/** Proyección de lectura de empaque_regla. Nunca expone costos al Operativo. */
export interface ReglaEmpaque {
  materialId: string;
  nombre: string;
  base: 'POR_PRENDA' | 'POR_PEDIDO';
  cantidad: number;
  activa: boolean;
}

export interface ConsumoEmpaque {
  materialId: string;
  nombre: string;
  base: ReglaEmpaque['base'];
  cantidad: number;
  unidad: string;
}

export interface LineaPreparacion {
  id: number;
  sku: string;
  nombreProducto: string;
  talla: string;
  color: string;
  cantidadRequerida: number;
  cantidadSurtida: number;
  skuVerificado: boolean;
  disenoVerificado: boolean;
  etiquetasVerificadas: boolean;
}

export interface Preparacion {
  id: number;
  folio: string;
  pedidoFolio: string;
  ventaFolio: string;
  cliente: string;
  prioridad: PrioridadPreparacion;
  fechaPromesa: string | null;
  estado: EstadoPreparacion;
  tomadaPor: string;
  iniciadaEn: string;
  terminadaEn: string | null;
  notas: string;
  direccion: DireccionEntrega;
  lineas: LineaPreparacion[];
}

export interface Incidencia {
  id: number;
  folio: string;
  preparacionFolio: string;
  pedidoFolio: string;
  sku: string;
  tipo: TipoIncidencia;
  descripcion: string;
  cantidad: number;
  fecha: string;
  usuario: string;
  estado: EstadoIncidencia;
  resolucion: string | null;
}

export interface DatosIncidencia {
  sku: string;
  tipo: TipoIncidencia;
  descripcion: string;
  cantidad: number;
}

export interface ResultadoOperacion {
  ok: boolean;
  mensaje: string;
  folio?: string;
}

export const ETIQUETAS_ESTADO_PREPARACION: Record<EstadoPreparacion, string> = {
  POR_SURTIR: 'Por surtir',
  EN_PICKING: 'Picking',
  EN_VERIFICACION: 'Verificación',
  EN_EMPAQUE: 'Empaque',
  LISTA: 'Lista',
};

export const ETIQUETAS_PASO: Record<PasoPreparacion, string> = {
  PICKING: 'Picking',
  VERIFICACION: 'Verificación',
  EMPAQUE: 'Empaque',
  LISTA: 'Lista',
};

export const PASOS_PREPARACION: PasoPreparacion[] = [
  'PICKING',
  'VERIFICACION',
  'EMPAQUE',
  'LISTA',
];

export const ETIQUETAS_TIPO_INCIDENCIA: Record<TipoIncidencia, string> = {
  SKU: 'Diferencia de SKU',
  CANTIDAD: 'Diferencia de cantidad',
  CALIDAD: 'Calidad',
};

export const ETIQUETAS_ESTADO_INCIDENCIA: Record<EstadoIncidencia, string> = {
  ABIERTA: 'Abierta',
  RESUELTA: 'Resuelta',
  PENDIENTE_PRODUCCION: 'Vuelve a producción',
};
