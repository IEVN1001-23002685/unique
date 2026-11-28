/** Modelos de interfaz de M13 · Proveedores (§6 y §7 del documento UNIQUE v3.0). */

export type EstadoProveedor = 'ACTIVO' | 'EN_REVISION' | 'INACTIVO';

export type CategoriaMaterial = 'Tela' | 'Hilo' | 'Estabilizador' | 'Avío' | 'Etiqueta' | 'Empaque';

/**
 * Cobertura crítica definida por Flask en `proveedor_service.MATERIALES_CRITICOS`.
 * La loneta (`TEL-LON`) NO está incluida: solo necesita proveedor principal.
 * Se replica como constante de interfaz, no como regla de negocio nueva.
 */
export const MATERIALES_CRITICOS = ['TEL-FEL', 'TEL-JER', 'TEL-RIB', 'HIL-EST'] as const;

/** Evalúa criticidad por código exacto, no por prefijo `TEL`/`HIL`. */
export function esMaterialCritico(codigo: string | null | undefined): boolean {
  if (!codigo) {
    return false;
  }
  return (MATERIALES_CRITICOS as readonly string[]).includes(codigo.trim().toUpperCase());
}

/** Catálogo de materiales de M15, consultado aquí solo como referencia. */
export interface MaterialReferencia {
  id: number;
  nombre: string;
  categoria: CategoriaMaterial;
  critico: boolean;
  unidadCompra: string;
}

/** Línea de proveedor_material: precio y mínimo por unidad de compra. */
export interface MaterialProveedor {
  id: number;
  materialId: number;
  material: string;
  categoria: CategoriaMaterial;
  critico: boolean;
  precioCompra: number;
  unidadCompra: string;
  minimoCompra: number;
  plazoDias: number;
  esPrincipal: boolean;
  vigenciaHasta: string | null;
  activo: boolean;
}

export interface Proveedor {
  id: number;
  razonSocial: string;
  nombreComercial: string;
  rfc: string | null;
  contacto: string;
  telefono: string;
  correo: string;
  direccion: string;
  condicionesPago: string;
  estatus: EstadoProveedor;
  notas: string | null;
  /** Solo para la regla de eliminación; se consultará a M14 en la integración real. */
  tieneOrdenesCompra: boolean;
  materiales: MaterialProveedor[];
}

/** Métricas leídas de orden_compra y recepción (M14), nunca editables aquí. */
export interface EvaluacionProveedor {
  proveedorId: number;
  ordenesRecibidas: number;
  ordenesATiempo: number;
  entregasATiempoPct: number;
  cantidadRecibida: number;
  cantidadAceptada: number;
  aceptacionPct: number;
}
