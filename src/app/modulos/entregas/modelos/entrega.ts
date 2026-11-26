/** Modelos de interfaz de M19 · Entregas (§6 y §7 del documento UNIQUE v3.0). */
/** No son entidades MySQL: solo tipan lo que muestra y manipula el frontend. */

export type EstadoEntrega = 'PROGRAMADA' | 'EN_RUTA' | 'ENTREGADA' | 'FALLIDA' | 'CANCELADA';

export type MotivoFallo = 'AUSENTE' | 'DIRECCION_INCORRECTA' | 'RECHAZADO' | 'OTRO';

export type DecisionAlerta = 'REPROGRAMADA' | 'CANCELADA_REEMBOLSO' | null;

export type PrioridadEntrega = 'NORMAL' | 'ALTA';

/** Proyección de lectura de venta_direccion (M05/M08). M19 no la modifica. */
export interface DireccionEntrega {
  destinatario: string;
  calle: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  telefono: string;
}

/** Catálogo del Administrador. Sin eliminación física mientras haya entregas. */
export interface Repartidor {
  id: number;
  nombre: string;
  telefono: string;
  vehiculo: string | null;
  activo: boolean;
  eliminadoEn: string | null;
}

export interface LineaEntrega {
  sku: string;
  nombreProducto: string;
  talla: string;
  color: string;
  cantidad: number;
}

/** El folio es la guía rastreable EN-AAAA-NNNNNN que ve el cliente en M06. */
export interface Entrega {
  id: number;
  folio: string;
  pedidoFolio: string;
  ventaFolio: string;
  cliente: string;
  prioridad: PrioridadEntrega;
  direccion: DireccionEntrega;
  repartidorId: number;
  intento: number;
  estado: EstadoEntrega;
  fechaProgramada: string;
  salidaEn: string | null;
  resultadoEn: string | null;
  receptor: string | null;
  motivoFallo: MotivoFallo | null;
  notas: string | null;
  decision: DecisionAlerta;
  lineas: LineaEntrega[];
}

export interface DatosAsignacion {
  pedidoFolio: string;
  repartidorId: number;
  fechaProgramada: string;
  notas: string;
}

export interface DatosEntregado {
  receptor: string;
  notas: string;
}

export interface DatosFallida {
  motivoFallo: MotivoFallo;
  notas: string;
}

export interface DatosRepartidor {
  nombre: string;
  telefono: string;
  vehiculo: string;
}

export interface ProductoRepartido {
  sku: string;
  nombreProducto: string;
  talla: string;
  color: string;
  cantidad: number;
  pedidos: string[];
  repartidorId: number;
  repartidor: string;
  fechaProgramada: string;
}

export interface ResultadoOperacion {
  ok: boolean;
  mensaje: string;
  folio?: string;
}

export const ETIQUETAS_ESTADO_ENTREGA: Record<EstadoEntrega, string> = {
  PROGRAMADA: 'Programada',
  EN_RUTA: 'En ruta',
  ENTREGADA: 'Entregada',
  FALLIDA: 'Fallida',
  CANCELADA: 'Cancelada',
};

export const ETIQUETAS_MOTIVO_FALLO: Record<MotivoFallo, string> = {
  AUSENTE: 'Ausente',
  DIRECCION_INCORRECTA: 'Dirección incorrecta',
  RECHAZADO: 'Rechazado',
  OTRO: 'Otro',
};

export const MOTIVOS_FALLO = Object.keys(ETIQUETAS_MOTIVO_FALLO) as MotivoFallo[];
