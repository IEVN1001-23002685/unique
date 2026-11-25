import type { LineaReceta } from '../modelos/receta';

/** Parámetros de §11.5 del documento; IVA y margen objetivo son datos del sistema. */
export const IVA_PCT = 16;
export const MARGEN_OBJETIVO_PCT = 55;

/** Factores de conversión de la unidad de captura a la unidad base. */
const FACTORES_BASE: Record<LineaReceta['unidadCaptura'], number> = {
  cm2: 0.0001,
  cm: 0.01,
  m2: 1,
  m: 1,
  g: 1,
  pieza: 1,
};

export function convertirABase(valor: number, unidad: LineaReceta['unidadCaptura']): number {
  return Math.round(valor * FACTORES_BASE[unidad] * 1e6) / 1e6;
}

export function convertirDeBase(valor: number, unidad: LineaReceta['unidadCaptura']): number {
  const factor = FACTORES_BASE[unidad];
  return factor === 0 ? 0 : Math.round((valor / factor) * 1e6) / 1e6;
}

export function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}
