/**
 * Modelo de dominio compartido por la tienda y el panel administrativo.
 * Temporal: esquema mínimo limitado a los datos que hoy se muestran en pantalla.
 */
export interface IProducto {
  id: number;
  /** Identificador legible usado en la ruta de detalle, por ejemplo: sudadera */
  slug: string;
  nombre: string;
  descripcion: string;
  /**
   * Descripción ampliada mostrada en la página de detalle.
   * Solo existe donde el mockup de detalle aprobado difiere del resumen del catálogo.
   */
  descripcionDetalle?: string;
  precio: number;
  categoria: string;
  /** Ruta pública real del recurso, por ejemplo: /prendas/sudadera/Sudaderanegra.png */
  imagen: string;
  /** Insignia opcional sobre la imagen, por ejemplo: "Más buscado" */
  etiqueta?: string;
}
