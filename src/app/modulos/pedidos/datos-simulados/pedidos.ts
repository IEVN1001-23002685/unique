import type { EstadoPedido, EventoPedido, LineaPedido, Pedido } from '../modelos/pedido';

/**
 * DATO DE DEMOSTRACIÓN (M09). Nada se persiste en servidor.
 * Las fechas son relativas al momento de ejecución para que los semáforos de
 * estancamiento puedan verse en verde, ámbar y rojo sin editar archivos.
 * Los folios de venta corresponden a la proyección de M08, módulo dueño del dinero.
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

function enDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  fecha.setHours(18, 0, 0, 0);
  return iso(fecha);
}

const anio = new Date().getFullYear();
const folioPedido = (numero: number): string => `PED-${anio}-${String(numero).padStart(4, '0')}`;
const folioVenta = (numero: number): string => `UNQ-${anio}-${String(numero).padStart(4, '0')}`;

/** SKU del catálogo (M10) tal como se proyectan en las ventas de demostración de M08. */
const VARIANTES: Record<string, { nombreProducto: string; talla: string; color: string }> = {
  'HOODIE-M-ROJA': { nombreProducto: 'Hoodie roja', talla: 'M', color: 'Roja' },
  'PLAYERA-CH-GRIS': { nombreProducto: 'Playera gris', talla: 'CH', color: 'Gris' },
  'PANTS-28-CAFE': { nombreProducto: 'Pants café', talla: '28', color: 'Café' },
  'GORRO-UNICA-BLANCO': { nombreProducto: 'Gorro blanco', talla: 'Única', color: 'Blanco' },
  'TOTE-UNICA-CRUD': { nombreProducto: 'Tote bag', talla: 'Única', color: 'Crudo' },
};

function linea(
  sku: string,
  cantidad: number,
  cantReservada: number,
  cantPreparada = 0,
  ordenProduccionFolio: string | null = null,
  fechaEstimada: string | null = null,
): LineaPedido {
  const variante = VARIANTES[sku];
  if (!variante) {
    throw new Error(`Variante de demostración no encontrada: ${sku}`);
  }

  return {
    sku,
    nombreProducto: variante.nombreProducto,
    talla: variante.talla,
    color: variante.color,
    cantidad,
    cantReservada,
    cantPendiente: cantidad - cantReservada,
    cantPreparada,
    ordenProduccionFolio,
    fechaEstimada,
  };
}

function evento(
  id: number,
  horasAtras: number,
  usuario: string,
  descripcion: string,
  estado: EstadoPedido,
  visibleCliente = true,
): EventoPedido {
  return {
    id,
    fecha: haceHoras(horasAtras),
    usuario,
    descripcion,
    estado,
    visibleCliente,
  };
}

export const PEDIDOS_SIMULADOS: Pedido[] = [
  {
    id: 1,
    folio: folioPedido(481),
    ventaFolio: folioVenta(481),
    cliente: 'María Fernanda López',
    estado: 'EN_PREPARACION',
    estadoDesde: haceHoras(20),
    fechaCreacion: haceHoras(26),
    fechaPromesa: enDias(2),
    entregadoEn: null,
    prioridad: 'NORMAL',
    estadoPago: 'PAGADA',
    canceladoEn: null,
    motivoCancelacion: null,
    canceladoPor: null,
    preparacionFolio: 'PREP-0481',
    entregaGuia: null,
    lineas: [
      linea('HOODIE-M-ROJA', 1, 1, 1),
      linea('PLAYERA-CH-GRIS', 2, 2, 2),
    ],
    eventos: [
      evento(1, 26, 'Sistema', 'Pedido creado a partir de la venta confirmada.', 'RECIBIDO'),
      evento(2, 25, 'Sistema', 'Pago aprobado y líneas reservadas.', 'CONFIRMADO'),
      evento(3, 20, 'Operativo Ramírez', 'Pedido tomado para preparación.', 'EN_PREPARACION'),
    ],
    notas: [
      {
        id: 1,
        fecha: haceHoras(19),
        usuario: 'Operativo Ramírez',
        texto: 'Verificar que la talla M esté etiquetada antes del empaque.',
      },
    ],
  },
  {
    id: 2,
    folio: folioPedido(482),
    ventaFolio: folioVenta(482),
    cliente: 'Jorge Alberto Ruiz',
    estado: 'RECIBIDO',
    estadoDesde: haceHoras(2.5),
    fechaCreacion: haceHoras(2.5),
    fechaPromesa: enDias(3),
    entregadoEn: null,
    prioridad: 'ALTA',
    estadoPago: 'PENDIENTE',
    canceladoEn: null,
    motivoCancelacion: null,
    canceladoPor: null,
    preparacionFolio: null,
    entregaGuia: null,
    lineas: [linea('PANTS-28-CAFE', 1, 0)],
    eventos: [
      evento(4, 2.5, 'Sistema', 'Venta manual creada; transferencia por validar en M08.', 'RECIBIDO'),
    ],
    notas: [],
  },
  {
    id: 3,
    folio: folioPedido(483),
    ventaFolio: folioVenta(483),
    cliente: 'Lucía Martínez Soto',
    estado: 'EN_PRODUCCION',
    estadoDesde: haceHoras(72),
    fechaCreacion: haceHoras(96),
    fechaPromesa: enDias(4),
    entregadoEn: null,
    prioridad: 'NORMAL',
    estadoPago: 'PAGADA',
    canceladoEn: null,
    motivoCancelacion: null,
    canceladoPor: null,
    preparacionFolio: null,
    entregaGuia: null,
    lineas: [
      linea('TOTE-UNICA-CRUD', 1, 0, 0, `ORD-${anio}-0034`, enDias(4)),
      linea('GORRO-UNICA-BLANCO', 2, 2, 0),
    ],
    eventos: [
      evento(5, 96, 'Sistema', 'Pedido creado y pago recibido.', 'RECIBIDO'),
      evento(6, 95, 'Sistema', 'Faltó existencia de una prenda; se envió demanda a M16.', 'EN_PRODUCCION'),
      evento(7, 90, 'Sistema', 'Orden de producción vinculada al pedido.', 'EN_PRODUCCION', false),
    ],
    notas: [],
  },
  {
    id: 4,
    // La venta UNQ-484 corresponde al pedido original PED-479 (resolución de M07).
    folio: folioPedido(479),
    ventaFolio: folioVenta(484),
    cliente: 'Ana Sofía Torres',
    estado: 'ENTREGADO',
    estadoDesde: haceHoras(3 * 24),
    fechaCreacion: haceHoras(9 * 24),
    fechaPromesa: haceHoras(4 * 24),
    entregadoEn: haceHoras(3 * 24),
    prioridad: 'ALTA',
    estadoPago: 'REEMBOLSADA_PARCIAL',
    canceladoEn: null,
    motivoCancelacion: null,
    canceladoPor: null,
    preparacionFolio: 'PREP-0479',
    entregaGuia: `GUI-${anio}-0479`,
    lineas: [linea('HOODIE-M-ROJA', 1, 1, 1)],
    eventos: [
      evento(8, 9 * 24, 'Sistema', 'Pedido entregado; surgió un cambio de talla.', 'ENTREGADO'),
      evento(
        9,
        3 * 24,
        'Administradora Torres',
        'M07 resolvió el cambio y M08 registró el reembolso parcial.',
        'ENTREGADO',
        false,
      ),
    ],
    notas: [
      {
        id: 2,
        fecha: haceHoras(28),
        usuario: 'Administradora Torres',
        texto: 'Prioridad alta: el cliente está esperando una fecha prometida cercana.',
      },
    ],
  },
  {
    id: 5,
    folio: folioPedido(485),
    ventaFolio: folioVenta(485),
    cliente: 'Diego Hernández Cruz',
    estado: 'LISTO_ENVIO',
    estadoDesde: haceHoras(18),
    fechaCreacion: haceHoras(50),
    fechaPromesa: enDias(2),
    entregadoEn: null,
    prioridad: 'NORMAL',
    estadoPago: 'PAGADA',
    canceladoEn: null,
    motivoCancelacion: null,
    canceladoPor: null,
    preparacionFolio: 'PREP-0485',
    entregaGuia: null,
    lineas: [linea('PLAYERA-CH-GRIS', 3, 3, 3)],
    eventos: [
      evento(10, 50, 'Sistema', 'Pedido confirmado con reserva completa.', 'CONFIRMADO'),
      evento(11, 30, 'Operativo Ramírez', 'Preparación iniciada.', 'EN_PREPARACION'),
      evento(12, 18, 'Operativo Ramírez', 'Verificación y empaque terminados.', 'LISTO_ENVIO'),
    ],
    notas: [],
  },
  {
    id: 6,
    folio: folioPedido(486),
    ventaFolio: folioVenta(486),
    cliente: 'Carmen Villalobos Pérez',
    estado: 'CONFIRMADO',
    estadoDesde: haceHoras(8),
    fechaCreacion: haceHoras(72),
    fechaPromesa: enDias(3),
    entregadoEn: null,
    prioridad: 'ALTA',
    estadoPago: 'PAGADA',
    canceladoEn: null,
    motivoCancelacion: null,
    canceladoPor: null,
    preparacionFolio: null,
    entregaGuia: null,
    lineas: [linea('PANTS-28-CAFE', 2, 2)],
    eventos: [
      evento(13, 72, 'Sistema', 'Pedido creado con pago en efectivo por validar.', 'RECIBIDO'),
      evento(14, 8, 'Sistema', 'Pago aprobado y reserva completa; listo para M18.', 'CONFIRMADO'),
    ],
    notas: [],
  },
  {
    id: 7,
    folio: folioPedido(487),
    ventaFolio: folioVenta(487),
    cliente: 'Rafael Medina Aguilar',
    estado: 'CANCELADO',
    estadoDesde: haceHoras(12 * 24),
    fechaCreacion: haceHoras(13 * 24),
    fechaPromesa: null,
    entregadoEn: null,
    prioridad: 'NORMAL',
    estadoPago: 'REEMBOLSADA',
    canceladoEn: haceHoras(12 * 24),
    motivoCancelacion: 'El cliente canceló antes de la preparación.',
    canceladoPor: 'Cliente',
    preparacionFolio: null,
    entregaGuia: null,
    lineas: [linea('GORRO-UNICA-BLANCO', 1, 0)],
    eventos: [
      evento(16, 13 * 24, 'Sistema', 'Pedido recibido y pagado.', 'RECIBIDO'),
      evento(17, 12 * 24, 'Cliente', 'Cancelación solicitada: cambio de planes.', 'CANCELADO'),
    ],
    notas: [],
  },
  {
    id: 8,
    folio: folioPedido(601),
    ventaFolio: folioVenta(601),
    cliente: 'Fernanda Ríos Vega',
    estado: 'EN_REPARTO',
    estadoDesde: haceHoras(5),
    fechaCreacion: haceHoras(8 * 24),
    fechaPromesa: enDias(1),
    entregadoEn: null,
    prioridad: 'NORMAL',
    estadoPago: 'PAGADA',
    canceladoEn: null,
    motivoCancelacion: null,
    canceladoPor: null,
    preparacionFolio: 'PREP-0601',
    entregaGuia: `GUI-${anio}-0601`,
    lineas: [linea('HOODIE-M-ROJA', 1, 1, 1)],
    eventos: [
      evento(18, 8 * 24, 'Sistema', 'Pedido confirmado.', 'CONFIRMADO'),
      evento(19, 6 * 24, 'Operativo Soto', 'Pedido listo para envío.', 'LISTO_ENVIO'),
      evento(20, 5, 'Repartidor Pérez', 'Salida confirmada con guía de entrega.', 'EN_REPARTO'),
    ],
    notas: [],
  },
  {
    id: 9,
    folio: folioPedido(602),
    ventaFolio: folioVenta(602),
    cliente: 'Óscar Mejía Herrera',
    estado: 'RECIBIDO',
    estadoDesde: haceHoras(1),
    fechaCreacion: haceHoras(1),
    fechaPromesa: enDias(3),
    entregadoEn: null,
    prioridad: 'NORMAL',
    estadoPago: 'PENDIENTE',
    canceladoEn: null,
    motivoCancelacion: null,
    canceladoPor: null,
    preparacionFolio: null,
    entregaGuia: null,
    lineas: [linea('PLAYERA-CH-GRIS', 2, 0)],
    eventos: [
      evento(21, 1, 'Sistema', 'Venta manual creada; pendiente de validación de pago.', 'RECIBIDO'),
    ],
    notas: [],
  },
  {
    id: 10,
    folio: folioPedido(603),
    ventaFolio: folioVenta(603),
    cliente: 'Patricia Nájera Luna',
    estado: 'CANCELADO',
    estadoDesde: haceHoras(3 * 24),
    fechaCreacion: haceHoras(5 * 24),
    fechaPromesa: null,
    entregadoEn: null,
    prioridad: 'NORMAL',
    estadoPago: 'REEMBOLSADA',
    canceladoEn: haceHoras(3 * 24),
    motivoCancelacion: 'Cambio de fecha de entrega solicitado por teléfono.',
    canceladoPor: 'Administradora Torres',
    preparacionFolio: null,
    entregaGuia: null,
    lineas: [linea('TOTE-UNICA-CRUD', 1, 0)],
    eventos: [
      evento(22, 5 * 24, 'Sistema', 'Pedido recibido con pago aprobado.', 'RECIBIDO'),
      evento(23, 3 * 24, 'Administradora Torres', 'Cancelado a petición del cliente.', 'CANCELADO'),
    ],
    notas: [],
  },
];
