import type { DireccionEntrega, Entrega, Repartidor } from '../modelos/entrega';

/**
 * DATOS DE DEMOSTRACIÓN (M19). Nada se persiste en servidor.
 * Las direcciones son ejemplos de interfaz; en producción se leen de
 * venta_direccion (M05/M08) y las existencias se descuentan en M12 mediante Flask.
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

/** Devuelve solo YYYY-MM-DD para fechas programadas. */
function enDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

const anio = new Date().getFullYear();
const folioPedido = (numero: number): string => `PED-${anio}-${String(numero).padStart(4, '0')}`;
const folioVenta = (numero: number): string => `UNQ-${anio}-${String(numero).padStart(4, '0')}`;
export const folioEntregaDemo = (numero: number): string =>
  `EN-${anio}-${String(numero).padStart(6, '0')}`;

export const REPARTIDORES_SIMULADOS: Repartidor[] = [
  {
    id: 1,
    nombre: 'Luis Ramírez',
    telefono: '477 145 8820',
    vehiculo: 'Motocicleta',
    activo: true,
    eliminadoEn: null,
  },
  {
    id: 2,
    nombre: 'María Elena Soto',
    telefono: '477 238 4491',
    vehiculo: 'Automóvil',
    activo: true,
    eliminadoEn: null,
  },
  {
    id: 3,
    nombre: 'Jorge Alberto Cruz',
    telefono: '477 612 7734',
    vehiculo: null,
    activo: true,
    eliminadoEn: null,
  },
  {
    id: 4,
    nombre: 'Rosa Isela Vega',
    telefono: '477 905 1162',
    vehiculo: 'Motocicleta',
    activo: false,
    eliminadoEn: null,
  },
];

const DIRECCIONES_SIMULADAS: Record<string, DireccionEntrega> = {
  [folioPedido(479)]: {
    destinatario: 'Ana Sofía Torres',
    calle: 'Calle Madero 90',
    colonia: 'Centro',
    cp: '37000',
    ciudad: 'León',
    estado: 'Guanajuato',
    telefono: '477 244 8810',
  },
  [folioPedido(485)]: {
    destinatario: 'Diego Hernández Cruz',
    calle: 'Calle Madero 218',
    colonia: 'San Miguel',
    cp: '37230',
    ciudad: 'León',
    estado: 'Guanajuato',
    telefono: '477 987 6543',
  },
  [folioPedido(486)]: {
    destinatario: 'Carmen Villalobos Pérez',
    calle: 'Blvd. Adolfo López Mateos 845',
    colonia: 'Jardines de Jerez',
    cp: '37520',
    ciudad: 'León',
    estado: 'Guanajuato',
    telefono: '477 555 0198',
  },
  [folioPedido(601)]: {
    destinatario: 'Fernanda Ríos Vega',
    calle: 'Av. Universidad 45',
    colonia: 'Jardines de Jerez',
    cp: '37520',
    ciudad: 'León',
    estado: 'Guanajuato',
    telefono: '477 331 2290',
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

const prenda = (
  sku: string,
  nombreProducto: string,
  talla: string,
  color: string,
  cantidad: number,
) => ({
  sku,
  nombreProducto,
  talla,
  color,
  cantidad,
});

/**
 * Historial de demostración del pedido 479: dos intentos fallidos que abrieron
 * una alerta crítica, decidida por el Administrador como reprogramación, y un
 * tercer intento entregado. El pedido 601 está en ruta en este momento.
 */
export const ENTREGAS_SIMULADAS: Entrega[] = [
  {
    id: 12,
    folio: folioEntregaDemo(12),
    pedidoFolio: folioPedido(479),
    ventaFolio: folioVenta(484),
    cliente: 'Ana Sofía Torres',
    prioridad: 'ALTA',
    direccion: direccionPara(folioPedido(479), 'Ana Sofía Torres'),
    repartidorId: 2,
    intento: 1,
    estado: 'FALLIDA',
    fechaProgramada: enDias(-4),
    salidaEn: haceHoras(4 * 24 + 2),
    resultadoEn: haceHoras(4 * 24),
    receptor: null,
    motivoFallo: 'AUSENTE',
    notas: 'No se localizó a la receptora en el domicilio; se dejó aviso.',
    decision: null,
    lineas: [prenda('SD-GD-NG', 'SUDADERA', 'GD', 'Negro', 1)],
  },
  {
    id: 13,
    folio: folioEntregaDemo(13),
    pedidoFolio: folioPedido(479),
    ventaFolio: folioVenta(484),
    cliente: 'Ana Sofía Torres',
    prioridad: 'ALTA',
    direccion: direccionPara(folioPedido(479), 'Ana Sofía Torres'),
    repartidorId: 2,
    intento: 2,
    estado: 'FALLIDA',
    fechaProgramada: enDias(-3),
    salidaEn: haceHoras(3 * 24 + 2),
    resultadoEn: haceHoras(3 * 24),
    receptor: null,
    motivoFallo: 'DIRECCION_INCORRECTA',
    notas:
      'La colonia indicada no coincide con el domicilio; se reprogramó por decisión del Administrador.',
    decision: 'REPROGRAMADA',
    lineas: [prenda('SD-GD-NG', 'SUDADERA', 'GD', 'Negro', 1)],
  },
  {
    id: 14,
    folio: folioEntregaDemo(14),
    pedidoFolio: folioPedido(479),
    ventaFolio: folioVenta(484),
    cliente: 'Ana Sofía Torres',
    prioridad: 'ALTA',
    direccion: direccionPara(folioPedido(479), 'Ana Sofía Torres'),
    repartidorId: 2,
    intento: 3,
    estado: 'ENTREGADA',
    fechaProgramada: enDias(-2),
    salidaEn: haceHoras(2 * 24 + 2),
    resultadoEn: haceHoras(2 * 24),
    receptor: 'Ana Sofía Torres',
    motivoFallo: null,
    notas: 'Entregada en puerta a la titular del pedido.',
    decision: null,
    lineas: [prenda('SD-GD-NG', 'SUDADERA', 'GD', 'Negro', 1)],
  },
  {
    id: 15,
    folio: folioEntregaDemo(15),
    pedidoFolio: folioPedido(601),
    ventaFolio: folioVenta(601),
    cliente: 'Fernanda Ríos Vega',
    prioridad: 'NORMAL',
    direccion: direccionPara(folioPedido(601), 'Fernanda Ríos Vega'),
    repartidorId: 1,
    intento: 1,
    estado: 'EN_RUTA',
    fechaProgramada: enDias(0),
    salidaEn: haceHoras(4),
    resultadoEn: null,
    receptor: null,
    motivoFallo: null,
    notas: null,
    decision: null,
    lineas: [prenda('SD-GD-NG', 'SUDADERA', 'GD', 'Negro', 1)],
  },
];
