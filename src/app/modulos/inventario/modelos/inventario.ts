/**
 * Modelos de interfaz de M15 · Inventario de materia prima (§6 del documento
 * UNIQUE v3.0). Solo tipan la UI: no son tablas MySQL ni operaciones
 * persistentes. Los catálogos ajenos (proveedores, órdenes de compra) se
 * consultan mediante servicios, nunca se copian como reglas propias.
 */

export type CategoriaMaterial = 'Tela' | 'Hilo' | 'Estabilizador' | 'Avío' | 'Etiqueta' | 'Empaque';

export type UnidadBase = 'm²' | 'm' | 'pieza';

export type TonoSemaforo = 'ROJO' | 'AMBAR' | 'VERDE';

export type TipoMovimiento = 'ENTRADA' | 'CONSUMO' | 'MERMA' | 'AJUSTE' | 'SOBRANTE' | 'REVERSA';

/** Catálogo de material del §11.2. `porColor` genera existencias BL, NG y GR. */
export interface Material {
  id: number;
  codigo: string;
  nombre: string;
  categoria: CategoriaMaterial;
  unidadBase: UnidadBase;
  unidadCompra: string;
  factorCompraBase: number;
  presentacion: string;
  costoEstandarBase: number;
  mermaEstandarPct: number;
  porColor: boolean;
  /** Plazo del proveedor principal, leído de M13; null cuando aún no hay cobertura. */
  plazoDias: number | null;
  activo: boolean;
  /** Id del catálogo M22, necesario para dar de alta un material desde M15. */
  categoriaMaterialId?: number;
}

/** Un registro por material y color (color «NA» cuando no aplica). */
export interface Existencia {
  id: number;
  materialId: number;
  color: string;
  fisico: number;
  reservado: number;
  enCompra: number;
  stockMinimo: number;
  stockSeguridad: number;
  consumoDiarioManual: number;
  /** Falso cuando una orden confirmada no queda cubierta; ausente si Flask no lo informa. */
  cubreOrdenConfirmada?: boolean;
  activo: boolean;
  /** Métricas calculadas por Flask; se prefieren sobre cualquier cálculo local. */
  plazoDiasApi?: number | null;
  consumoDiarioApi?: number;
  puntoReordenApi?: number | null;
  coberturaDiasApi?: number | null;
  posicionApi?: number;
  semaforoApi?: TonoSemaforo;
}

/** Proyección calculada en el servicio; nunca se persiste. */
export interface ExistenciaVista extends Existencia {
  material: Material;
  disponible: number;
  posicion: number;
  consumoDiario: number;
  puntoReorden: number;
  coberturaDias: number | null;
  semaforo: TonoSemaforo;
  motivoSemaforo: string;
  /** Sin punto de reorden de Flask ni plazo de Flask/M13: no se inventa un número. */
  plazoPendiente: boolean;
  requisicionAbierta: boolean;
  requiereAtencion: boolean;
}

export interface LoteMaterial {
  id: number;
  folio: string;
  materialId: number;
  color: string;
  proveedorId: number;
  fechaEntrada: string;
  cantidadRecibida: number;
  cantidadDisponible: number;
  costoUnitario: number;
  medidas: string;
  estado: 'DISPONIBLE' | 'AGOTADO';
}

/** Los movimientos solo se agregan: no se editan ni se eliminan. */
export interface MovimientoMaterial {
  id: number;
  fecha: string;
  materialId: number;
  color: string;
  loteFolio: string | null;
  tipo: TipoMovimiento;
  cantidadBase: number;
  costoUnitario: number;
  documento: string;
  motivo: string;
  usuario: string;
}

export interface FiltrosKardex {
  materialId: number;
  color: string;
  loteFolio: string;
  tipo: TipoMovimiento | 'TODOS';
  desde: string;
  hasta: string;
}

export interface DatosAjuste {
  existenciaId: number;
  cantidadContada: number;
  motivo: string;
  enviarAMerma: boolean;
}

export interface MermaAjuste {
  materialId: number;
  color: string;
  cantidadBase: number;
  unidadBase: UnidadBase;
  causa: string;
  etapa: 'ALMACEN';
}

export interface ResultadoAjuste {
  /** null cuando Flask aceptó el ajuste pero el detalle aún no aparece en el kardex. */
  movimiento: MovimientoMaterial | null;
  diferencia: number;
  loteAfectado: string | null;
  merma: MermaAjuste | null;
}

export interface CambioPolitica {
  existenciaId: number;
  stockMinimo: number;
  stockSeguridad: number;
  consumoDiarioManual: number;
}

export const CATEGORIAS: CategoriaMaterial[] = [
  'Tela',
  'Hilo',
  'Estabilizador',
  'Avío',
  'Etiqueta',
  'Empaque',
];

/** Etiquetas legibles de BL, NG y GR (§11.2). */
export const COLORES_CON_MATERIAL = ['Blanco', 'Negro', 'Gris'];

/** Catálogo de motivos de ajuste (etapa ALMACÉN para la futura M17). */
export const MOTIVOS_AJUSTE = [
  'Conteo físico programado',
  'Defecto de tela detectado en almacén',
  'Daño en almacén',
  'Error de corte',
  'Sobrante inservible',
  'Encogimiento o desgaste',
] as const;
