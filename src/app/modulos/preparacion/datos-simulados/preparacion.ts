import type { DireccionEntrega, Incidencia, ReglaEmpaque } from '../modelos/preparacion';

/**
 * DATOS DE DEMOSTRACIÓN (M18). Nada se persiste en servidor.
 * Las direcciones son ejemplos de interfaz; en producción se leen de
 * venta_direccion (M05/M08) y las reglas de empaque de empaque_regla (M15).
 */

const dos = (valor: number): string => String(valor).padStart(2, '0');

function iso(fecha: Date): string {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:00`;
}

function haceHoras(horas: number): string {
  const fecha = new Date();
  fecha.setHours(fecha.getHours() - horas);
  return iso(fecha);
}

const anio = new Date().getFullYear();
export const folioPedidoDemo = (numero: number): string =>
  `PED-${anio}-${String(numero).padStart(4, '0')}`;
const folioIncidencia = (numero: number): string =>
  `INC-${anio}-${String(numero).padStart(4, '0')}`;

export const REGLAS_EMPAQUE_SIMULADAS: ReglaEmpaque[] = [
  {
    materialId: 'EMP-BOL',
    nombre: 'Bolsa individual',
    base: 'POR_PRENDA',
    cantidad: 1,
    activa: true,
  },
  {
    materialId: 'EMP-PAP',
    nombre: 'Papel protector',
    base: 'POR_PRENDA',
    cantidad: 1,
    activa: true,
  },
  {
    materialId: 'EMP-TAR',
    nombre: 'Tarjeta con QR',
    base: 'POR_PEDIDO',
    cantidad: 1,
    activa: true,
  },
  {
    materialId: 'EMP-ETE',
    nombre: 'Etiqueta de envío',
    base: 'POR_PEDIDO',
    cantidad: 1,
    activa: true,
  },
];

export const DIRECCIONES_SIMULADAS: Record<string, DireccionEntrega> = {
  [folioPedidoDemo(481)]: {
    destinatario: 'María Fernanda López',
    calle: 'Av. Universidad 123, int. 4',
    colonia: 'Centro',
    cp: '37000',
    ciudad: 'León',
    estado: 'Guanajuato',
    telefono: '477 123 4567',
  },
  [folioPedidoDemo(485)]: {
    destinatario: 'Diego Hernández Cruz',
    calle: 'Calle Madero 218',
    colonia: 'San Miguel',
    cp: '37230',
    ciudad: 'León',
    estado: 'Guanajuato',
    telefono: '477 987 6543',
  },
  [folioPedidoDemo(486)]: {
    destinatario: 'Carmen Villalobos Pérez',
    calle: 'Blvd. Adolfo López Mateos 845',
    colonia: 'Jardines de Jerez',
    cp: '37520',
    ciudad: 'León',
    estado: 'Guanajuato',
    telefono: '477 555 0198',
  },
};

/** Dirección neutral cuando el pedido de ejemplo no trae una dirección simulada. */
export function direccionPara(folio: string, cliente: string): DireccionEntrega {
  return (
    DIRECCIONES_SIMULADAS[folio] ?? {
      destinatario: cliente,
      calle: 'Consultar en la venta (M05)',
      colonia: '—',
      cp: '—',
      ciudad: '—',
      estado: '—',
      telefono: '—',
    }
  );
}

export interface DetallePreparacionSimulado {
  tomadaPor: string;
  surtidas: Record<string, number>;
  verificado: boolean;
  nota: string;
}

/** Detalles solo de las hojas que ya existen en el estado inicial de M09. */
export const DETALLES_PREPARACION: Record<string, DetallePreparacionSimulado> = {
  [folioPedidoDemo(481)]: {
    tomadaPor: 'Operativo Ramírez',
    surtidas: { 'HOODIE-M-ROJA': 1, 'PLAYERA-CH-GRIS': 1 },
    verificado: false,
    nota: 'Verificar que la talla M esté etiquetada antes del empaque.',
  },
  [folioPedidoDemo(485)]: {
    tomadaPor: 'Operativo Ramírez',
    surtidas: { 'PLAYERA-CH-GRIS': 3 },
    verificado: true,
    nota: '',
  },
};

export const INCIDENCIAS_SIMULADAS: Incidencia[] = [
  {
    id: 241,
    folio: folioIncidencia(241),
    preparacionFolio: 'PREP-0481',
    pedidoFolio: folioPedidoDemo(481),
    sku: 'PLAYERA-CH-GRIS',
    tipo: 'CANTIDAD',
    descripcion:
      'La reserva indicaba 2 unidades; físicamente se localizó 1. Falta surtir la segunda unidad.',
    cantidad: 1,
    fecha: haceHoras(3),
    usuario: 'Operativo Ramírez',
    estado: 'ABIERTA',
    resolucion: null,
  },
  {
    id: 240,
    folio: folioIncidencia(240),
    preparacionFolio: 'PREP-0481',
    pedidoFolio: folioPedidoDemo(481),
    sku: 'HOODIE-L-ROJA',
    tipo: 'SKU',
    descripcion:
      'Se escaneó HOODIE-L-ROJA, que no pertenece al pedido. El sistema rechazó el escaneo.',
    cantidad: 1,
    fecha: haceHoras(5),
    usuario: 'Operativo Ramírez',
    estado: 'RESUELTA',
    resolucion: 'Escaneo rechazado; se capturó el SKU correcto del pedido.',
  },
  {
    id: 239,
    folio: folioIncidencia(239),
    preparacionFolio: 'PREP-0481',
    pedidoFolio: folioPedidoDemo(481),
    sku: 'HOODIE-M-ROJA',
    tipo: 'CALIDAD',
    descripcion:
      'Una unidad presentó bordado deshilado. Se separó para merma (etapa ALMACEN) y se tomó otra del inventario.',
    cantidad: 1,
    fecha: haceHoras(6),
    usuario: 'Operativo Ramírez',
    estado: 'RESUELTA',
    resolucion:
      'Reposición surtida. La merma real en M17 y el movimiento de material quedan pendientes de Flask.',
  },
];
