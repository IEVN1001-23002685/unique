import type { VarianteVenta } from '../modelos/venta';

/**
 * DATO DE DEMOSTRACIÓN (M08).
 * SKU con formato PRODUCTO-TALLA-COLOR, generado por el sistema; no editable.
 * Los costos son una lectura de ejemplo de los parámetros oficiales (§11.3) y
 * solo se muestran al Administrador; M11 es dueño de la cifra definitiva.
 */
export const VARIANTES_SIMULADAS: VarianteVenta[] = [
  {
    sku: 'SD-GD-NG',
    nombreProducto: 'SUDADERA',
    talla: 'GD',
    color: 'Negro',
    precioUnitario: 850,
    costoEstandarUnitario: 130.64,
  },
  {
    sku: 'PL-GD-GR',
    nombreProducto: 'PLAYERA',
    talla: 'GD',
    color: 'Gris',
    precioUnitario: 280,
    costoEstandarUnitario: 45.04,
  },
  {
    sku: 'PN-GD-NG',
    nombreProducto: 'PANTALÓN',
    talla: 'GD',
    color: 'Negro',
    precioUnitario: 500,
    costoEstandarUnitario: 178.27,
  },
  {
    sku: 'GO-UN-BL',
    nombreProducto: 'GORRO',
    talla: 'UN',
    color: 'Blanco',
    precioUnitario: 280,
    costoEstandarUnitario: 37.99,
  },
  {
    sku: 'BO-UN-GR',
    nombreProducto: 'BOLSA DE TELA',
    talla: 'UN',
    color: 'Gris',
    precioUnitario: 850,
    costoEstandarUnitario: 35.46,
  },
];
