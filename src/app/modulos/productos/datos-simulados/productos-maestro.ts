import {
  CATEGORIAS_OFICIALES,
  COLORES_OFICIALES,
  IMAGENES_OFICIALES,
  PRENDAS_OFICIALES,
  TALLAS_OFICIALES,
  type CodigoColorOficial,
  type CodigoTallaOficial,
} from '../../../nucleo/datos/catalogo-oficial';
import type {
  CategoriaProducto,
  ColorCatalogo,
  ImagenProducto,
  LineaMaterialProducto,
  ParametrosCosteo,
  ProductoMaestro,
  RecursoImagen,
  TallaCatalogo,
  VarianteProducto,
} from '../modelos/producto-maestro';

/**
 * DATOS DE DEMOSTRACIÓN de M10, derivados del catálogo oficial (§6.5 y §11).
 * Solo existen las cinco prendas permitidas, tres colores y 33 SKU. Los costos
 * son una instantánea de lectura de M11 y se muestran como provisionales;
 * Flask sustituirá estas cifras por las recetas VIGENTES.
 */

export const CATEGORIAS_PRODUCTO: CategoriaProducto[] = CATEGORIAS_OFICIALES.map((categoria) => ({
  ...categoria,
}));

export const COLORES_PRODUCTO: ColorCatalogo[] = COLORES_OFICIALES.map(({ codigo, nombre }) => ({
  codigo: codigo as CodigoColorOficial,
  nombre,
}));

export const TALLAS_PRODUCTO: TallaCatalogo[] = TALLAS_OFICIALES.map(({ codigo, nombre }) => ({
  codigo: codigo as CodigoTallaOficial,
  nombre,
}));

/** Biblioteca real del proyecto: únicamente recursos presentes en public/prendas. */
export const IMAGENES_DISPONIBLES: RecursoImagen[] = IMAGENES_OFICIALES.map((recurso) => ({
  url: recurso.url,
  etiqueta: recurso.etiqueta,
  categoria: recurso.categoria,
}));

/** Valores capturados en M11; empaque POR_PRENDA según §11.6. */
function linea(
  id: number,
  materialId: number,
  codigo: string,
  nombre: string,
  categoria: LineaMaterialProducto['categoria'],
  unidad: string,
  cantidad: number,
  costoBase: number,
  mermaPct: number,
  porcentaje = 0,
  porPrenda = false,
): LineaMaterialProducto {
  return {
    id,
    materialId,
    codigo,
    nombre,
    categoria,
    unidad,
    cantidad,
    costoBase,
    mermaPct,
    porcentaje,
    porPrenda,
  };
}

const EMPAQUE: LineaMaterialProducto[] = [
  linea(90, 23, 'EMP-KRA', 'Bolsa de kraft', 'Empaque', 'pieza', 1, 12, 0, 0, true),
  linea(91, 24, 'EMP-PAP', 'Papel protector', 'Empaque', 'pieza', 1, 2.5, 0, 0, true),
  linea(92, 25, 'EMP-TAR', 'Tarjeta personalizada con código QR', 'Empaque', 'pieza', 1, 5, 0, 0, true),
];

const PARAMETROS_BASE = {
  manoObra: 45,
  bordado: 12,
  indirectos: 20,
  /** §11.5: margen objetivo 55 %. */
  margenObjetivoPct: 55,
};

/** Costeo de ejemplo por prenda, tomado de la tabla de recetas semilla (§11.3). */
function costeoDe(productoId: number): ParametrosCosteo {
  const lineas: LineaMaterialProducto[] = [];

  switch (productoId) {
    case 1:
      lineas.push(
        linea(1, 1, 'TEL-FEL', 'Felpa', 'Tela', 'm²', 1.1029, 89.1975, 15, 80),
        linea(2, 3, 'TEL-RIB', 'Tejido acanalado (rib)', 'Tela', 'm²', 0.1231, 50.2857, 20, 20),
        linea(3, 6, 'HIL-COS', 'Hilo de costura 40/2', 'Hilo', 'm', 15.14, 0.012741, 10),
        linea(4, 10, 'EST-HOJ', 'Estabilizador de corte', 'Estabilizador', 'pieza', 1, 5, 0),
      );
      break;
    case 2:
      lineas.push(
        linea(5, 2, 'TEL-JER', 'Jersey peinado', 'Tela', 'm²', 1.0396, 25.731, 15, 80),
        linea(6, 3, 'TEL-RIB', 'Tejido acanalado (rib)', 'Tela', 'm²', 0.1025, 50.2857, 20, 20),
        linea(7, 6, 'HIL-COS', 'Hilo de costura 40/2', 'Hilo', 'm', 12.42, 0.012741, 10),
        linea(8, 10, 'EST-HOJ', 'Estabilizador de corte', 'Estabilizador', 'pieza', 1, 5, 0),
      );
      break;
    case 3:
      lineas.push(
        linea(9, 1, 'TEL-FEL', 'Felpa', 'Tela', 'm²', 1.2178, 89.1975, 15, 100),
        linea(10, 6, 'HIL-COS', 'Hilo de costura 40/2', 'Hilo', 'm', 18.66, 0.012741, 10),
        linea(11, 11, 'EST-ROL', 'Estabilizador en rollo', 'Estabilizador', 'm', 0.61, 21.9593, 0),
        linea(12, 12, 'AVI-COR', 'Cordón redondo de poliéster', 'Avio', 'pieza', 1, 32.775, 0),
        linea(13, 13, 'AVI-OJI', 'Ojillos metálicos de 8 mm', 'Avio', 'pieza', 2, 0.42, 0),
      );
      break;
    case 4:
      lineas.push(
        linea(14, 5, 'HIL-EST', 'Estambre acrílico', 'Hilo', 'm', 130, 0.247619, 5),
        linea(15, 6, 'HIL-COS', 'Hilo de costura 40/2', 'Hilo', 'm', 4, 0.012741, 10),
        linea(16, 11, 'EST-ROL', 'Estabilizador en rollo', 'Estabilizador', 'm', 0.25, 21.9593, 0),
      );
      break;
    default:
      lineas.push(
        linea(17, 4, 'TEL-LON', 'Loneta', 'Tela', 'm²', 0.341, 76.5333, 10, 100),
        linea(18, 6, 'HIL-COS', 'Hilo de costura 40/2', 'Hilo', 'm', 11.65, 0.012741, 10),
        linea(19, 10, 'EST-HOJ', 'Estabilizador de corte', 'Estabilizador', 'pieza', 1, 5, 0),
      );
      break;
  }

  return { ...PARAMETROS_BASE, lineas: [...lineas, ...EMPAQUE.map((item) => ({ ...item }))] };
}

let consecutivoVariante = 1;

function crearVariantes(productoId: number, codigoBase: string): VarianteProducto[] {
  const prenda = PRENDAS_OFICIALES.find((item) => item.id === productoId);
  if (!prenda) {
    return [];
  }

  return prenda.tallas.flatMap((talla) =>
    COLORES_OFICIALES.map(({ codigo: color }) => {
      const existencia = prenda.existencias[talla]?.[color] ?? 0;
      return {
        id: consecutivoVariante++,
        sku: `${codigoBase}-${talla}-${color}`,
        talla: talla as CodigoTallaOficial,
        color: color as CodigoColorOficial,
        activa: true,
        existencia,
        reservado: Math.min(2, existencia),
        stockMinimo: 5,
        cantidadReposicion: 20,
      };
    }),
  );
}

function crearProducto(id: number): ProductoMaestro {
  const prenda = PRENDAS_OFICIALES.find((item) => item.id === id);
  if (!prenda) {
    throw new Error(`Prenda oficial ${id} no encontrada`);
  }

  const imagenes: ImagenProducto[] = [
    { color: null, url: prenda.imagen, orden: 1 },
    ...COLORES_OFICIALES.flatMap((color, indice) => {
      const url = prenda.imagenesPorColor[color.codigo];
      return url === '' ? [] : [{ color: color.codigo, url, orden: indice + 2 }];
    }),
  ];

  return {
    id: prenda.id,
    slug: prenda.slug,
    nombre: prenda.nombre,
    codigoSku: prenda.codigoBase,
    categoriaId: prenda.categoriaId,
    descripcion: prenda.descripcion,
    composicionTextil: prenda.composicion,
    guiaMedidas: prenda.guiaMedidas,
    precioVenta: prenda.precio,
    permiteBajoPedido: true,
    activo: true,
    eliminadoEn: null,
    imagenes,
    tallas: [...prenda.tallas],
    colores: COLORES_OFICIALES.map((color) => color.codigo),
    variantes: crearVariantes(prenda.id, prenda.codigoBase),
    costeo: costeoDe(prenda.id),
    costoEstandar: prenda.costoMateriaPrimaBase,
    recetasVigentes: [...prenda.tallas],
    tieneHistorial: true,
    bitacora: [],
  };
}

export const PRODUCTOS_MAESTRO_SIMULADOS: ProductoMaestro[] = PRENDAS_OFICIALES.map((prenda) =>
  crearProducto(prenda.id),
);
