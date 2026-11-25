import type {
  DireccionVenta,
  EstadoPedido,
  EstadoPago,
  LineaVenta,
  MetodoPago,
  PagoVenta,
  Venta,
} from '../modelos/venta';
import { VARIANTES_SIMULADAS } from './variantes';

/**
 * DATO DE DEMOSTRACIÓN (M08). Nada de esto se persiste en servidor.
 * Las fechas se generan relativas al día de ejecución para que los
 * indicadores «ventas del día / del mes» sean siempre coherentes.
 */

const dos = (valor: number): string => String(valor).padStart(2, '0');

function fechaLocal(diasAtras: number, hora: number, minuto: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - diasAtras);
  fecha.setHours(hora, minuto, 0, 0);
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(hora)}:${dos(minuto)}:00`;
}

const folioVenta = (numero: number): string =>
  `UNQ-${new Date().getFullYear()}-${String(numero).padStart(4, '0')}`;
const folioPedido = (numero: number): string =>
  `PED-${new Date().getFullYear()}-${String(numero).padStart(4, '0')}`;

function linea(sku: string, cantidad: number): LineaVenta {
  const variante = VARIANTES_SIMULADAS.find((item) => item.sku === sku);
  if (!variante) {
    throw new Error(`Variante de demostración no encontrada: ${sku}`);
  }

  return {
    sku: variante.sku,
    nombreProducto: variante.nombreProducto,
    talla: variante.talla,
    color: variante.color,
    cantidad,
    precioUnitario: variante.precioUnitario,
    subtotal: variante.precioUnitario * cantidad,
    costoEstandarUnitario: variante.costoEstandarUnitario,
  };
}

function direcciones(
  destinatario: string,
  calle: string,
  numero: string,
  codigoPostal: string,
  rfc: string | null = null,
  razonSocial: string | null = null,
): DireccionVenta[] {
  const base = {
    destinatario,
    telefono: '4771234567',
    calle,
    numeroExt: numero,
    numeroInt: null,
    colonia: 'Centro',
    municipio: 'León',
    estado: 'Guanajuato',
    codigoPostal,
    referencia: 'Entre calles 5 de Mayo y Madero',
  };

  return [
    { tipo: 'ENVIO', ...base, rfc: null, razonSocial: null },
    {
      tipo: 'FACTURACION',
      ...base,
      rfc,
      razonSocial,
    },
  ];
}

function pago(
  id: number,
  tipo: 'COBRO' | 'REEMBOLSO',
  metodo: MetodoPago,
  estado: 'APROBADO' | 'PENDIENTE',
  monto: number,
  referencia: string,
  fecha: string,
  ultimos4: string | null = null,
  titular: string | null = null,
  motivoRechazo: string | null = null,
): PagoVenta {
  return {
    id,
    tipo,
    metodo,
    estado,
    monto,
    referencia,
    ultimos4,
    titular,
    motivoRechazo,
    fecha,
    registradoPor: 'Administrador',
  };
}

type ConfiguracionVenta = Omit<Venta, 'subtotal' | 'total' | 'ivaIncluido'>;

function venta(configuracion: ConfiguracionVenta): Venta {
  const subtotal = configuracion.lineas.reduce((suma, item) => suma + item.subtotal, 0);
  const total = subtotal - configuracion.descuentoMonto + configuracion.costoEnvio;
  const iva = (total / 1.16) * 0.16;

  return {
    ...configuracion,
    subtotal,
    total,
    ivaIncluido: Math.round(iva * 100) / 100,
  };
}

const estadoPago = (valor: EstadoPago): EstadoPago => valor;
const estadoPedido = (valor: EstadoPedido): EstadoPedido => valor;

export const VENTAS_SIMULADAS: Venta[] = [
  venta({
    id: 1,
    folio: folioVenta(481),
    cliente: 'María Fernanda López',
    clienteId: 1,
    fecha: fechaLocal(0, 10, 14),
    canal: 'TIENDA',
    estado: 'ACTIVA',
    estadoPago: estadoPago('PAGADA'),
    estadoPedido: estadoPedido('EN_PREPARACION'),
    pedidoFolio: folioPedido(481),
    descuentoId: 1,
    descuentoNombre: 'Primera compra',
    descuentoMonto: 141,
    costoEnvio: 200,
    requiereFactura: true,
    fechaPromesa: fechaLocal(-2, 18, 0),
    canceladaEn: null,
    motivoCancelacion: null,
    creadaPor: 'Cliente',
    notas: 'Envio local León.',
    lineas: [linea('SD-GD-NG', 1), linea('PL-GD-GR', 2)],
    direcciones: direcciones(
      'María Fernanda López',
      'Calle Madero',
      '123',
      '37000',
      'LULF900312AB1',
      'María Fernanda López Soto',
    ),
    pagos: [
      pago(
        1,
        'COBRO',
        'TARJETA',
        'APROBADO',
        1469,
        'SIM-000121',
        fechaLocal(0, 10, 15),
        '4242',
        'María Fernanda López',
      ),
    ],
  }),
  venta({
    id: 2,
    folio: folioVenta(482),
    cliente: 'Jorge Alberto Ruiz',
    clienteId: 2,
    fecha: fechaLocal(0, 9, 2),
    canal: 'MANUAL',
    estado: 'ACTIVA',
    estadoPago: estadoPago('PENDIENTE'),
    estadoPedido: estadoPedido('RECIBIDO'),
    pedidoFolio: folioPedido(482),
    descuentoId: null,
    descuentoNombre: null,
    descuentoMonto: 0,
    costoEnvio: 200,
    requiereFactura: false,
    fechaPromesa: fechaLocal(-1, 18, 0),
    canceladaEn: null,
    motivoCancelacion: null,
    creadaPor: 'Administrador',
    notas: 'Venta manual; transferencia por validar.',
    lineas: [linea('PN-GD-NG', 1)],
    direcciones: direcciones('Jorge Alberto Ruiz', 'Av. González de Cosío', '88', '37290'),
    pagos: [pago(2, 'COBRO', 'TRANSFERENCIA', 'PENDIENTE', 700, 'SIM-000122', fechaLocal(0, 9, 3))],
  }),
  venta({
    id: 3,
    folio: folioVenta(483),
    cliente: 'Lucía Martínez Soto',
    clienteId: 3,
    fecha: fechaLocal(1, 16, 41),
    canal: 'TIENDA',
    estado: 'ACTIVA',
    estadoPago: estadoPago('PAGADA'),
    estadoPedido: estadoPedido('EN_PRODUCCION'),
    pedidoFolio: folioPedido(483),
    descuentoId: null,
    descuentoNombre: null,
    descuentoMonto: 0,
    costoEnvio: 200,
    requiereFactura: false,
    fechaPromesa: fechaLocal(-2, 18, 0),
    canceladaEn: null,
    motivoCancelacion: null,
    creadaPor: 'Cliente',
    notas: 'Incluye gorro para regalo.',
    lineas: [linea('BO-UN-GR', 1), linea('GO-UN-BL', 2)],
    direcciones: direcciones('Lucía Martínez Soto', 'Calle Díaz de León', '210', '37050'),
    pagos: [pago(3, 'COBRO', 'CUENTA', 'APROBADO', 1610, 'SIM-000119', fechaLocal(1, 16, 42))],
  }),
  venta({
    id: 4,
    folio: folioVenta(484),
    cliente: 'Ana Sofía Torres',
    clienteId: null,
    fecha: fechaLocal(3, 12, 26),
    canal: 'CAMBIO',
    estado: 'ACTIVA',
    estadoPago: estadoPago('REEMBOLSADA_PARCIAL'),
    estadoPedido: estadoPedido('ENTREGADO'),
    pedidoFolio: folioPedido(479),
    descuentoId: null,
    descuentoNombre: null,
    descuentoMonto: 0,
    costoEnvio: 0,
    requiereFactura: false,
    fechaPromesa: null,
    canceladaEn: null,
    motivoCancelacion: null,
    creadaPor: 'Administrador',
    notas: 'Resolución de M07: reembolso parcial por talla.',
    lineas: [linea('SD-GD-NG', 1)],
    direcciones: direcciones('Ana Sofía Torres', 'Calle 5 de Mayo', '45', '37120'),
    pagos: [
      pago(
        4,
        'COBRO',
        'TARJETA',
        'APROBADO',
        850,
        'SIM-000114',
        fechaLocal(9, 11, 10),
        '1122',
        'Ana Sofía Torres',
      ),
      pago(
        5,
        'REEMBOLSO',
        'EFECTIVO',
        'APROBADO',
        280,
        'SIM-000115',
        fechaLocal(3, 12, 30),
        null,
        null,
        'Cambio de talla resuelto con reembolso parcial',
      ),
    ],
  }),
  venta({
    id: 5,
    folio: folioVenta(485),
    cliente: 'Diego Hernández Cruz',
    clienteId: 4,
    fecha: fechaLocal(5, 18, 7),
    canal: 'TIENDA',
    estado: 'ACTIVA',
    estadoPago: estadoPago('PAGADA'),
    estadoPedido: estadoPedido('LISTO_ENVIO'),
    pedidoFolio: folioPedido(485),
    descuentoId: 2,
    descuentoNombre: 'Cupón de demostración',
    descuentoMonto: 84,
    costoEnvio: 200,
    requiereFactura: false,
    fechaPromesa: fechaLocal(-1, 18, 0),
    canceladaEn: null,
    motivoCancelacion: null,
    creadaPor: 'Cliente',
    notas: 'Cupón aplicado en checkout.',
    lineas: [linea('PL-GD-GR', 3)],
    direcciones: direcciones('Diego Hernández Cruz', 'Blvd. Adolfo López Mateos', '1500', '37260'),
    pagos: [
      pago(
        6,
        'COBRO',
        'TARJETA',
        'APROBADO',
        956,
        'SIM-000117',
        fechaLocal(5, 18, 8),
        '8899',
        'Diego Hernández',
      ),
    ],
  }),
  venta({
    id: 6,
    folio: folioVenta(486),
    cliente: 'Carmen Villalobos Pérez',
    clienteId: null,
    fecha: fechaLocal(8, 11, 53),
    canal: 'MANUAL',
    estado: 'ACTIVA',
    estadoPago: estadoPago('PAGADA'),
    estadoPedido: estadoPedido('CONFIRMADO'),
    pedidoFolio: folioPedido(486),
    descuentoId: null,
    descuentoNombre: null,
    descuentoMonto: 0,
    costoEnvio: 200,
    requiereFactura: true,
    fechaPromesa: fechaLocal(-3, 18, 0),
    canceladaEn: null,
    motivoCancelacion: null,
    creadaPor: 'Administrador',
    notas: 'Venta manual en efectivo.',
    lineas: [linea('PN-GD-NG', 2)],
    direcciones: direcciones(
      'Carmen Villalobos Pérez',
      'Calle Ignacio Zaragoza',
      '77',
      '37000',
      'VIPC710425H29',
      'Carmen Villalobos Pérez',
    ),
    pagos: [pago(7, 'COBRO', 'EFECTIVO', 'APROBADO', 1200, 'SIM-000118', fechaLocal(8, 11, 55))],
  }),
  venta({
    id: 7,
    folio: folioVenta(487),
    cliente: 'Rafael Medina Aguilar',
    clienteId: null,
    fecha: fechaLocal(12, 13, 19),
    canal: 'TIENDA',
    estado: 'CANCELADA',
    estadoPago: estadoPago('REEMBOLSADA'),
    estadoPedido: estadoPedido('CANCELADO'),
    pedidoFolio: folioPedido(487),
    descuentoId: null,
    descuentoNombre: null,
    descuentoMonto: 0,
    costoEnvio: 200,
    requiereFactura: false,
    fechaPromesa: null,
    canceladaEn: fechaLocal(12, 15, 2),
    motivoCancelacion: 'El cliente canceló antes de la preparación.',
    creadaPor: 'Cliente',
    notas: 'Reembolso simulado completo; reservas liberadas por M12.',
    lineas: [linea('GO-UN-BL', 1)],
    direcciones: direcciones('Rafael Medina Aguilar', 'Calle Corregidora', '302', '37300'),
    pagos: [
      pago(
        8,
        'COBRO',
        'TARJETA',
        'APROBADO',
        480,
        'SIM-000111',
        fechaLocal(12, 13, 20),
        '3344',
        'Rafael Medina',
      ),
      pago(
        9,
        'REEMBOLSO',
        'TARJETA',
        'APROBADO',
        480,
        'SIM-000112',
        fechaLocal(12, 15, 3),
        null,
        null,
        'Cancelación de venta',
      ),
    ],
  }),
];
