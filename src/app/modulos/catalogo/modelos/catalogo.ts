import type { IProducto } from '../../../nucleo/modelos/producto';

/** Proyección pública de M03: el backend nunca expone existencias exactas. */

export type CodigoColorCatalogo = 'BL' | 'NG' | 'GR' | 'NA';
export type CodigoTallaCatalogo = 'CH' | 'MD' | 'GD' | 'UN';
export type EstadoDisponibilidadCatalogo =
  | 'Disponible'
  | 'Pocas unidades'
  | 'Bajo pedido'
  | 'Agotado';
export type OrdenCatalogo = 'relevancia' | 'precio-asc' | 'precio-desc' | 'novedad';

export interface VarianteCatalogo {
  id: number;
  sku: string;
  colorCodigo: CodigoColorCatalogo;
  colorNombre: string;
  talla: CodigoTallaCatalogo;
  disponibilidad: EstadoDisponibilidadCatalogo;
  bajoPedido: boolean;
  comprable: boolean;
  fechaEstimada?: string;
  imagen: string;
  activa: boolean;
}

export interface ProductoCatalogo extends IProducto {
  activo: boolean;
  composicion: string;
  guiaMedidasTexto?: string;
  masBuscado: boolean;
  variantes: VarianteCatalogo[];
  creadoEn: string;
}

export const COLORES_CATALOGO: Record<CodigoColorCatalogo, { nombre: string; hex: string }> = {
  BL: { nombre: 'Blanco', hex: '#ffffff' },
  NG: { nombre: 'Negro', hex: '#2b212d' },
  GR: { nombre: 'Gris', hex: '#9a9a9a' },
  NA: { nombre: 'No aplica', hex: '#d1d5db' },
};

export const TALLAS_CATALOGO: CodigoTallaCatalogo[] = ['CH', 'MD', 'GD', 'UN'];

export const GUIA_MEDIDAS: ReadonlyArray<{
  talla: CodigoTallaCatalogo;
  pecho: string;
  largo: string;
}> = [
  { talla: 'CH', pecho: '86 cm', largo: '64 cm' },
  { talla: 'MD', pecho: '96 cm', largo: '67 cm' },
  { talla: 'GD', pecho: '106 cm', largo: '70 cm' },
  { talla: 'UN', pecho: 'Única', largo: 'Única' },
];

export function estadoDisponibilidad(variante: VarianteCatalogo): EstadoDisponibilidadCatalogo {
  return variante.activa ? variante.disponibilidad : 'Agotado';
}

export function fechaEstimada(variante: VarianteCatalogo): string | undefined {
  if (estadoDisponibilidad(variante) !== 'Bajo pedido' || !variante.fechaEstimada) {
    return undefined;
  }
  const fecha = new Date(variante.fechaEstimada);
  if (Number.isNaN(fecha.getTime())) {
    return variante.fechaEstimada;
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(fecha);
}

export function productoDisponible(producto: ProductoCatalogo): boolean {
  return producto.variantes.some(
    (variante) => variante.comprable && estadoDisponibilidad(variante) !== 'Agotado',
  );
}

export function productoVisible(producto: ProductoCatalogo): boolean {
  return producto.activo && producto.variantes.some((variante) => variante.activa);
}
