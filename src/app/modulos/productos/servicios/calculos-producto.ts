import { IVA_OFICIAL_PCT, redondearDos } from '../../../nucleo/datos/catalogo-oficial';
import type { DesgloseCosteo, LineaMaterialProducto, ParametrosCosteo } from '../modelos/producto-maestro';

/** Límite de merma para evitar divisiones por cero o costos sin sentido. */
const MERMA_MAXIMA_PCT = 90;

/**
 * Desglose reactivo del precio de venta (§7.5 del documento):
 * materia prima + empaque por prenda + mano de obra + bordado + indirectos,
 * y precio sugerido = costo ÷ (1 − margen objetivo) × 1.16.
 *
 * Es una vista previa en memoria. El cálculo autoritativo lo hará Flask con
 * las recetas VIGENTES de M11 y las reglas de empaque de M15.
 */
export function calcularCosteo(parametros: ParametrosCosteo): DesgloseCosteo {
  const errores = validarParametros(parametros);

  const materiaPrima = parametros.lineas
    .filter((linea) => !linea.porPrenda)
    .reduce((suma, linea) => {
      if (linea.cantidad <= 0 || linea.mermaPct >= 100) {
        return suma;
      }
      return suma + (linea.cantidad / (1 - linea.mermaPct / 100)) * linea.costoBase;
    }, 0);

  const empaque = parametros.lineas
    .filter((linea) => linea.porPrenda)
    .reduce((suma, linea) => suma + linea.cantidad * linea.costoBase, 0);

  const manoObra = Math.max(0, parametros.manoObra);
  const bordado = Math.max(0, parametros.bordado);
  const indirectos = Math.max(0, parametros.indirectos);
  const costoTotal = materiaPrima + empaque + manoObra + bordado + indirectos;

  const margen = Math.min(Math.max(parametros.margenObjetivoPct, 0), 95) / 100;
  const precioSinIva = costoTotal / (1 - margen);
  const iva = precioSinIva * (IVA_OFICIAL_PCT / 100);
  const margenReal =
    precioSinIva > 0 ? redondearDos(((precioSinIva - costoTotal) / precioSinIva) * 100) : null;

  return {
    materiaPrima: redondearDos(materiaPrima),
    empaque: redondearDos(empaque),
    manoObra: redondearDos(manoObra),
    bordado: redondearDos(bordado),
    indirectos: redondearDos(indirectos),
    costoTotal: redondearDos(costoTotal),
    precioSinIva: redondearDos(precioSinIva),
    iva: redondearDos(iva),
    precioConIva: redondearDos(precioSinIva + iva),
    margenReal,
    errores,
  };
}

/** Validaciones de presentación: evitan duplicados confusos y porcentajes incoherentes. */
export function validarParametros(parametros: ParametrosCosteo): string[] {
  const errores: string[] = [];
  const vistos = new Set<number>();

  for (const linea of parametros.lineas) {
    if (vistos.has(linea.materialId)) {
      errores.push(`El material «${linea.nombre}» está repetido. Selecciónalo una sola vez.`);
    }
    vistos.add(linea.materialId);

    if (linea.cantidad <= 0) {
      errores.push(`La cantidad de «${linea.nombre}» debe ser mayor a cero.`);
    }
    if (linea.mermaPct < 0 || linea.mermaPct > MERMA_MAXIMA_PCT) {
      errores.push(`La merma de «${linea.nombre}» debe estar entre 0 % y ${MERMA_MAXIMA_PCT} %.`);
    }
    if (linea.porcentaje < 0 || linea.porcentaje > 100) {
      errores.push(`El porcentaje de «${linea.nombre}» debe estar entre 0 % y 100 %.`);
    }
  }

  const telas = parametros.lineas.filter((linea) => linea.categoria === 'Tela');
  if (telas.length > 0) {
    const total = redondearDos(telas.reduce((suma, linea) => suma + linea.porcentaje, 0));
    if (total !== 100) {
      errores.push(`La composición de telas debe sumar 100 % (actualmente ${total} %).`);
    }
  }

  if (parametros.manoObra < 0 || parametros.bordado < 0 || parametros.indirectos < 0) {
    errores.push('Mano de obra, bordado e indirectos no pueden ser negativos.');
  }
  if (parametros.margenObjetivoPct < 1 || parametros.margenObjetivoPct > 90) {
    errores.push('El margen objetivo debe estar entre 1 % y 90 %.');
  }

  return errores;
}

/** Suma de porcentajes de las telas, para la barra de composición de la interfaz. */
export function porcentajeTelas(lineas: LineaMaterialProducto[]): number {
  return redondearDos(
    lineas
      .filter((linea) => linea.categoria === 'Tela')
      .reduce((suma, linea) => suma + linea.porcentaje, 0),
  );
}
