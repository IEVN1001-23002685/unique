import {
  COLORES_OFICIALES,
  PRENDAS_OFICIALES,
  type CodigoColorOficial,
  type CodigoTallaOficial,
} from '../../../nucleo/datos/catalogo-oficial';
import type {
  CodigoColorCatalogo,
  CodigoTallaCatalogo,
  ProductoCatalogo,
  VarianteCatalogo,
} from '../modelos/catalogo';

/**
 * DATOS DE DEMOSTRACIÓN de M03.
 * Se derivan del catálogo oficial (§6.5 y §11): 5 prendas, 3 colores y 33 SKU.
 * Las existencias solo alimentan la etiqueta de disponibilidad; Flask será la
 * fuente autoritativa de precios y existencias definitivos.
 */

const DIAS_PRODUCCION = 5;
const DIAS_ENVIO = 2;
const MINIMO = 5;

/** Colores que no admiten bajo pedido: sin existencia se muestran «Agotado» (regla de M03). */
const SIN_BAJO_PEDIDO: Record<number, CodigoColorOficial[]> = {
  1: ['BL'],
  4: ['NG'],
  5: ['BL'],
};

function nombreColor(codigo: CodigoColorCatalogo): string {
  return COLORES_OFICIALES.find((color) => color.codigo === codigo)?.nombre ?? codigo;
}

function construirVariantes(
  productoId: number,
  prefijo: string,
  tallas: readonly CodigoTallaOficial[],
  imagenes: Record<CodigoColorOficial, string>,
  existencias: Record<string, Partial<Record<CodigoColorOficial, number>>>,
): VarianteCatalogo[] {
  return tallas.flatMap((talla: CodigoTallaCatalogo) =>
    COLORES_OFICIALES.map(({ codigo: color }) => {
      const disponible = existencias[talla]?.[color] ?? 0;
      return {
        // SKU oficial de tres segmentos; nunca se escribe a mano.
        sku: `${prefijo}-${talla}-${color}`,
        colorCodigo: color,
        colorNombre: nombreColor(color),
        talla,
        disponible,
        minimo: MINIMO,
        permiteBajoPedido: !(SIN_BAJO_PEDIDO[productoId] ?? []).includes(color),
        diasProduccion: DIAS_PRODUCCION,
        diasEnvio: DIAS_ENVIO,
        imagen: imagenes[color],
        activa: true,
      };
    }),
  );
}

export const PRODUCTOS_SIMULADOS: ProductoCatalogo[] = PRENDAS_OFICIALES.map((prenda) => ({
  id: prenda.id,
  slug: prenda.slug,
  nombre: prenda.nombre,
  descripcion: prenda.descripcion,
  descripcionDetalle: prenda.descripcionDetalle,
  precio: prenda.precio,
  categoria: prenda.categoria,
  imagen: prenda.imagen,
  activo: true,
  composicion: prenda.composicion,
  vendidosUltimos30Dias: prenda.vendidosUltimos30Dias,
  creadoEn: prenda.creadoEn,
  variantes: construirVariantes(
    prenda.id,
    prenda.codigoBase,
    prenda.tallas,
    prenda.imagenesPorColor,
    prenda.existencias,
  ),
}));
