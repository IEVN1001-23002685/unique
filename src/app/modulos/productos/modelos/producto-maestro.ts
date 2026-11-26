/**
 * Modelos de interfaz de M10 · Productos y variantes.
 * Son una proyección de las entidades del §6 para la capa de presentación;
 * la generación autoritativa del SKU, el costo y la persistencia corresponden a Flask.
 */

export type CodigoColor = 'BL' | 'NG' | 'GR';
export type CodigoTalla = 'CH' | 'MD' | 'GD' | 'UN';
export type CategoriaMaterialInterfaz =
  | 'Tela'
  | 'Hilo'
  | 'Estabilizador'
  | 'Avio'
  | 'Etiqueta'
  | 'Empaque';

export interface CategoriaProducto {
  id: number;
  nombre: string;
  /** SD, PL, PN, GO o BO, según la regla 6.5 del documento. */
  prefijo: string;
  usaTallas: boolean;
  activa: boolean;
  descripcion: string;
}

export interface ColorCatalogo {
  codigo: CodigoColor;
  nombre: string;
}

export interface TallaCatalogo {
  codigo: CodigoTalla;
  nombre: string;
}

/** Recurso real encontrado en public/prendas; no se inventan fotografías. */
export interface RecursoImagen {
  url: string;
  etiqueta: string;
  categoria: string;
}

export interface ImagenProducto {
  /** null = imagen general; de lo contrario, imagen asociada a un color comercial. */
  color: CodigoColor | null;
  url: string;
  orden: number;
}

export interface VarianteProducto {
  id: number;
  /** Generado por el servicio; nunca se edita manualmente. */
  sku: string;
  talla: CodigoTalla;
  color: CodigoColor;
  activa: boolean;
  /** M12 es dueño de la existencia y el reservado; aquí se muestran solo para lectura. */
  existencia: number;
  reservado: number;
  stockMinimo: number;
  cantidadReposicion: number;
}

/** Línea de composición capturada por tipo de material (lector de M11/M15). */
export interface LineaMaterialProducto {
  id: number;
  materialId: number;
  codigo: string;
  nombre: string;
  categoria: CategoriaMaterialInterfaz;
  unidad: string;
  /** Cantidad neta en unidad base; se convierte a bruta con la merma. */
  cantidad: number;
  costoBase: number;
  mermaPct: number;
  /** Participación en la composición textil; las líneas de Tela deben sumar 100. */
  porcentaje: number;
  /** Regla POR_PRENDA: se suma al empaque sin aplicar merma. */
  porPrenda: boolean;
}

/** Parámetros que alimentan la fórmula de precio sugerido de §7.5. */
export interface ParametrosCosteo {
  lineas: LineaMaterialProducto[];
  manoObra: number;
  bordado: number;
  indirectos: number;
  margenObjetivoPct: number;
}

/** Desglose transparente que se muestra en el formulario; no se persiste. */
export interface DesgloseCosteo {
  materiaPrima: number;
  empaque: number;
  manoObra: number;
  bordado: number;
  indirectos: number;
  costoTotal: number;
  precioSinIva: number;
  iva: number;
  precioConIva: number;
  margenReal: number | null;
  errores: string[];
}

export interface EntradaBitacora {
  id: number;
  fecha: string;
  usuario: string;
  campo: string;
  detalle: string;
}

export interface ProductoMaestro {
  id: number;
  slug: string;
  nombre: string;
  /** Código base asignado por el servicio (SD, SD2, PL...). No se escribe a mano. */
  codigoSku: string;
  categoriaId: number;
  descripcion: string;
  composicionTextil: string;
  guiaMedidas: string;
  /** Precio de venta calculado con la fórmula, con IVA incluido, en MXN. */
  precioVenta: number;
  permiteBajoPedido: boolean;
  activo: boolean;
  eliminadoEn: string | null;
  imagenes: ImagenProducto[];
  tallas: CodigoTalla[];
  colores: CodigoColor[];
  variantes: VarianteProducto[];
  /** Parámetros capturados para el precio; M11 calcula los costos reales en Flask. */
  costeo: ParametrosCosteo;
  /** M11 es dueño del costo y de las recetas; se proyecta desde su servicio. */
  costoEstandar: number | null;
  recetasVigentes: CodigoTalla[];
  /** Con historial de ventas o movimientos se desactiva; sin él se borra. */
  tieneHistorial: boolean;
  bitacora: EntradaBitacora[];
}

export interface DatosProducto {
  nombre: string;
  categoriaId: number;
  descripcion: string;
  composicionTextil: string;
  guiaMedidas: string;
  /** No se captura a mano: se deriva de `costeo` con la fórmula del documento. */
  costeo: ParametrosCosteo;
  /** Precio vigente leído de la API al editar; evita recalcularlo con costeo local vacío. */
  precioVenta?: number;
  permiteBajoPedido: boolean;
  colores: CodigoColor[];
  tallas: CodigoTalla[];
  imagenGeneral: string;
  imagenesPorColor: Partial<Record<CodigoColor, string>>;
  stockMinimo: number;
  cantidadReposicion: number;
}

export interface DatosCategoria {
  nombre: string;
  prefijo: string;
  usaTallas: boolean;
  activa: boolean;
  descripcion: string;
}

export type ModoEliminacion = 'eliminado' | 'desactivado';

export interface ResultadoProducto {
  ok: boolean;
  mensaje: string;
  productoId?: number;
  modo?: ModoEliminacion;
}

export interface ResultadoCategoria {
  ok: boolean;
  mensaje: string;
  categoriaId?: number;
}

export interface FilaVariante {
  productoId: number;
  productoNombre: string;
  categoria: string;
  variante: VarianteProducto;
}
