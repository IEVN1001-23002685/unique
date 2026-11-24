import type { Descuento } from '../modelos/venta';

/** DATO DE DEMOSTRACIÓN (M08). El primero viene sembrado en el documento v3.0 §11.6. */
const inicioAnio = `${new Date().getFullYear()}-01-01`;

export const DESCUNTOS_SIMULADOS: Descuento[] = [
  {
    id: 1,
    nombre: 'Primera compra',
    codigo: null,
    tipo: 'PORCENTAJE',
    valor: 10,
    aplicacion: 'AUTOMATICO',
    soloPrimeraCompra: true,
    montoMinimo: null,
    minArticulos: null,
    vigenteDesde: inicioAnio,
    vigenteHasta: null,
    usosMaximos: null,
    usosPorCliente: 1,
    usosActuales: 37,
    activo: true,
  },
  {
    id: 2,
    nombre: 'Cupón de demostración',
    codigo: 'UNQ10',
    tipo: 'PORCENTAJE',
    valor: 10,
    aplicacion: 'CUPON',
    soloPrimeraCompra: false,
    montoMinimo: 500,
    minArticulos: null,
    vigenteDesde: inicioAnio,
    vigenteHasta: null,
    usosMaximos: 100,
    usosPorCliente: 1,
    usosActuales: 12,
    activo: true,
  },
];
