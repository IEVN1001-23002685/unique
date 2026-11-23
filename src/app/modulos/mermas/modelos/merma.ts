/**
 * Modelos de interfaz de M17 · Mermas (§6 y §7 del documento UNIQUE v3.0).
 * Solo tipan la UI: no son tablas MySQL ni operaciones persistentes.
 * Los catálogos ajenos (causas de M22, lotes de M15, variantes de M10,
 * órdenes de M16) se consultan mediante servicios; aquí no se copian reglas.
 */

export type OrigenMerma = 'MATERIAL' | 'PRODUCTO';

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

/** Procedencia del registro. Las mermas automáticas llegan de otros módulos. */
export type ProcedenciaMerma = 'MANUAL' | 'M14' | 'M15' | 'M16' | 'M07' | 'M12' | 'REVERSION';

/** Catálogo de causa_merma (M22); en demostración se sirve desde datos simulados. */
export interface CausaMerma {
  id: number;
  nombre: string;
  aplicaA: OrigenMerma | 'AMBOS';
  etapaSugerida: EtapaMerma | null;
  activa: boolean;
}

/** Registro inmutable de merma. Un error se corrige con un reverso, nunca se edita. */
export interface Merma {
  id: number;
  folio: string;
  origen: OrigenMerma;
  procedencia: ProcedenciaMerma;
  automatica: boolean;
  // MATERIAL: material, color y lote (§7).
  materialId: number | null;
  materialCodigo: string | null;
  materialNombre: string | null;
  color: string | null;
  loteId: number | null;
  loteFolio: string | null;
  unidadBase: string;
  // PRODUCTO: variante/SKU generado por M10 (§6.5).
  varianteId: number | null;
  sku: string | null;
  nombreProducto: string | null;
  talla: string | null;
  cantidad: number;
  /** Calculado solo por el sistema: costo del lote o costo estándar de la prenda. */
  costoPerdido: number;
  etapa: EtapaMerma;
  causaId: number;
  causaNombre: string;
  ordenFolio: string | null;
  descripcion: string | null;
  /** Solo se conserva el nombre del archivo: nunca se sube ni se guarda una imagen. */
  evidenciaNombre: string | null;
  registradaPor: string;
  fecha: string;
  esReversion: boolean;
  reversionDeId: number | null;
  motivoReversion: string | null;
}

/** Proyección de solo lectura usada por las tablas. */
export interface MermaVista extends Merma {
  etiquetaItem: string;
  etiquetaProcedencia: string;
  /** Se calcula por la existencia de un reverso; el registro original no se modifica. */
  reversada: boolean;
}

export interface DatosNuevaMerma {
  origen: OrigenMerma;
  materialId: number | null;
  color: string;
  loteId: number | null;
  sku: string;
  cantidad: number;
  etapa: EtapaMerma;
  causaId: number;
  ordenFolio: string;
  descripcion: string;
  evidenciaNombre: string | null;
}

export interface ResultadoRegistro {
  ok: boolean;
  mensaje: string;
  folio?: string;
}

export interface ResultadoAccion {
  ok: boolean;
  mensaje: string;
}

export interface FiltrosZona {
  periodo: string;
  etapa: EtapaMerma | 'TODAS';
  causaId: number | 'TODAS';
  origen: OrigenMerma | 'TODOS';
  producto: string;
  texto: string;
}

export interface OpcionMaterial {
  materialId: number;
  codigo: string;
  nombre: string;
  color: string;
  unidadBase: string;
  etiqueta: string;
}

export interface OpcionLote {
  id: number;
  folio: string;
  color: string;
  costoUnitario: number;
  disponible: number;
  etiqueta: string;
}

export interface OpcionVariante {
  varianteId: number;
  sku: string;
  nombreProducto: string;
  talla: string;
  color: string;
  etiqueta: string;
}

/** Fila reutilizable de las tablas de indicadores. */
export interface FilaIndicador {
  clave: string;
  etiqueta: string;
  cantidad: number;
  cantidadMaterial: number;
  /** Suma con signo: los reversos restan. */
  costoPerdido: number;
  referencia: number;
  porcentaje: number;
  /** 'meta' compara contra 5 %; 'participacion' es una distribución. */
  base: 'meta' | 'participacion';
  superaMeta: boolean;
  unidad: string;
}

export interface AlertaMerma {
  id: string;
  ambito: 'etapa' | 'producto' | 'general';
  etiqueta: string;
  detalle: string;
  porcentaje: number;
}

export interface FilaEvolucion {
  mes: string;
  etiqueta: string;
  cantidadProducto: number;
  cantidadMaterial: number;
  costoPerdido: number;
}

export interface IndicadoresMerma {
  metaPct: number;
  periodo: string;
  mermaProductoPct: number;
  mermaMaterialPct: number;
  referenciaProducto: number;
  referenciaMaterial: number;
  cantidadProducto: number;
  cantidadMaterial: number;
  costoPerdido: number;
  costoPerdidoMes: number;
  totalRegistros: number;
  porEtapa: FilaIndicador[];
  porCausa: FilaIndicador[];
  porProducto: FilaIndicador[];
  porMaterial: FilaIndicador[];
  causasTop5: FilaIndicador[];
  evolucion: FilaEvolucion[];
  alertas: AlertaMerma[];
}

export const META_MERMA_PCT = 5;

export const ETAPAS_MERMA: EtapaMerma[] = [
  'RECEPCION',
  'CORTE',
  'TEJIDO',
  'BORDADO',
  'CONFECCION',
  'ACABADOS',
  'ALMACEN',
  'ENTREGA',
  'DEVOLUCION',
];

export const ETIQUETAS_ETAPA: Record<EtapaMerma, string> = {
  RECEPCION: 'Recepción',
  CORTE: 'Corte',
  TEJIDO: 'Tejido',
  BORDADO: 'Bordado',
  CONFECCION: 'Confección',
  ACABADOS: 'Acabados',
  ALMACEN: 'Almacén',
  ENTREGA: 'Entrega',
  DEVOLUCION: 'Devolución',
};

export const ETIQUETAS_ORIGEN: Record<OrigenMerma, string> = {
  MATERIAL: 'Material',
  PRODUCTO: 'Producto',
};

export const ETIQUETAS_PROCEDENCIA: Record<ProcedenciaMerma, string> = {
  MANUAL: 'Captura manual',
  M14: 'Recepción · M14',
  M15: 'Inventario MP · M15',
  M16: 'Calidad · M16',
  M07: 'Devolución · M07',
  M12: 'Inventario PT · M12',
  REVERSION: 'Reverso · Admin',
};

export const FILTROS_ORIGEN: { clave: OrigenMerma | 'TODOS'; etiqueta: string }[] = [
  { clave: 'TODOS', etiqueta: 'Todos' },
  { clave: 'MATERIAL', etiqueta: 'Material' },
  { clave: 'PRODUCTO', etiqueta: 'Producto' },
];
