import type {
  CodigoColorCatalogo,
  CodigoTallaCatalogo,
  ProductoCatalogo,
  VarianteCatalogo,
} from '../modelos/catalogo';

/**
 * DATO TEMPORAL (mock) de M03.
 * Los 5 productos y sus 33 SKU siguen las semillas del documento (§11):
 * 27 variantes con talla y 6 de talla única. Las existencias solo alimentan
 * la etiqueta de disponibilidad; nunca se muestran como número exacto.
 */

type Existencias = Partial<
  Record<CodigoTallaCatalogo, Partial<Record<CodigoColorCatalogo, number>>>
>;

const COLORES: CodigoColorCatalogo[] = ['BL', 'NG', 'GR'];
const DIAS_PRODUCCION = 5;
const DIAS_ENVIO = 2;
const MINIMO = 5;

function nombreColor(color: CodigoColorCatalogo): string {
  return color === 'BL' ? 'Blanco' : color === 'NG' ? 'Negro' : 'Gris';
}

function construirVariantes(
  prefijo: string,
  tallas: CodigoTallaCatalogo[],
  imagenes: Record<CodigoColorCatalogo, string>,
  existencias: Existencias,
  sinBajoPedido: CodigoColorCatalogo[] = [],
): VarianteCatalogo[] {
  return tallas.flatMap((talla) =>
    COLORES.map((color) => {
      const disponible = existencias[talla]?.[color] ?? 0;
      return {
        // SKU de tres segmentos; lo genera el sistema y nunca se escribe a mano.
        sku: `${prefijo}-${talla}-${color}`,
        colorCodigo: color,
        colorNombre: nombreColor(color),
        talla,
        disponible,
        minimo: MINIMO,
        permiteBajoPedido: !sinBajoPedido.includes(color),
        diasProduccion: DIAS_PRODUCCION,
        diasEnvio: DIAS_ENVIO,
        imagen: imagenes[color],
        activa: true,
      };
    }),
  );
}

export const PRODUCTOS_SIMULADOS: ProductoCatalogo[] = [
  {
    id: 1,
    slug: 'hoodie-roja',
    nombre: 'HOODIE',
    descripcion: 'Barnesmith Sudadera con capucha, unisex.',
    descripcionDetalle:
      'Barnesmith Sudadera con capucha, unisex, mezcla de algodón/poliéster, logotipo de Heritage',
    precio: 850,
    categoria: 'Sudaderas',
    imagen: 'images/productos/hoodie-roja.png',
    activo: true,
    composicion: '80% algodón, 20% poliéster',
    vendidosUltimos30Dias: 128,
    creadoEn: '2026-10-18',
    variantes: construirVariantes(
      'SD',
      ['CH', 'MD', 'GD'],
      {
        BL: '/prendas/sudadera/Sudaderablanca.png',
        NG: '/prendas/sudadera/Sudaderanegra.png',
        GR: '/prendas/sudadera/Sudaderagris.png',
      },
      {
        CH: { BL: 18, NG: 4, GR: 0 },
        MD: { BL: 12, NG: 0, GR: 3 },
        GD: { BL: 0, NG: 7, GR: 2 },
      },
      ['BL'],
    ),
  },
  {
    id: 2,
    slug: 'playera-gris',
    nombre: 'PLAYERA GRIS',
    descripcion: 'de Manga 3/4 Camiseta Unisex Adulto',
    precio: 280,
    categoria: 'Playeras',
    imagen: 'images/productos/playera-gris.png',
    activo: true,
    composicion: '100% algodón',
    vendidosUltimos30Dias: 96,
    creadoEn: '2026-09-12',
    variantes: construirVariantes(
      'PL',
      ['CH', 'MD', 'GD'],
      {
        BL: '/prendas/playera/playerablanca.png',
        NG: '/prendas/playera/playeranegra.png',
        GR: '/prendas/playera/playeragris.png',
      },
      {
        CH: { BL: 9, NG: 2, GR: 14 },
        MD: { BL: 0, NG: 16, GR: 3 },
        GD: { BL: 6, NG: 0, GR: 11 },
      },
    ),
  },
  {
    id: 3,
    slug: 'pants-cafe',
    nombre: 'PANTS CAFE',
    descripcion: 'Pantalones deportivos holgados unisex, de forro polar, cintura con cordón',
    precio: 500,
    categoria: 'Pantalones',
    imagen: 'images/productos/pants-cafe.png',
    activo: true,
    composicion: '60% algodón, 40% poliéster',
    vendidosUltimos30Dias: 74,
    creadoEn: '2026-08-05',
    variantes: construirVariantes(
      'PN',
      ['CH', 'MD', 'GD'],
      {
        BL: '/prendas/pantalon/Pantalonblanco.png',
        NG: '/prendas/pantalon/pantalonnegro.png',
        GR: '/prendas/pantalon/pantalongris.png',
      },
      {
        CH: { BL: 3, NG: 8, GR: 0 },
        MD: { BL: 15, NG: 4, GR: 0 },
        GD: { BL: 0, NG: 2, GR: 13 },
      },
    ),
  },
  {
    id: 4,
    slug: 'gorro-blanco',
    nombre: 'GORRO BLANCO',
    descripcion: 'Gorro de invierno unisex',
    precio: 280,
    categoria: 'Gorros',
    imagen: 'images/productos/gorro-blanco.png',
    activo: true,
    composicion: '100% acrílico',
    vendidosUltimos30Dias: 52,
    creadoEn: '2026-07-22',
    variantes: construirVariantes(
      'GO',
      ['UN'],
      {
        BL: '/prendas/Gorro/gorroblanco.png',
        NG: '/prendas/Gorro/Gorronegro.png',
        GR: '/prendas/Gorro/gorrogris.png',
      },
      { UN: { BL: 9, NG: 2, GR: 0 } },
      ['NG'],
    ),
  },
  {
    id: 5,
    slug: 'tote-bag',
    nombre: 'TOTE BAG',
    descripcion: 'Tote Bag Bolsas De Manta Cruda 40 X 35cm',
    precio: 850,
    categoria: 'Bolsas',
    imagen: 'images/productos/tote-bag.png',
    activo: true,
    composicion: '100% manta de algodón',
    vendidosUltimos30Dias: 61,
    creadoEn: '2026-06-30',
    variantes: construirVariantes(
      'BO',
      ['UN'],
      {
        // No hay recurso visual oficial para la bolsa blanca: se usa el respaldo accesible.
        BL: '',
        NG: '/prendas/bolsa%20de%20tela/bolsanegra.png',
        GR: '/prendas/bolsa%20de%20tela/Bolsagris.png',
      },
      { UN: { BL: 0, NG: 6, GR: 1 } },
      ['BL'],
    ),
  },
];
