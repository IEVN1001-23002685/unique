/**
 * Modelos de interfaz de M16 · Producción (§6 del documento UNIQUE v3.0).
 * Solo tipan la UI: no son tablas MySQL ni operaciones persistentes.
 * Las recetas, existencias, compras y pedidos ajenos se consultan mediante
 * servicios de otros módulos; aquí nunca se copian sus reglas de negocio.
 */

export type TonoSemaforo = 'VERDE' | 'AMBAR' | 'ROJO';

export type EstadoOrden =
  'PLANEADA' | 'LISTA' | 'EN_PROCESO' | 'EN_REVISION' | 'CERRADA' | 'CANCELADA';

export type OrigenOrden = 'PEDIDO' | 'STOCK_MINIMO' | 'MANUAL';

export type EstadoMaterial = 'COMPLETO' | 'PARCIAL' | 'FALTANTE';

/** Etapas de merma documentadas en M16/M17 (sin cuarentena). */
export type EtapaMerma = 'CORTE' | 'TEJIDO' | 'BORDADO' | 'CONFECCION' | 'ACABADOS' | 'ALMACEN';

export interface LineaOrden {
  id: number;
  /** SKU generado por M10; nunca se edita en este módulo. */
  sku: string;
  nombreProducto: string;
  talla: string;
  color: string;
  /** Unidades enteras. */
  cantidadPlaneada: number;
  cantidadAprobada: number;
  cantidadMerma: number;
  cantidadReproceso: number;
}

/** orden_material: explosión de la receta copiada, sumada por material y color. */
export interface MaterialOrden {
  id: number;
  materialId: number;
  nombreMaterial: string;
  color: string;
  unidadBase: string;
  cantidadRequerida: number;
  cantidadReservada: number;
  cantidadConsumida: number;
}

export interface OrdenProduccion {
  id: number;
  folio: string;
  origen: OrigenOrden;
  estado: EstadoOrden;
  /** Semáforo calculado por Flask a partir de faltantes, compras y fechas. */
  semaforo: TonoSemaforo;
  fechaRequerida: string | null;
  iniciadaEn: string | null;
  cerradaEn: string | null;
  creadaPor: string;
  notas: string | null;
  lineas: LineaOrden[];
  materiales: MaterialOrden[];
}

/** Cobertura de compra de M14 para un material faltante. */
export type CoberturaCompra = 'REQUISICION' | 'ORDEN_COMPRA' | 'RETRASADA' | 'NINGUNA';

export interface MaterialOrdenVista extends MaterialOrden {
  /** Disponible leído de M15 (físico − reservado); 0 si no hay registro para el color. */
  disponibleM15: number;
  /** Requerido menos reservado: lo que no pudo apartarse. */
  faltante: number;
  estadoMaterial: EstadoMaterial;
  /** Semáforo del material, con la misma regla que la orden. */
  semaforo: TonoSemaforo;
  cobertura: CoberturaCompra;
  etiquetaCobertura: string;
}

export interface OrdenVista extends Omit<OrdenProduccion, 'materiales'> {
  materiales: MaterialOrdenVista[];
  unidadesPlaneadas: number;
  unidadesAprobadas: number;
  unidadesMerma: number;
  materialesCompletos: number;
  vencida: boolean;
  motivoSemaforo: string;
  /** Unidades aprobadas ÷ planeadas × 100. */
  cumplimientoPct: number;
  /** Unidades en merma ÷ (aprobadas + merma) × 100. */
  mermaRealPct: number;
  semaforo: TonoSemaforo;
}

export interface LineaDictamen {
  lineaId: number;
  sku: string;
  medidasOk: boolean;
  costurasOk: boolean;
  bordadoOk: boolean;
  etiquetasOk: boolean;
  cantidadRevisada: number;
  cantidadAprobada: number;
  cantidadReproceso: number;
  cantidadMerma: number;
  causaMerma: string;
  etapaMerma: EtapaMerma;
}

/** Vista previa de revision_calidad; el historial definitivo lo conserva Flask. */
export interface RevisionCalidad {
  id: number;
  folio: string;
  ordenId: number;
  ordenFolio: string;
  fecha: string;
  revisadaPor: string;
  lineas: LineaDictamen[];
}

/** Variante obtenida por contrato de M10, con respaldo de M09 cuando hace falta. */
export interface OpcionVariante {
  varianteId: number;
  sku: string;
  nombreProducto: string;
  talla: string;
  color: string;
  origen: 'M10' | 'M09';
}

export interface LineaNuevaOrden {
  varianteId: number;
  sku: string;
  nombreProducto: string;
  cantidad: number;
}

export interface DatosNuevaOrden {
  lineas: LineaNuevaOrden[];
  fechaRequerida: string | null;
  notas: string;
}

export interface FaltanteCompra {
  materialId: number;
  nombreMaterial: string;
  color: string;
  unidadBase: string;
  faltante: number;
  tieneRequisicion: boolean;
  tieneOrdenCompra: boolean;
  ordenRetrasada: boolean;
}

export interface FilaPlanSugerido {
  sku: string;
  nombreProducto: string;
  talla: string;
  color: string;
  disponible: number;
  minimo: number;
  pendientePedidos: number;
  pedidos: string[];
  produccionEnCurso: number;
  pendienteNoCubierto: number;
  cantidadReposicion: number;
  cantidadSugerida: number;
  ordenAbiertaFolio: string | null;
  varianteId?: number;
}

export interface ResultadoAccion {
  ok: boolean;
  mensaje: string;
}

export interface ResultadoReserva extends ResultadoAccion {
  materialesReservados: number;
  materialesCompletos: number;
}

export interface ResultadoCrearOrden extends ResultadoAccion {
  folio?: string;
}

export type FiltroTablero =
  'TODAS' | 'ROJAS' | 'AMBAR' | 'VERDES' | 'EN_PROCESO' | 'EN_REVISION' | 'CERRADAS';

export interface OpcionFiltro {
  clave: FiltroTablero;
  etiqueta: string;
}

/** Referencia local de la receta vigente copiada por Flask al crear la orden. */
export interface RecetaMaterialCopia {
  materialId: number;
  /** null = se toma el color del SKU; en avíos y etiquetas se usa NA. */
  color: string | null;
  /** Incluye la merma estándar de la receta, en unidad base por prenda. */
  cantidadBrutaPorUnidad: number;
  descripcion: string;
}

export interface RecetaCopiada {
  familia: string;
  nombre: string;
  materiales: RecetaMaterialCopia[];
}

export const FILTROS_TABLERO: OpcionFiltro[] = [
  { clave: 'TODAS', etiqueta: 'Todas' },
  { clave: 'ROJAS', etiqueta: 'Rojas' },
  { clave: 'AMBAR', etiqueta: 'Ámbar' },
  { clave: 'VERDES', etiqueta: 'Verdes' },
  { clave: 'EN_PROCESO', etiqueta: 'En proceso' },
  { clave: 'EN_REVISION', etiqueta: 'En revisión' },
  { clave: 'CERRADAS', etiqueta: 'Cerradas' },
];

export const ETAPAS_MERMA: EtapaMerma[] = [
  'CORTE',
  'TEJIDO',
  'BORDADO',
  'CONFECCION',
  'ACABADOS',
  'ALMACEN',
];

export const ETIQUETAS_ESTADO: Record<EstadoOrden, string> = {
  PLANEADA: 'Planeada',
  LISTA: 'Lista',
  EN_PROCESO: 'En proceso',
  EN_REVISION: 'En revisión',
  CERRADA: 'Cerrada',
  CANCELADA: 'Cancelada',
};

export const ETIQUETAS_ORIGEN: Record<OrigenOrden, string> = {
  PEDIDO: 'Pedido',
  STOCK_MINIMO: 'Stock mínimo',
  MANUAL: 'Manual',
};

export const ETIQUETAS_TONO: Record<TonoSemaforo, string> = {
  VERDE: 'Verde',
  AMBAR: 'Ámbar',
  ROJO: 'Rojo',
};

export const ETIQUETAS_ESTADO_MATERIAL: Record<EstadoMaterial, string> = {
  COMPLETO: 'Completo',
  PARCIAL: 'Parcial',
  FALTANTE: 'Faltante',
};

export const ETIQUETAS_ETAPA_MERMA: Record<EtapaMerma, string> = {
  CORTE: 'Corte',
  TEJIDO: 'Tejido',
  BORDADO: 'Bordado',
  CONFECCION: 'Confección',
  ACABADOS: 'Acabados',
  ALMACEN: 'Almacén',
};
