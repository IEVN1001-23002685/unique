/**
 * Catálogo oficial de demostración de UNIQUE v3.0 (§6.5, §11.1 y §11.3).
 *
 * Es la única lista de prendas, categorías, colores, tallas y recursos visuales
 * permitidos en la interfaz. Sustituye a los prototipos que mostraban prendas
 * «roja» o «café» y colores fuera del catálogo comercial. Los precios y las
 * existencias son ejemplos de interfaz: Flask será la fuente autoritativa.
 */

export type CodigoColorOficial = 'BL' | 'NG' | 'GR';
export type CodigoTallaOficial = 'CH' | 'MD' | 'GD' | 'UN';

export interface CategoriaOficial {
  id: number;
  nombre: string;
  prefijo: string;
  usaTallas: boolean;
  activa: boolean;
  descripcion: string;
}

export interface PrendaOficial {
  id: number;
  slug: string;
  nombre: string;
  categoria: string;
  categoriaId: number;
  codigoBase: string;
  descripcion: string;
  descripcionDetalle: string;
  composicion: string;
  guiaMedidas: string;
  /** Precio vigente de ejemplo del documento; M10 lo recalcula con la fórmula. */
  precio: number;
  imagen: string;
  imagenesPorColor: Record<CodigoColorOficial, string>;
  tallas: CodigoTallaOficial[];
  existencias: Record<string, Partial<Record<CodigoColorOficial, number>>>;
  /** Costo de materia prima base de la talla más cara (§11.3), solo para la interfaz. */
  costoMateriaPrimaBase: number;
  vendidosUltimos30Dias: number;
  creadoEn: string;
}

export const CATEGORIAS_OFICIALES: readonly CategoriaOficial[] = [
  { id: 1, nombre: 'Sudadera', prefijo: 'SD', usaTallas: true, activa: true, descripcion: 'Prendas con capucha, tallas CH, MD y GD.' },
  { id: 2, nombre: 'Playera', prefijo: 'PL', usaTallas: true, activa: true, descripcion: 'Camisetas de manga corta o tres cuartos, tallas CH, MD y GD.' },
  { id: 3, nombre: 'Pantalón', prefijo: 'PN', usaTallas: true, activa: true, descripcion: 'Pantalones deportivos, tallas CH, MD y GD.' },
  { id: 4, nombre: 'Gorro', prefijo: 'GO', usaTallas: false, activa: true, descripcion: 'Accesorios de talla única (UN).' },
  { id: 5, nombre: 'Bolsa de tela', prefijo: 'BO', usaTallas: false, activa: true, descripcion: 'Bolsas de tela de talla única (UN).' },
] as const;

export const COLORES_OFICIALES: ReadonlyArray<{ codigo: CodigoColorOficial; nombre: string; hex: string }> = [
  { codigo: 'BL', nombre: 'Blanco', hex: '#ffffff' },
  { codigo: 'NG', nombre: 'Negro', hex: '#2b212d' },
  { codigo: 'GR', nombre: 'Gris', hex: '#9a9a9a' },
];

export const TALLAS_OFICIALES: ReadonlyArray<{ codigo: CodigoTallaOficial; nombre: string }> = [
  { codigo: 'CH', nombre: 'Chica' },
  { codigo: 'MD', nombre: 'Mediana' },
  { codigo: 'GD', nombre: 'Grande' },
  { codigo: 'UN', nombre: 'Única' },
];

/** Centinela para variantes sin fotografía oficial: la vista muestra un respaldo accesible. */
export const IMAGEN_NO_DISPONIBLE = '';

/**
 * Recursos visuales reales presentes en `public/prendas`. No se descargan
 * imágenes externas ni se inventan fotografías de la marca.
 */
export const IMAGENES_OFICIALES: ReadonlyArray<{ url: string; etiqueta: string; categoria: string }> = [
  { url: '/prendas/sudadera/Sudaderablanca.png', etiqueta: 'Sudadera blanca', categoria: 'Sudadera' },
  { url: '/prendas/sudadera/Sudaderanegra.png', etiqueta: 'Sudadera negra', categoria: 'Sudadera' },
  { url: '/prendas/sudadera/Sudaderagris.png', etiqueta: 'Sudadera gris', categoria: 'Sudadera' },
  { url: '/prendas/playera/playerablanca.png', etiqueta: 'Playera blanca', categoria: 'Playera' },
  { url: '/prendas/playera/playeranegra.png', etiqueta: 'Playera negra', categoria: 'Playera' },
  { url: '/prendas/playera/playeragris.png', etiqueta: 'Playera gris', categoria: 'Playera' },
  { url: '/prendas/pantalon/Pantalonblanco.png', etiqueta: 'Pantalón blanco', categoria: 'Pantalón' },
  { url: '/prendas/pantalon/pantalonnegro.png', etiqueta: 'Pantalón negro', categoria: 'Pantalón' },
  { url: '/prendas/pantalon/pantalongris.png', etiqueta: 'Pantalón gris', categoria: 'Pantalón' },
  { url: '/prendas/Gorro/gorroblanco.png', etiqueta: 'Gorro blanco', categoria: 'Gorro' },
  { url: '/prendas/Gorro/Gorronegro.png', etiqueta: 'Gorro negro', categoria: 'Gorro' },
  { url: '/prendas/Gorro/gorrogris.png', etiqueta: 'Gorro gris', categoria: 'Gorro' },
  { url: '/prendas/bolsa%20de%20tela/bolsablanca.png', etiqueta: 'Bolsa de tela blanca', categoria: 'Bolsa de tela' },
  { url: '/prendas/bolsa%20de%20tela/bolsanegra.png', etiqueta: 'Bolsa de tela negra', categoria: 'Bolsa de tela' },
  { url: '/prendas/bolsa%20de%20tela/Bolsagris.png', etiqueta: 'Bolsa de tela gris', categoria: 'Bolsa de tela' },
];

export const PRENDAS_OFICIALES: readonly PrendaOficial[] = [
  {
    id: 1,
    slug: 'sudadera',
    nombre: 'SUDADERA',
    categoria: 'Sudadera',
    categoriaId: 1,
    codigoBase: 'SD',
    descripcion: 'Sudadera con capucha, unisex.',
    descripcionDetalle: 'Sudadera con capucha, unisex, de felpa con acabado clásico universitario.',
    composicion: '80% algodón, 20% poliéster',
    guiaMedidas: 'CH 48 × 66 cm · MD 51 × 69 cm · GD 54 × 72 cm',
    precio: 850,
    imagen: '/prendas/sudadera/Sudaderanegra.png',
    imagenesPorColor: {
      BL: '/prendas/sudadera/Sudaderablanca.png',
      NG: '/prendas/sudadera/Sudaderanegra.png',
      GR: '/prendas/sudadera/Sudaderagris.png',
    },
    tallas: ['CH', 'MD', 'GD'],
    existencias: {
      CH: { BL: 18, NG: 4, GR: 0 },
      MD: { BL: 12, NG: 0, GR: 3 },
      GD: { BL: 0, NG: 7, GR: 2 },
    },
    costoMateriaPrimaBase: 130.64,
    vendidosUltimos30Dias: 128,
    creadoEn: '2026-10-18',
  },
  {
    id: 2,
    slug: 'playera',
    nombre: 'PLAYERA',
    categoria: 'Playera',
    categoriaId: 2,
    codigoBase: 'PL',
    descripcion: 'Camiseta unisex de manga tres cuartos.',
    descripcionDetalle: 'Camiseta unisex de manga tres cuartos, confeccionada en jersey peinado.',
    composicion: '100% algodón',
    guiaMedidas: 'CH 46 × 64 cm · MD 49 × 67 cm · GD 52 × 70 cm',
    precio: 280,
    imagen: '/prendas/playera/playeragris.png',
    imagenesPorColor: {
      BL: '/prendas/playera/playerablanca.png',
      NG: '/prendas/playera/playeranegra.png',
      GR: '/prendas/playera/playeragris.png',
    },
    tallas: ['CH', 'MD', 'GD'],
    existencias: {
      CH: { BL: 9, NG: 2, GR: 14 },
      MD: { BL: 0, NG: 16, GR: 3 },
      GD: { BL: 6, NG: 0, GR: 11 },
    },
    costoMateriaPrimaBase: 45.04,
    vendidosUltimos30Dias: 96,
    creadoEn: '2026-09-12',
  },
  {
    id: 3,
    slug: 'pantalon',
    nombre: 'PANTALÓN',
    categoria: 'Pantalón',
    categoriaId: 3,
    codigoBase: 'PN',
    descripcion: 'Pantalón deportivo holgado unisex con cintura de cordón.',
    descripcionDetalle: 'Pantalón deportivo holgado unisex, de felpa con cintura ajustable de cordón.',
    composicion: '80% algodón, 20% poliéster',
    guiaMedidas: 'CH 68 cm · MD 72 cm · GD 76 cm de cintura',
    precio: 500,
    imagen: '/prendas/pantalon/pantalonnegro.png',
    imagenesPorColor: {
      BL: '/prendas/pantalon/Pantalonblanco.png',
      NG: '/prendas/pantalon/pantalonnegro.png',
      GR: '/prendas/pantalon/pantalongris.png',
    },
    tallas: ['CH', 'MD', 'GD'],
    existencias: {
      CH: { BL: 3, NG: 8, GR: 0 },
      MD: { BL: 15, NG: 4, GR: 0 },
      GD: { BL: 0, NG: 2, GR: 13 },
    },
    costoMateriaPrimaBase: 178.27,
    vendidosUltimos30Dias: 74,
    creadoEn: '2026-08-05',
  },
  {
    id: 4,
    slug: 'gorro',
    nombre: 'GORRO',
    categoria: 'Gorro',
    categoriaId: 4,
    codigoBase: 'GO',
    descripcion: 'Gorro de invierno unisex, talla única.',
    descripcionDetalle: 'Gorro de invierno unisex en estambre acrílico, talla única.',
    composicion: '100% acrílico',
    guiaMedidas: 'Única, 22 cm de circunferencia sin estirar',
    precio: 280,
    imagen: '/prendas/Gorro/gorrogris.png',
    imagenesPorColor: {
      BL: '/prendas/Gorro/gorroblanco.png',
      NG: '/prendas/Gorro/Gorronegro.png',
      GR: '/prendas/Gorro/gorrogris.png',
    },
    tallas: ['UN'],
    existencias: { UN: { BL: 9, NG: 2, GR: 0 } },
    costoMateriaPrimaBase: 37.99,
    vendidosUltimos30Dias: 52,
    creadoEn: '2026-07-22',
  },
  {
    id: 5,
    slug: 'bolsa-de-tela',
    nombre: 'BOLSA DE TELA',
    categoria: 'Bolsa de tela',
    categoriaId: 5,
    codigoBase: 'BO',
    descripcion: 'Bolsa de tela de 40 × 35 cm.',
    descripcionDetalle: 'Bolsa de manta cruda de 40 × 35 cm, talla única.',
    composicion: '100% manta de algodón',
    guiaMedidas: 'Única, 40 × 35 cm',
    precio: 850,
    imagen: '/prendas/bolsa%20de%20tela/bolsablanca.png',
    imagenesPorColor: {
      BL: '/prendas/bolsa%20de%20tela/bolsablanca.png',
      NG: '/prendas/bolsa%20de%20tela/bolsanegra.png',
      GR: '/prendas/bolsa%20de%20tela/Bolsagris.png',
    },
    tallas: ['UN'],
    existencias: { UN: { BL: 0, NG: 6, GR: 1 } },
    costoMateriaPrimaBase: 35.46,
    vendidosUltimos30Dias: 61,
    creadoEn: '2026-06-30',
  },
] as const;

/** Parámetros de configuración de §11.5 y valores de costeo capturados en M11. */
export const IVA_OFICIAL_PCT = 16;
export const MARGEN_OBJETIVO_OFICIAL_PCT = 55;

export function redondearDos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Precio sugerido con IVA = costo ÷ (1 − margen objetivo) × 1.16 (§7.5). */
export function precioSugerido(
  costoTotal: number,
  margenObjetivoPct: number = MARGEN_OBJETIVO_OFICIAL_PCT,
): number {
  const margen = Math.min(Math.max(margenObjetivoPct, 0), 95) / 100;
  return redondearDos((costoTotal / (1 - margen)) * (1 + IVA_OFICIAL_PCT / 100));
}

export function nombreColorOficial(codigo: CodigoColorOficial): string {
  return COLORES_OFICIALES.find((color) => color.codigo === codigo)?.nombre ?? codigo;
}

export function nombreTallaOficial(codigo: CodigoTallaOficial): string {
  return TALLAS_OFICIALES.find((talla) => talla.codigo === codigo)?.nombre ?? codigo;
}

export function categoriaPorIdOficial(id: number): CategoriaOficial | undefined {
  return CATEGORIAS_OFICIALES.find((categoria) => categoria.id === id);
}
