/**
 * Catálogo de demostración de M03, derivado de los datos oficiales de §11.1.
 *
 * Las existencias del documento solo se usan para derivar un estado público
 * (Disponible / Pocas unidades / Bajo pedido / Agotado): nunca se muestra el
 * número exacto. Flask/M10 sigue siendo la fuente autoritativa de precio,
 * disponibilidad y publicación.
 */
import {
  IMAGEN_NO_DISPONIBLE,
  PRENDAS_OFICIALES,
  type CodigoColorOficial,
  type CodigoTallaOficial,
} from '../../../nucleo/datos/catalogo-oficial';
import {
  COLORES_CATALOGO,
  type CodigoColorCatalogo,
  type ProductoCatalogo,
  type VarianteCatalogo,
} from '../modelos/catalogo';

/** Parámetros de ejemplo: el documento no fija valores por SKU (§11.5 y §12). */
export const STOCK_MINIMO_DEMO = 5;
export const DIAS_PRODUCCION_ESTANDAR_DEMO = 5;
export const DIAS_ENVIO_DEMO = 2;

/**
 * Configurable en demostración para ejercitar la regla «si no permite bajo
 * pedido, muestra Agotado y bloquea la compra». La publicación de M10 define
 * este valor en producción.
 */
const PERMITE_BAJO_PEDIDO_DEMO: Readonly<Record<number, boolean>> = {
  1: true,
  2: true,
  3: true,
  4: true,
  5: false,
};

const COLORES_OFICIALES: readonly CodigoColorOficial[] = ['BL', 'NG', 'GR'];

function fechaEstimadaDemo(): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + DIAS_PRODUCCION_ESTANDAR_DEMO + DIAS_ENVIO_DEMO);
  return fecha.toISOString().slice(0, 10);
}

function estadoDemo(
  disponible: number,
  permiteBajoPedido: boolean,
): Pick<VarianteCatalogo, 'disponibilidad' | 'bajoPedido' | 'comprable' | 'fechaEstimada'> {
  if (disponible > STOCK_MINIMO_DEMO) {
    return { disponibilidad: 'Disponible', bajoPedido: false, comprable: true };
  }

  if (disponible >= 1) {
    return { disponibilidad: 'Pocas unidades', bajoPedido: false, comprable: true };
  }

  if (permiteBajoPedido) {
    return {
      disponibilidad: 'Bajo pedido',
      bajoPedido: true,
      comprable: true,
      fechaEstimada: fechaEstimadaDemo(),
    };
  }

  return { disponibilidad: 'Agotado', bajoPedido: false, comprable: false };
}

function variantesDemo(prendaId: number, tallas: readonly CodigoTallaOficial[]): VarianteCatalogo[] {
  const prenda = PRENDAS_OFICIALES.find((item) => item.id === prendaId);
  if (!prenda) return [];

  const permiteBajoPedido = PERMITE_BAJO_PEDIDO_DEMO[prendaId] ?? true;
  const variantes: VarianteCatalogo[] = [];

  tallas.forEach((talla) => {
    COLORES_OFICIALES.forEach((color) => {
      const existencia = prenda.existencias[talla]?.[color] ?? 0;
      const detalle = estadoDemo(existencia, permiteBajoPedido);
      const codigoColor = color as CodigoColorCatalogo;

      variantes.push({
        id: variantes.length + 1 + prendaId * 100,
        sku: `${prenda.codigoBase}-${talla}-${color}`,
        colorCodigo: codigoColor,
        colorNombre: COLORES_CATALOGO[codigoColor].nombre,
        talla,
        disponibilidad: detalle.disponibilidad,
        bajoPedido: detalle.bajoPedido,
        comprable: detalle.comprable,
        fechaEstimada: detalle.fechaEstimada,
        imagen: prenda.imagenesPorColor[color] || IMAGEN_NO_DISPONIBLE,
        activa: true,
      });
    });
  });

  return variantes;
}

const MAX_VENDIDOS = Math.max(...PRENDAS_OFICIALES.map((prenda) => prenda.vendidosUltimos30Dias));

/** Productos de ejemplo listos para renderizar; no se envían al servidor. */
export const CATALOGO_EJEMPLO: readonly ProductoCatalogo[] = PRENDAS_OFICIALES.map((prenda) => {
  const masBuscado = prenda.vendidosUltimos30Dias === MAX_VENDIDOS;
  return {
    id: prenda.id,
    slug: prenda.slug,
    nombre: prenda.nombre,
    descripcion: prenda.descripcion,
    descripcionDetalle: prenda.descripcionDetalle,
    precio: prenda.precio,
    categoria: prenda.categoria,
    imagen: prenda.imagen,
    etiqueta: masBuscado ? 'Más buscado' : undefined,
    masBuscado,
    activo: true,
    composicion: prenda.composicion,
    guiaMedidasTexto: prenda.guiaMedidas,
    variantes: variantesDemo(prenda.id, prenda.tallas),
    creadoEn: prenda.creadoEn,
  };
});
