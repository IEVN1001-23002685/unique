/**
 * Modelos de interfaz de M21 · Centro de alertas (§6 y §7 del documento
 * UNIQUE v3.0). No son entidades MySQL: tipan la proyección que se muestra en
 * pantalla. La persistencia, la clave única y las acciones reales son de Flask.
 */

export type TipoAlertaCentro =
  | 'PT_AGOTADO_DEMANDA'
  | 'PT_STOCK_MINIMO'
  | 'MP_INSUFICIENTE'
  | 'MP_REORDEN'
  | 'ORDEN_ROJA'
  | 'OC_RETRASADA'
  | 'PEDIDO_ESTANCADO'
  | 'MERMA_ALTA'
  | 'DIFERENCIA_CONTEO'
  | 'ENTREGA_FALLIDA'
  | 'DEVOLUCION_PENDIENTE'
  | 'PAGO_PENDIENTE'
  | 'PROVEEDOR_EN_REVISION'
  | 'DISENO_PENDIENTE';

export type SeveridadAlerta = 'INFORMATIVA' | 'PREVENTIVA' | 'CRITICA';
export type EstadoAlertaCentro = 'ABIERTA' | 'ATENDIDA' | 'RESUELTA_AUTO';
export type RolDestinoAlerta = 'ADMIN' | 'OPERATIVO' | 'AMBOS';
export type RolVistaAlertas = 'Administrador' | 'Operativo';
export type FiltroSeveridad = 'TODAS' | SeveridadAlerta;

/** Espejo de la entidad `alerta`: entidad_tipo y entidad_id son referencia lógica. */
export interface AlertaCentro {
  id: string;
  tipo: TipoAlertaCentro;
  severidad: SeveridadAlerta;
  titulo: string;
  detalle: string;
  entidadTipo: string;
  entidadId: string;
  rolDestino: RolDestinoAlerta;
  accionSugerida: string | null;
  estado: EstadoAlertaCentro;
  /** UQ mientras está abierta; se libera al cerrar para permitir reapertura. */
  claveUnica: string | null;
  abiertaEn: string;
  atendidaPor: string | null;
  atendidaEn: string | null;
  ruta: string[];
  origen: string;
  /** true cuando el módulo de origen aún no existe en este frontend. */
  demo: boolean;
}

/** Catálogo del §7: condición, destinatario y botón de acción por tipo. */
export interface RegistroTipoAlerta {
  tipo: TipoAlertaCentro;
  severidadBase: SeveridadAlerta;
  condicion: string;
  paraQuien: RolDestinoAlerta;
  accion: string;
  origen: string;
  nota?: string;
}

/** Parámetro del §11.5 que dispara o gradúa una alerta. */
export interface ReglaAlerta {
  clave: string;
  etiqueta: string;
  valor: number;
  unidad: string;
  descripcion: string;
  propuesta: boolean;
  min: number;
  max: number;
}

export interface ResultadoRegla {
  ok: boolean;
  mensaje: string;
}

export const ETIQUETAS_SEVERIDAD: Record<SeveridadAlerta, string> = {
  CRITICA: 'Crítica',
  PREVENTIVA: 'Preventiva',
  INFORMATIVA: 'Informativa',
};

export const ETIQUETAS_ESTADO_ALERTA: Record<EstadoAlertaCentro, string> = {
  ABIERTA: 'Abierta',
  ATENDIDA: 'Atendida',
  RESUELTA_AUTO: 'Resuelta automáticamente',
};

export const ETIQUETAS_ROL_DESTINO: Record<RolDestinoAlerta, string> = {
  ADMIN: 'Administrador',
  OPERATIVO: 'Operativo',
  AMBOS: 'Admin y Operativo',
};

export interface ContadoresSeveridad {
  todas: number;
  criticas: number;
  preventivas: number;
  informativas: number;
}

const formatoFecha = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function fechaLegible(iso: string): string {
  return formatoFecha.format(new Date(iso));
}

/** Tiempo que la alerta lleva abierta, con la misma escala que M09. */
export function tiempoAbierta(iso: string, ahora: number): string {
  const horas = Math.max(0, (ahora - new Date(iso).getTime()) / 3_600_000);
  if (horas < 1) {
    return `${Math.max(1, Math.round(horas * 60))} min`;
  }
  if (horas < 48) {
    const minutos = Math.round((horas % 1) * 60);
    return minutos === 0 ? `${Math.floor(horas)} h` : `${Math.floor(horas)} h ${minutos} min`;
  }
  const dias = Math.floor(horas / 24);
  const restantes = Math.floor(horas % 24);
  return restantes === 0 ? `${dias} d` : `${dias} d ${restantes} h`;
}
