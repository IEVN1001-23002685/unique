import type { AlertaCentro, RegistroTipoAlerta, ReglaAlerta } from '../modelos/alerta-centro';

/**
 * DATOS DE DEMOSTRACIÓN DE M21. Las condiciones de M12, M09, M08 y M19 se
 * derivan en el servicio; aquí solo se declaran las alertas cuyos módulos de
 * origen (M14, M15, M16, M17 y M07) todavía no existen en el frontend.
 * Nada de esto se persiste ni representa una operación ejecutada.
 */

const dos = (valor: number): string => String(valor).padStart(2, '0');

function isoHace(horas: number): string {
  const fecha = new Date(Date.now() - horas * 3_600_000);
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:00`;
}

export const TIPOS_ALERTA: RegistroTipoAlerta[] = [
  {
    tipo: 'PT_AGOTADO_DEMANDA',
    severidadBase: 'CRITICA',
    condicion: 'Disponible 0 con pedidos esperando',
    paraQuien: 'AMBOS',
    accion: 'Generar orden de producción',
    origen: 'M12 · Inventario PT',
  },
  {
    tipo: 'PT_STOCK_MINIMO',
    severidadBase: 'PREVENTIVA',
    condicion: 'Disponible menor o igual al mínimo',
    paraQuien: 'AMBOS',
    accion: 'Generar orden de producción',
    origen: 'M12 · Inventario PT',
  },
  {
    tipo: 'MP_INSUFICIENTE',
    severidadBase: 'CRITICA',
    condicion: 'La orden requiere más material del disponible más lo que viene en compra',
    paraQuien: 'AMBOS',
    accion: 'Emitir solicitud de compra',
    origen: 'M15 · Inventario de material (pendiente)',
  },
  {
    tipo: 'MP_REORDEN',
    severidadBase: 'PREVENTIVA',
    condicion: 'Posición menor o igual al punto de reorden',
    paraQuien: 'ADMIN',
    accion: 'Emitir solicitud de compra',
    origen: 'M15 · Inventario de material (pendiente)',
  },
  {
    tipo: 'ORDEN_ROJA',
    severidadBase: 'CRITICA',
    condicion: 'Orden de producción con semáforo rojo',
    paraQuien: 'AMBOS',
    accion: 'Ver orden',
    origen: 'M16 · Producción (pendiente)',
  },
  {
    tipo: 'OC_RETRASADA',
    severidadBase: 'PREVENTIVA',
    condicion: 'Fecha prometida vencida sin recepción',
    paraQuien: 'ADMIN',
    accion: 'Ver orden de compra',
    origen: 'M14 · Compras (pendiente)',
    nota: 'Se vuelve crítica si bloquea una orden roja.',
  },
  {
    tipo: 'PEDIDO_ESTANCADO',
    severidadBase: 'PREVENTIVA',
    condicion: 'Tiempo en el estado mayor al umbral',
    paraQuien: 'AMBOS',
    accion: 'Ver pedido',
    origen: 'M09 · Pedidos',
    nota: 'Preventiva en ámbar, crítica en rojo; destinatario según etapa.',
  },
  {
    tipo: 'MERMA_ALTA',
    severidadBase: 'PREVENTIVA',
    condicion: 'Merma del mes sobre la meta por etapa o producto',
    paraQuien: 'ADMIN',
    accion: 'Ver indicador',
    origen: 'M17 · Mermas (pendiente)',
  },
  {
    tipo: 'DIFERENCIA_CONTEO',
    severidadBase: 'INFORMATIVA',
    condicion: 'Ajuste con diferencia distinta de cero',
    paraQuien: 'ADMIN',
    accion: 'Ver detalle',
    origen: 'M12 · Inventario PT',
  },
  {
    tipo: 'ENTREGA_FALLIDA',
    severidadBase: 'PREVENTIVA',
    condicion: 'Entrega no concretada',
    paraQuien: 'AMBOS',
    accion: 'Reprogramar o cancelar',
    origen: 'M19 · Entregas',
    nota: 'Crítica al segundo intento fallido.',
  },
  {
    tipo: 'DEVOLUCION_PENDIENTE',
    severidadBase: 'PREVENTIVA',
    condicion: 'Solicitud sin atender más de 48 horas o recibida sin inspección',
    paraQuien: 'AMBOS',
    accion: 'Abrir devolución',
    origen: 'M07 · Devoluciones (pendiente)',
  },
  {
    tipo: 'PAGO_PENDIENTE',
    severidadBase: 'PREVENTIVA',
    condicion: 'Venta manual sin pago pasado el límite',
    paraQuien: 'ADMIN',
    accion: 'Validar pago',
    origen: 'M08 · Ventas',
  },
  {
    tipo: 'PROVEEDOR_EN_REVISION',
    severidadBase: 'INFORMATIVA',
    condicion: 'Menos de 80 % de entregas a tiempo',
    paraQuien: 'ADMIN',
    accion: 'Ver proveedor',
    origen: 'M13 · Proveedores',
  },
  {
    tipo: 'DISENO_PENDIENTE',
    severidadBase: 'INFORMATIVA',
    condicion: 'Producción con diseño de bordado sin digitalizar',
    paraQuien: 'ADMIN',
    accion: 'Abrir diseño',
    origen: 'M16 · Producción (pendiente)',
  },
];

/** Umbrales del §11.5; los marcados como propuesta requieren confirmación. */
export const REGLAS_INICIALES: ReglaAlerta[] = [
  {
    clave: 'merma_meta_pct',
    etiqueta: 'Meta de merma',
    valor: 5,
    unidad: '%',
    descripcion: 'Merma del mes por etapa o producto que dispara MERMA_ALTA.',
    propuesta: false,
    min: 0,
    max: 50,
  },
  {
    clave: 'proveedor_minimo_a_tiempo_pct',
    etiqueta: 'Entregas a tiempo de proveedor',
    valor: 80,
    unidad: '%',
    descripcion: 'Por debajo de este valor se abre PROVEEDOR_EN_REVISION.',
    propuesta: false,
    min: 0,
    max: 100,
  },
  {
    clave: 'horas_max_recibido',
    etiqueta: 'Máximo en Recibido',
    valor: 2,
    unidad: 'h',
    descripcion: 'Umbral de estancamiento y pago pendiente en etapa inicial.',
    propuesta: false,
    min: 1,
    max: 720,
  },
  {
    clave: 'horas_max_confirmado',
    etiqueta: 'Máximo en Confirmado',
    valor: 24,
    unidad: 'h',
    descripcion: 'Umbral de estancamiento del pedido confirmado.',
    propuesta: false,
    min: 1,
    max: 720,
  },
  {
    clave: 'dias_max_en_produccion',
    etiqueta: 'Máximo en Producción',
    valor: 7,
    unidad: 'd',
    descripcion: 'Umbral de estancamiento de la orden de producción.',
    propuesta: false,
    min: 1,
    max: 90,
  },
  {
    clave: 'horas_max_en_preparacion',
    etiqueta: 'Máximo en Preparación',
    valor: 24,
    unidad: 'h',
    descripcion: 'Umbral de estancamiento antes de salida.',
    propuesta: false,
    min: 1,
    max: 720,
  },
  {
    clave: 'horas_max_listo_envio',
    etiqueta: 'Máximo en Listo para envío',
    valor: 24,
    unidad: 'h',
    descripcion: 'Umbral de estancamiento previo a la asignación de reparto.',
    propuesta: false,
    min: 1,
    max: 720,
  },
  {
    clave: 'horas_max_en_reparto',
    etiqueta: 'Máximo en Reparto',
    valor: 24,
    unidad: 'h',
    descripcion: 'Umbral de estancamiento durante la entrega.',
    propuesta: false,
    min: 1,
    max: 720,
  },
  {
    clave: 'horas_alerta_devolucion',
    etiqueta: 'Alerta de devolución',
    valor: 48,
    unidad: 'h',
    descripcion: 'Solicitud sin atender que dispara DEVOLUCION_PENDIENTE.',
    propuesta: false,
    min: 1,
    max: 720,
  },
  {
    clave: 'max_intentos_entrega',
    etiqueta: 'Intentos de entrega',
    valor: 2,
    unidad: 'intentos',
    descripcion: 'Fallos repetidos antes de elevar ENTREGA_FALLIDA a crítica.',
    propuesta: true,
    min: 1,
    max: 5,
  },
  {
    clave: 'dias_devolucion',
    etiqueta: 'Ventana de devolución',
    valor: 15,
    unidad: 'd',
    descripcion: 'Ventana de cambios y devoluciones; parámetro propuesto.',
    propuesta: true,
    min: 1,
    max: 90,
  },
];

const demo = (
  id: string,
  datos: Pick<
    AlertaCentro,
    | 'tipo'
    | 'severidad'
    | 'titulo'
    | 'detalle'
    | 'entidadTipo'
    | 'entidadId'
    | 'rolDestino'
    | 'accionSugerida'
    | 'ruta'
    | 'origen'
  > &
    Partial<Pick<AlertaCentro, 'abiertaEn'>>,
  horas: number,
): AlertaCentro => {
  const { abiertaEn, ...resto } = datos;
  return {
    id: `demo-${id}`,
    estado: 'ABIERTA',
    claveUnica: `${resto.tipo}:${resto.entidadTipo}:${resto.entidadId}`,
    abiertaEn: abiertaEn ?? isoHace(horas),
    atendidaPor: null,
    atendidaEn: null,
    demo: true,
    ...resto,
  };
};

/** Siete tipos de los módulos aún no implementados; el resto se deriva en el servicio. */
export const ALERTAS_DEMO: AlertaCentro[] = [
  demo(
    'mp-insuficiente',
    {
      tipo: 'MP_INSUFICIENTE',
      severidad: 'CRITICA',
      titulo: 'Felpa negra insuficiente · OP-0112',
      detalle:
        'La orden requiere 40 kg; hay 0 kg disponibles y 12 kg en compra. Sin orden de compra que cubra el faltante.',
      entidadTipo: 'orden_produccion',
      entidadId: 'OP-0112',
      rolDestino: 'AMBOS',
      accionSugerida: 'Emitir solicitud de compra',
      ruta: ['/dashboard', 'abastecimiento'],
      origen: 'M15 · Inventario de material (pendiente)',
    },
    4,
  ),
  demo(
    'mp-reorden',
    {
      tipo: 'MP_REORDEN',
      severidad: 'PREVENTIVA',
      titulo: 'Cierre 60 cm bajo el punto de reorden',
      detalle:
        'Posición 18 unidades contra punto de reorden de 25. La solicitud debe emitirse en M14.',
      entidadTipo: 'material',
      entidadId: 'MP-CIE-002',
      rolDestino: 'ADMIN',
      accionSugerida: 'Emitir solicitud de compra',
      ruta: ['/dashboard', 'abastecimiento'],
      origen: 'M15 · Inventario de material (pendiente)',
    },
    9,
  ),
  demo(
    'orden-roja',
    {
      tipo: 'ORDEN_ROJA',
      severidad: 'CRITICA',
      titulo: 'Orden roja · OP-0114',
      detalle:
        'Lleva 14 h en revisión con material sin recepción. El plan de 200 piezas lleva 118 aprobadas.',
      entidadTipo: 'orden_produccion',
      entidadId: 'OP-0114',
      rolDestino: 'AMBOS',
      accionSugerida: 'Ver orden',
      ruta: ['/dashboard', 'produccion-merma'],
      origen: 'M16 · Producción (pendiente)',
    },
    14,
  ),
  demo(
    'oc-retrasada',
    {
      tipo: 'OC_RETRASADA',
      severidad: 'CRITICA',
      titulo: 'OC-0084 retrasada y bloquea OP-0112',
      detalle:
        'Compromiso vencido del proveedor Textiles León; sin recepción y con orden roja asociada.',
      entidadTipo: 'orden_compra',
      entidadId: 'OC-0084',
      rolDestino: 'ADMIN',
      accionSugerida: 'Ver orden de compra',
      ruta: ['/dashboard', 'abastecimiento'],
      origen: 'M14 · Compras (pendiente)',
    },
    30,
  ),
  demo(
    'merma-alta',
    {
      tipo: 'MERMA_ALTA',
      severidad: 'PREVENTIVA',
      titulo: 'Merma de corte por encima de la meta',
      detalle:
        'Corte acumula 27 unidades en el mes contra meta de 5 %; causa principal: tela manchada.',
      entidadTipo: 'etapa',
      entidadId: 'Corte',
      rolDestino: 'ADMIN',
      accionSugerida: 'Ver indicador',
      ruta: ['/dashboard', 'produccion-merma'],
      origen: 'M17 · Mermas (pendiente)',
    },
    20,
  ),
  demo(
    'devolucion-pendiente',
    {
      tipo: 'DEVOLUCION_PENDIENTE',
      severidad: 'PREVENTIVA',
      titulo: 'Devolución sin atender · VTA-1042',
      detalle:
        'Solicitud por cambio de talla abierta hace más de 48 h, sin inspección del almacén.',
      entidadTipo: 'devolucion',
      entidadId: 'VTA-1042',
      rolDestino: 'AMBOS',
      accionSugerida: 'Abrir devolución',
      ruta: ['/dashboard', 'logistica-devoluciones'],
      origen: 'M07 · Devoluciones (pendiente)',
    },
    52,
  ),
  demo(
    'diseno-pendiente',
    {
      tipo: 'DISENO_PENDIENTE',
      severidad: 'INFORMATIVA',
      titulo: 'Diseño de bordado sin digitalizar · OP-0121',
      detalle:
        'La orden de gorros tiene diseño pendiente de digitalización antes de iniciar bordado.',
      entidadTipo: 'orden_produccion',
      entidadId: 'OP-0121',
      rolDestino: 'ADMIN',
      accionSugerida: 'Abrir diseño',
      ruta: ['/dashboard', 'produccion-merma'],
      origen: 'M16 · Producción (pendiente)',
    },
    33,
  ),
];
