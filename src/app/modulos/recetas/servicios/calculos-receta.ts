import type {
  CosteoReceta,
  DisenoBordado,
  LineaReceta,
  MaterialCatalogo,
  Receta,
} from '../modelos/receta';

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

/** Fórmula de §7.5: neta × factor ÷ (1 − merma/100). */
export function cantidadBruta(cantidadNeta: number, factor: number, mermaPct: number): number {
  if (mermaPct >= 100) {
    return 0;
  }
  return Math.round((cantidadNeta * factor) / (1 - mermaPct / 100) * 1e4) / 1e4;
}

export function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

/**
 * Costeo de §7.5. El empaque se toma de las reglas POR_PRENDA del catálogo de
 * materiales (M15); el resto se captura en la propia receta.
 */
export function costear(
  receta: Receta,
  materiales: MaterialCatalogo[],
  empaquePorPrenda: number,
  disenos: readonly DisenoBordado[] = [],
): CosteoReceta {
  const porCodigo = new Map(materiales.map((material) => [material.codigo, material]));
  const consumoMateriales = receta.lineas.reduce((suma, linea) => {
    const material = porCodigo.get(linea.materialCodigo);
    return material ? suma + linea.cantidadBruta * material.costoBase : suma;
  }, 0);

  /** §7.5: el hilo de cada diseño digitalizado se multiplica por las aplicaciones. */
  const hiloBordado = receta.bordados.reduce((suma, bordado) => {
    const diseno = disenos.find((item) => item.id === bordado.disenoId);
    if (!diseno || diseno.estado !== 'DIGITALIZADO') {
      return suma;
    }
    return (
      suma +
      diseno.hilos.reduce((subtotal, hilo) => {
        const material = porCodigo.get(hilo.materialCodigo);
        return material
          ? subtotal + hilo.metrosPorAplicacion * bordado.aplicaciones * material.costoBase
          : subtotal;
      }, 0)
    );
  }, 0);

  const materiaPrima = consumoMateriales + hiloBordado;
  const costoEstandar =
    materiaPrima + empaquePorPrenda + receta.manoObra + receta.costoBordado + receta.costosIndirectos;
  const precioSugerido =
    costoEstandar / (1 - MARGEN_OBJETIVO_PCT / 100) * (1 + IVA_PCT / 100);

  return {
    materiaPrima: redondear(materiaPrima),
    hiloBordado: redondear(hiloBordado),
    empaque: redondear(empaquePorPrenda),
    manoObra: redondear(receta.manoObra),
    bordado: redondear(receta.costoBordado),
    indirectos: redondear(receta.costosIndirectos),
    costoEstandar: redondear(costoEstandar),
    precioSugerido: redondear(precioSugerido),
    margenObjetivo: MARGEN_OBJETIVO_PCT,
  };
}

/** Margen real = (precio / 1.16 − costo) ÷ (precio / 1.16). */
export function margenReal(precio: number, costo: number): number | null {
  if (precio <= 0) {
    return null;
  }
  const base = precio / (1 + IVA_PCT / 100);
  return redondear(((base - costo) / base) * 100, 1);
}

/**
 * "Alcanza para N prendas": el material con menor cobertura limita el cálculo.
 * El inventario es una lectura de demostración de M15.
 */
export function prendasPosibles(
  receta: Receta,
  inventario: Record<string, number>,
): number | null {
  const coberturas = receta.lineas
    .filter((linea) => linea.cantidadBruta > 0)
    .map((linea) => Math.floor((inventario[linea.materialCodigo] ?? 0) / linea.cantidadBruta));
  return coberturas.length === 0 ? null : Math.min(...coberturas);
}
