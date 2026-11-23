import type {
  CategoriaProducto,
  CodigoColor,
  CodigoTalla,
  ColorCatalogo,
  ImagenProducto,
  ProductoMaestro,
  RecursoImagen,
  TallaCatalogo,
  VarianteProducto,
} from '../modelos/producto-maestro';

/**
 * DATOS DE DEMOSTRACIÓN de M10.
 * Categorías, colores, tallas y precios iniciales tomados de §11.1 y del catálogo
 * ya implementado. Los costos corresponden a la tabla de recetas semilla (§11.3)
 * y se muestran como provisionales hasta integrar M11. Las existencias son un
 * ejemplo proporcionado por M12, que es el dueño real de esa cifra.
 */

export const CATEGORIAS_PRODUCTO: CategoriaProducto[] = [
  { id: 1, nombre: 'Sudadera', prefijo: 'SD', usaTallas: true, activa: true },
  { id: 2, nombre: 'Playera', prefijo: 'PL', usaTallas: true, activa: true },
  { id: 3, nombre: 'Pantalón', prefijo: 'PN', usaTallas: true, activa: true },
  { id: 4, nombre: 'Gorro', prefijo: 'GO', usaTallas: false, activa: true },
  { id: 5, nombre: 'Bolsa de tela', prefijo: 'BO', usaTallas: false, activa: true },
];

export const COLORES_PRODUCTO: ColorCatalogo[] = [
  { codigo: 'BL', nombre: 'Blanco' },
  { codigo: 'NG', nombre: 'Negro' },
  { codigo: 'GR', nombre: 'Gris' },
];

export const TALLAS_PRODUCTO: TallaCatalogo[] = [
  { codigo: 'CH', nombre: 'Chica' },
  { codigo: 'MD', nombre: 'Mediana' },
  { codigo: 'GD', nombre: 'Grande' },
  { codigo: 'UN', nombre: 'Única' },
];

/** Únicos recursos de producto presentes en el proyecto. */
export const IMAGENES_DISPONIBLES: RecursoImagen[] = [
  { url: '/images/productos/hoodie-roja.png', etiqueta: 'Sudadera roja' },
  { url: '/images/productos/playera-gris.png', etiqueta: 'Playera gris' },
  { url: '/images/productos/pants-cafe.png', etiqueta: 'Pantalón café' },
  { url: '/images/productos/gorro-blanco.png', etiqueta: 'Gorro blanco' },
  { url: '/images/productos/tote-bag.png', etiqueta: 'Bolsa de tela' },
];

interface SemillaProducto {
  id: number;
  slug: string;
  nombre: string;
  codigoSku: string;
  categoriaId: number;
  descripcion: string;
  composicionTextil: string;
  guiaMedidas: string;
  precioVenta: number;
  permiteBajoPedido: boolean;
  activo: boolean;
  imagen: string;
  tallas: CodigoTalla[];
  colores: CodigoColor[];
  costoEstandar: number | null;
  recetasVigentes: CodigoTalla[];
  tieneHistorial: boolean;
  existencias: number[];
}

const SEMILLAS: SemillaProducto[] = [
  {
    id: 1,
    slug: 'hoodie-roja',
    nombre: 'HOODIE ROJA',
    codigoSku: 'SD',
    categoriaId: 1,
    descripcion: 'Barnesmith Sudadera con capucha, unisex.',
    composicionTextil: '80% algodón, 20% poliéster',
    guiaMedidas: 'CH 48 × 66 cm · MD 51 × 69 cm · GD 54 × 72 cm',
    precioVenta: 850,
    permiteBajoPedido: true,
    activo: true,
    imagen: '/images/productos/hoodie-roja.png',
    tallas: ['CH', 'MD', 'GD'],
    colores: ['BL', 'NG', 'GR'],
    costoEstandar: 130.64,
    recetasVigentes: ['CH', 'MD', 'GD'],
    tieneHistorial: true,
    existencias: [14, 9, 0, 6, 11, 3, 8, 0, 5],
  },
  {
    id: 2,
    slug: 'playera-gris',
    nombre: 'PLAYERA GRIS',
    codigoSku: 'PL',
    categoriaId: 2,
    descripcion: 'Camiseta unisex de manga tres cuartos.',
    composicionTextil: '100% algodón',
    guiaMedidas: 'CH 46 × 64 cm · MD 49 × 67 cm · GD 52 × 70 cm',
    precioVenta: 280,
    permiteBajoPedido: true,
    activo: true,
    imagen: '/images/productos/playera-gris.png',
    tallas: ['CH', 'MD', 'GD'],
    colores: ['BL', 'NG', 'GR'],
    costoEstandar: 45.04,
    recetasVigentes: ['CH', 'MD', 'GD'],
    tieneHistorial: true,
    existencias: [22, 15, 7, 18, 10, 4, 12, 6, 0],
  },
  {
    id: 3,
    slug: 'pants-cafe',
    nombre: 'PANTS CAFE',
    codigoSku: 'PN',
    categoriaId: 3,
    descripcion: 'Pantalón deportivo holgado unisex con cintura de cordón.',
    composicionTextil: '80% algodón, 20% poliéster',
    guiaMedidas: 'CH 68 cm · MD 72 cm · GD 76 cm de cintura',
    precioVenta: 500,
    permiteBajoPedido: true,
    activo: true,
    imagen: '/images/productos/pants-cafe.png',
    tallas: ['CH', 'MD', 'GD'],
    colores: ['BL', 'NG', 'GR'],
    costoEstandar: 178.27,
    recetasVigentes: ['CH', 'MD', 'GD'],
    tieneHistorial: true,
    existencias: [8, 5, 0, 6, 3, 2, 7, 4, 1],
  },
  {
    id: 4,
    slug: 'gorro-blanco',
    nombre: 'GORRO BLANCO',
    codigoSku: 'GO',
    categoriaId: 4,
    descripcion: 'Gorro de invierno unisex, talla única.',
    composicionTextil: '100% acrílico',
    guiaMedidas: 'Única, 22 cm de circunferencia sin estirar',
    precioVenta: 280,
    permiteBajoPedido: true,
    activo: true,
    imagen: '/images/productos/gorro-blanco.png',
    tallas: ['UN'],
    colores: ['BL', 'NG', 'GR'],
    costoEstandar: 37.99,
    recetasVigentes: ['UN'],
    tieneHistorial: true,
    existencias: [16, 12, 9],
  },
  {
    id: 5,
    slug: 'tote-bag',
    nombre: 'TOTE BAG',
    codigoSku: 'BO',
    categoriaId: 5,
    descripcion: 'Bolsa de manta cruda de 40 × 35 cm.',
    composicionTextil: '100% manta de algodón',
    guiaMedidas: 'Única, 40 × 35 cm',
    precioVenta: 850,
    permiteBajoPedido: true,
    activo: true,
    imagen: '/images/productos/tote-bag.png',
    tallas: ['UN'],
    colores: ['BL', 'NG', 'GR'],
    costoEstandar: 35.46,
    recetasVigentes: ['UN'],
    tieneHistorial: true,
    existencias: [20, 14, 11],
  },
  {
    // Borrador: demuestra el consecutivo SD2 y la regla de activación.
    id: 6,
    slug: 'sudadera-universitaria',
    nombre: 'SUDADERA UNIVERSITARIA',
    codigoSku: 'SD2',
    categoriaId: 1,
    descripcion: 'Sudadera universitaria con aplicaciones de bordado por definir.',
    composicionTextil: '80% algodón, 20% poliéster',
    guiaMedidas: 'CH 48 × 66 cm · MD 51 × 69 cm',
    precioVenta: 950,
    permiteBajoPedido: true,
    activo: false,
    imagen: '/images/productos/hoodie-roja.png',
    tallas: ['CH', 'MD'],
    colores: ['NG', 'GR'],
    costoEstandar: null,
    recetasVigentes: [],
    tieneHistorial: false,
    existencias: [0, 0, 0, 0],
  },
];

let consecutivoVariante = 1;

function crearVariantes(semilla: SemillaProducto): VarianteProducto[] {
  const variantes: VarianteProducto[] = [];

  for (const talla of semilla.tallas) {
    for (const color of semilla.colores) {
      const indice = variantes.length;
      const existencia =
        semilla.existencias.length > 0
          ? (semilla.existencias[indice % semilla.existencias.length] ?? 0)
          : 0;
      variantes.push({
        id: consecutivoVariante++,
        sku: `${semilla.codigoSku}-${talla}-${color}`,
        talla,
        color,
        activa: true,
        existencia,
        reservado: Math.min(2, existencia),
        stockMinimo: 5,
        cantidadReposicion: 20,
      });
    }
  }

  return variantes;
}

function crearProducto(semilla: SemillaProducto): ProductoMaestro {
  const imagenes: ImagenProducto[] = [
    { color: null, url: semilla.imagen, orden: 1 },
    ...semilla.colores.map((color, indice) => ({
      color,
      url: semilla.imagen,
      orden: indice + 2,
    })),
  ];

  return {
    id: semilla.id,
    slug: semilla.slug,
    nombre: semilla.nombre,
    codigoSku: semilla.codigoSku,
    categoriaId: semilla.categoriaId,
    descripcion: semilla.descripcion,
    composicionTextil: semilla.composicionTextil,
    guiaMedidas: semilla.guiaMedidas,
    precioVenta: semilla.precioVenta,
    permiteBajoPedido: semilla.permiteBajoPedido,
    activo: semilla.activo,
    eliminadoEn: null,
    imagenes,
    tallas: [...semilla.tallas],
    colores: [...semilla.colores],
    variantes: crearVariantes(semilla),
    costoEstandar: semilla.costoEstandar,
    recetasVigentes: [...semilla.recetasVigentes],
    tieneHistorial: semilla.tieneHistorial,
    bitacora: [],
  };
}

export const PRODUCTOS_MAESTRO_SIMULADOS: ProductoMaestro[] = SEMILLAS.map(crearProducto);
