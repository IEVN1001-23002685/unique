import type { VarianteVenta } from '../modelos/venta';

/**
 * DATO DE DEMOSTRACIÓN (M08).
 * SKU con formato PRODUCTO-TALLA-COLOR, generado por el sistema; no editable.
 * Los costos estándar se muestran solo al Administrador.
 */
export const VARIANTES_SIMULADAS: VarianteVenta[] = [
  {
    sku: 'HOODIE-M-ROJA',
    nombreProducto: 'Hoodie roja',
    talla: 'M',
    color: 'Roja',
    precioUnitario: 850,
    costoEstandarUnitario: 320,
  },
  {
    sku: 'PLAYERA-CH-GRIS',
    nombreProducto: 'Playera gris',
    talla: 'CH',
    color: 'Gris',
    precioUnitario: 280,
    costoEstandarUnitario: 95,
  },
  {
    sku: 'PANTS-28-CAFE',
    nombreProducto: 'Pants café',
    talla: '28',
    color: 'Café',
    precioUnitario: 500,
    costoEstandarUnitario: 190,
  },
  {
    sku: 'GORRO-UNICA-BLANCO',
    nombreProducto: 'Gorro blanco',
    talla: 'Única',
    color: 'Blanco',
    precioUnitario: 280,
    costoEstandarUnitario: 90,
  },
  {
    sku: 'TOTE-UNICA-CRUD',
    nombreProducto: 'Tote bag',
    talla: 'Única',
    color: 'Crudo',
    precioUnitario: 850,
    costoEstandarUnitario: 260,
  },
];
