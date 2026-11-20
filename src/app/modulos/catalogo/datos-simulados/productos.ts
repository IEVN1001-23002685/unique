import type { IProducto } from '../../../nucleo/modelos/producto';

/**
 * DATO TEMPORAL (mock).
 * Textos, precios y categorías transcritos de los mockups aprobados
 * (catálogo principal y detalle de producto). Sustituir con la API en Flask.
 */
export const PRODUCTOS_SIMULADOS: IProducto[] = [
  {
    id: 1,
    slug: 'hoodie-roja',
    nombre: 'HOODIE ROJA',
    descripcion: 'Barnesmith Sudadera con capucha, unisex.',
    descripcionDetalle:
      'Barnesmith Sudadera con capucha, unisex, mezcla de algodón/poliéster, logotipo de Heritage',
    precio: 850,
    categoria: 'Sudaderas',
    imagen: 'images/productos/hoodie-roja.png',
    etiqueta: 'Más buscado',
  },
  {
    id: 2,
    slug: 'playera-gris',
    nombre: 'PLAYERA GRIS',
    descripcion: 'de Manga 3/4 Camiseta Unisex Adulto',
    precio: 280,
    categoria: 'Playeras',
    imagen: 'images/productos/playera-gris.png',
  },
  {
    id: 3,
    slug: 'pants-cafe',
    nombre: 'PANTS CAFE',
    descripcion: 'Pantalones deportivos holgados unisex, de forro polar, cintura con cordón',
    precio: 500,
    categoria: 'Pantalones',
    imagen: 'images/productos/pants-cafe.png',
  },
  {
    id: 4,
    slug: 'gorro-blanco',
    nombre: 'GORRO BLANCO',
    descripcion: 'Gorro de invierno unisex',
    precio: 280,
    categoria: 'Gorros',
    imagen: 'images/productos/gorro-blanco.png',
  },
  {
    id: 5,
    slug: 'tote-bag',
    nombre: 'TOTE BAG',
    descripcion: 'Tote Bag Bolsas De Manta Cruda 40 X 35cm',
    precio: 850,
    categoria: 'Bolsas',
    imagen: 'images/productos/tote-bag.png',
  },
];
