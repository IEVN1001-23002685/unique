/**
 * Modelos de interfaz de M10 · Productos y variantes.
 * Son una proyección de las entidades del §6 para la capa de presentación;
 * la generación autoritativa del SKU y la persistencia corresponden a Flask.
 */

export type CodigoColor = 'BL' | 'NG' | 'GR';
export type CodigoTalla = 'CH' | 'MD' | 'GD' | 'UN';

export interface CategoriaProducto {
  id: number;
  nombre: string;
  /** SD, PL, PN, GO o BO, según la regla 6.5 del documento. */
  prefijo: string;
  usaTallas: boolean;
  activa: boolean;
}

export interface ColorCatalogo {
  codigo: CodigoColor;
  nombre: string;
}

export interface TallaCatalogo {
  codigo: CodigoTalla;
  nombre: string;
}

/** Recurso real encontrado en public/images/productos; no se inventan fotografías. */
export interface RecursoImagen {
  url: string;
  etiqueta: string;
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
  /**
   * M12 es dueño de la existencia y el reservado. Estos valores son de
   * demostración y se muestran aquí solo como lectura.
   */
  existencia: number;
  reservado: number;
  stockMinimo: number;
  cantidadReposicion: number;
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
  /** Precio de venta con IVA incluido, en MXN. */
  precioVenta: number;
  permiteBajoPedido: boolean;
  activo: boolean;
  eliminadoEn: string | null;
  imagenes: ImagenProducto[];
  tallas: CodigoTalla[];
  colores: CodigoColor[];
  variantes: VarianteProducto[];
  /** M11 es dueño del costo y de las recetas; datos de demostración hasta integrarlo. */
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
  precioVenta: number;
  permiteBajoPedido: boolean;
  colores: CodigoColor[];
  tallas: CodigoTalla[];
  imagenGeneral: string;
  imagenesPorColor: Partial<Record<CodigoColor, string>>;
  stockMinimo: number;
  cantidadReposicion: number;
}

export type ModoEliminacion = 'eliminado' | 'desactivado';

export interface ResultadoProducto {
  ok: boolean;
  mensaje: string;
  productoId?: number;
  modo?: ModoEliminacion;
}

export interface FilaVariante {
  productoId: number;
  productoNombre: string;
  categoria: string;
  variante: VarianteProducto;
}
