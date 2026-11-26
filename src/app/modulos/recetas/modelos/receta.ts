import type { CodigoTalla } from '../../productos/modelos/producto-maestro';

/** Modelos de interfaz de M11 · Recetas y bordados, servidos por Flask. */

export type CategoriaMaterial = 'Tela' | 'Hilo' | 'Estabilizador' | 'Avio' | 'Etiqueta' | 'Empaque';

export type UnidadBase = 'm2' | 'm' | 'g' | 'pieza';
export type UnidadCaptura = 'cm2' | 'cm' | 'm2' | 'm' | 'g' | 'pieza';
export type EstadoReceta = 'BORRADOR' | 'VIGENTE' | 'ARCHIVADA';
export type EstadoDiseno = 'PENDIENTE' | 'DIGITALIZADO';

export interface MaterialCatalogo {
  id: number;
  codigo: string;
  nombre: string;
  categoria: CategoriaMaterial;
  unidadBase: UnidadBase;
  costoBase: number;
  /** Merma precargada del material; el editor permite ajustarla por línea. */
  mermaPct: number;
  conColor: boolean;
  presentacion: string;
  /** Regla POR_PRENDA: se suma al empaque de cada prenda. */
  porPrenda: boolean;
}

export interface LineaReceta {
  id: number;
  materialCodigo: string;
  /** Cantidad neta convertida ya a la unidad base del material. */
  cantidadNeta: number;
  unidadCaptura: UnidadCaptura;
  factorConsumo: number;
  mermaPct: number;
  /** Cantidad bruta y costo de línea calculados por Flask. */
  cantidadBruta: number;
  costoLinea?: number;
  esEtiqueta: boolean;
  nota: string;
}

export interface BordadoReceta {
  id: number;
  disenoId: number;
  aplicaciones: number;
  ubicacion: string;
}

export interface EntradaBitacoraReceta {
  id: number;
  fecha: string;
  usuario: string;
  accion: string;
  detalle: string;
}

export interface Receta {
  id: number;
  productoId: number;
  producto?: string;
  talla: CodigoTalla;
  tallaId?: number;
  version: number;
  estado: EstadoReceta;
  origenRecetaId: number | null;
  manoObra: number;
  costoBordado: number;
  costosIndirectos: number;
  nota: string;
  creadaPor: string;
  creadaEn: string;
  activadaEn: string | null;
  precioVenta?: number;
  /** Importes calculados por Flask; ausentes para el rol OPERATIVO. */
  materiaPrima?: number;
  hiloBordado?: number;
  costoEmpaque?: number;
  costoEstandar?: number;
  precioSugerido?: number;
  margenReal?: number;
  lineas: LineaReceta[];
  bordados: BordadoReceta[];
  bitacora: EntradaBitacoraReceta[];
}

export interface HiloDiseno {
  id: number;
  materialCodigo: string;
  metrosPorAplicacion: number;
}

export interface DisenoBordado {
  id: number;
  codigo: string;
  nombre: string;
  anchoCm: number;
  altoCm: number;
  estado: EstadoDiseno;
  notas: string;
  activo: boolean;
  hilos: HiloDiseno[];
}

export interface CosteoReceta {
  /** Incluye el hilo de bordado de los diseños DIGITALIZADOS enlazados (§7.5). */
  materiaPrima: number;
  hiloBordado: number;
  empaque: number;
  manoObra: number;
  bordado: number;
  indirectos: number;
  costoEstandar: number;
  precioSugerido: number;
  margenObjetivo: number;
}

/** Datos editables del editor de receta (sin identificadores generados). */
export interface DatosReceta {
  productoId: number;
  talla: CodigoTalla;
  nota: string;
  manoObra: number;
  costoBordado: number;
  costosIndirectos: number;
  lineas: Array<{
    materialCodigo: string;
    cantidadNeta: number;
    unidadCaptura: UnidadCaptura;
    factorConsumo: number;
    mermaPct: number;
    esEtiqueta: boolean;
    nota: string;
  }>;
  bordados: Array<{ disenoId: number; aplicaciones: number; ubicacion: string }>;
}

export interface DatosDiseno {
  nombre: string;
  anchoCm: number;
  altoCm: number;
  notas: string;
  activo: boolean;
  hilos: Array<{ materialCodigo: string; metrosPorAplicacion: number }>;
}

export interface ResultadoM11 {
  ok: boolean;
  mensaje: string;
  /** Acción no ejecutada porque el contrato Flask aún no la define; se avisa, no se finge éxito. */
  pendiente?: boolean;
  recetaId?: number;
  disenoId?: number;
}

export interface FilaHistorial {
  id: number;
  clave: string;
  descripcion: string;
  detalleA: string;
  detalleB: string;
  estado: 'IGUAL' | 'CAMBIO' | 'NUEVA' | 'ELIMINADA';
}
