import type {
  EntradaCatalogo,
  ParametroSistema,
  RegistroBitacora,
  UsuarioSistema,
} from '../modelos/administracion';

/** DATOS DE DEMOSTRACIÓN de M22. Nada se persiste ni representa operación real. */

const dos = (valor: number): string => String(valor).padStart(2, '0');

function isoHace(horas: number): string {
  const fecha = new Date(Date.now() - horas * 3_600_000);
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:00`;
}

export const USUARIOS_INICIALES: UsuarioSistema[] = [
  {
    id: 1,
    nombre: 'Paola',
    apellidos: 'Zamora',
    correo: 'paola.zamora@unique.mx',
    telefono: '4771234567',
    rol: 'ADMIN',
    estado: 'ACTIVA',
    intentosFallidos: 0,
    ultimoAcceso: isoHace(1),
    creadoEn: isoHace(24 * 90),
  },
  {
    id: 2,
    nombre: 'Luis Fernando',
    apellidos: 'Ramírez',
    correo: 'luis.ramirez@unique.mx',
    telefono: '4772345678',
    rol: 'OPERATIVO',
    estado: 'ACTIVA',
    intentosFallidos: 0,
    ultimoAcceso: isoHace(3),
    creadoEn: isoHace(24 * 40),
  },
  {
    id: 3,
    nombre: 'Ana Cristina',
    apellidos: 'Torres',
    correo: 'ana.torres@unique.mx',
    telefono: '4773456789',
    rol: 'OPERATIVO',
    estado: 'INACTIVA',
    intentosFallidos: 2,
    ultimoAcceso: isoHace(24 * 12),
    creadoEn: isoHace(24 * 60),
  },
];

const entrada = (
  id: number,
  tipo: EntradaCatalogo['tipo'],
  codigo: string,
  nombre: string,
  descripcion: string,
  extra: Partial<EntradaCatalogo> = {},
): EntradaCatalogo => ({
  id,
  tipo,
  codigo,
  nombre,
  descripcion,
  activo: true,
  ...extra,
});

/**
 * Los colores, tallas y categorías de producto coinciden con los que M10 ya
 * usa para generar SKU. El resto son ejemplos de §11.1 y §11.6.
 */
export const CATALOGOS_INICIALES: EntradaCatalogo[] = [
  entrada(1, 'COLOR', 'BL', 'Blanco', 'Color comercial', { hex: '#FFFFFF' }),
  entrada(2, 'COLOR', 'NG', 'Negro', 'Color comercial', { hex: '#1F1226' }),
  entrada(3, 'COLOR', 'GR', 'Gris', 'Color comercial', { hex: '#9A919B' }),
  entrada(4, 'COLOR', 'NA', 'No aplica', 'Solo para materiales sin color', { hex: '#C9BFCB' }),
  entrada(11, 'TALLA', 'CH', 'Chica', 'Prenda con tallas', { orden: 1 }),
  entrada(12, 'TALLA', 'MD', 'Mediana', 'Prenda con tallas', { orden: 2 }),
  entrada(13, 'TALLA', 'GD', 'Grande', 'Prenda con tallas', { orden: 3 }),
  entrada(14, 'TALLA', 'UN', 'Única', 'Gorros y bolsas', { orden: 4 }),
  entrada(21, 'CATEGORIA_PRODUCTO', 'SD', 'Sudadera', 'Con tallas', { prefijo: 'SD', usaTallas: true }),
  entrada(22, 'CATEGORIA_PRODUCTO', 'PL', 'Playera', 'Con tallas', { prefijo: 'PL', usaTallas: true }),
  entrada(23, 'CATEGORIA_PRODUCTO', 'PN', 'Pantalón', 'Con tallas', { prefijo: 'PN', usaTallas: true }),
  entrada(24, 'CATEGORIA_PRODUCTO', 'GO', 'Gorro', 'Talla única', { prefijo: 'GO', usaTallas: false }),
  entrada(25, 'CATEGORIA_PRODUCTO', 'BO', 'Bolsa de tela', 'Talla única', { prefijo: 'BO', usaTallas: false }),
  entrada(31, 'CATEGORIA_MATERIAL', 'TL', 'Tela', 'Telas y tejidos'),
  entrada(32, 'CATEGORIA_MATERIAL', 'HI', 'Hilo', 'Hilos de costura y bordado'),
  entrada(33, 'CATEGORIA_MATERIAL', 'ES', 'Estabilizador', 'Base para bordado'),
  entrada(34, 'CATEGORIA_MATERIAL', 'AV', 'Avío', 'Cierres, broches y accesorios'),
  entrada(35, 'CATEGORIA_MATERIAL', 'ET', 'Etiqueta', 'Etiquetas de marca y cuidado'),
  entrada(36, 'CATEGORIA_MATERIAL', 'EM', 'Empaque', 'Material de empaque'),
  entrada(41, 'CAUSA_MERMA', 'CM01', 'Defecto de tela', 'Tela manchada o con defecto', { aplicaA: 'MATERIAL', etapaSugerida: 'Recepción' }),
  entrada(42, 'CAUSA_MERMA', 'CM02', 'Rechazo en recepción', 'Material fuera de especificación', { aplicaA: 'MATERIAL', etapaSugerida: 'Recepción' }),
  entrada(43, 'CAUSA_MERMA', 'CM03', 'Error de corte', 'Trazo o corte incorrecto', { aplicaA: 'MATERIAL', etapaSugerida: 'Corte' }),
  entrada(44, 'CAUSA_MERMA', 'CM04', 'Error de tejido', 'Tejido con falla', { aplicaA: 'MATERIAL', etapaSugerida: 'Tejido' }),
  entrada(45, 'CAUSA_MERMA', 'CM05', 'Defecto de bordado', 'Diseño descubierto o desalineado', { aplicaA: 'AMBOS', etapaSugerida: 'Bordado' }),
  entrada(46, 'CAUSA_MERMA', 'CM06', 'Error de confección', 'Costura defectuosa', { aplicaA: 'PRODUCTO', etapaSugerida: 'Confección' }),
  entrada(47, 'CAUSA_MERMA', 'CM07', 'Defecto de acabado', 'Acabado fuera de especificación', { aplicaA: 'PRODUCTO', etapaSugerida: 'Acabado' }),
  entrada(48, 'CAUSA_MERMA', 'CM08', 'Daño en almacén', 'Daño durante guarda o conteo', { aplicaA: 'AMBOS', etapaSugerida: 'Almacén' }),
  entrada(49, 'CAUSA_MERMA', 'CM09', 'Daño en envío', 'Daño durante preparación o reparto', { aplicaA: 'PRODUCTO', etapaSugerida: 'Envío' }),
  entrada(50, 'CAUSA_MERMA', 'CM10', 'Devolución de cliente dañada', 'Producto devuelto en mal estado', { aplicaA: 'PRODUCTO', etapaSugerida: 'Inspección' }),
  entrada(51, 'CAUSA_MERMA', 'CM11', 'Encogimiento o desgaste', 'Merma por lavado o guarda', { aplicaA: 'AMBOS', etapaSugerida: 'Acabado' }),
  entrada(52, 'CAUSA_MERMA', 'CM12', 'Sobrante inservible', 'Retaje que no se aprovecha', { aplicaA: 'MATERIAL', etapaSugerida: 'Corte' }),
  entrada(53, 'CAUSA_MERMA', 'CM13', 'Otro', 'Causa no catalogada', { aplicaA: 'AMBOS', etapaSugerida: 'Revisión' }),
  entrada(61, 'TARIFA_ENVIO', 'LEON', 'Local León', 'Cobertura local con tarifa fija', {
    cpInicio: '37000',
    cpFin: '37999',
    costo: 200,
    diasEstimados: 2,
  }),
];

/** Parámetros de §11.5. Los marcados como propuesta no están confirmados. */
export const PARAMETROS_INICIALES: ParametroSistema[] = [
  { clave: 'iva_pct', etiqueta: 'IVA incluido en precios', valor: 16, unidad: '%', descripcion: 'Porcentaje informativo de IVA incluido.', propuesta: false, min: 0, max: 100, decimales: 0 },
  { clave: 'margen_objetivo_pct', etiqueta: 'Margen objetivo', valor: 55, unidad: '%', descripcion: 'Referencia para precio sugerido.', propuesta: false, min: 0, max: 100, decimales: 0 },
  { clave: 'merma_meta_pct', etiqueta: 'Meta de merma', valor: 5, unidad: '%', descripcion: 'Meta de merma y disparador de alerta.', propuesta: false, min: 0, max: 100, decimales: 0 },
  { clave: 'proveedor_minimo_a_tiempo_pct', etiqueta: 'Entregas a tiempo de proveedor', valor: 80, unidad: '%', descripcion: 'Por debajo de este valor el proveedor pasa a EN_REVISION.', propuesta: false, min: 0, max: 100, decimales: 0 },
  { clave: 'dias_devolucion', etiqueta: 'Ventana de devolución', valor: 15, unidad: 'd', descripcion: 'Ventana de cambios y devoluciones.', propuesta: true, min: 1, max: 90, decimales: 0 },
  { clave: 'max_intentos_entrega', etiqueta: 'Intentos de entrega', valor: 2, unidad: 'intentos', descripcion: 'Fallos antes de elevar alerta crítica.', propuesta: true, min: 1, max: 5, decimales: 0 },
  { clave: 'dias_produccion_estandar', etiqueta: 'Días de producción estándar', valor: 5, unidad: 'd', descripcion: 'Fecha estimada de producto bajo pedido.', propuesta: true, min: 1, max: 60, decimales: 0 },
  { clave: 'max_piezas_por_linea', etiqueta: 'Piezas máximas por línea', valor: 10, unidad: 'piezas', descripcion: 'Límite por línea del carrito.', propuesta: true, min: 1, max: 100, decimales: 0 },
  { clave: 'saldo_inicial_cuenta_simulada', etiqueta: 'Saldo inicial de cuenta simulada', valor: 5000, unidad: 'MXN', descripcion: 'Saldo de la cuenta simulada de nueva cuenta.', propuesta: true, min: 0, max: 100000, decimales: 2 },
  { clave: 'envio_gratis_desde', etiqueta: 'Envío gratis desde', valor: 0, unidad: 'MXN', descripcion: '0 significa desactivado.', propuesta: false, min: 0, max: 100000, decimales: 2 },
  { clave: 'horas_max_recibido', etiqueta: 'Máximo en Recibido', valor: 2, unidad: 'h', descripcion: 'Estancamiento y pago pendiente.', propuesta: false, min: 1, max: 720, decimales: 0 },
  { clave: 'horas_max_confirmado', etiqueta: 'Máximo en Confirmado', valor: 24, unidad: 'h', descripcion: 'Estancamiento del pedido.', propuesta: false, min: 1, max: 720, decimales: 0 },
  { clave: 'dias_max_en_produccion', etiqueta: 'Máximo en Producción', valor: 7, unidad: 'd', descripcion: 'Estancamiento de la orden.', propuesta: false, min: 1, max: 90, decimales: 0 },
  { clave: 'horas_max_en_preparacion', etiqueta: 'Máximo en Preparación', valor: 24, unidad: 'h', descripcion: 'Estancamiento antes de salida.', propuesta: false, min: 1, max: 720, decimales: 0 },
  { clave: 'horas_max_listo_envio', etiqueta: 'Máximo en Listo para envío', valor: 24, unidad: 'h', descripcion: 'Estancamiento previo a reparto.', propuesta: false, min: 1, max: 720, decimales: 0 },
  { clave: 'horas_max_en_reparto', etiqueta: 'Máximo en Reparto', valor: 24, unidad: 'h', descripcion: 'Estancamiento durante entrega.', propuesta: false, min: 1, max: 720, decimales: 0 },
  { clave: 'horas_alerta_devolucion', etiqueta: 'Alerta de devolución', valor: 48, unidad: 'h', descripcion: 'Devolución sin atender.', propuesta: false, min: 1, max: 720, decimales: 0 },
  { clave: 'dias_carrito_abandonado', etiqueta: 'Carrito abandonado', valor: 7, unidad: 'd', descripcion: 'Carritos sin actividad.', propuesta: false, min: 1, max: 90, decimales: 0 },
  { clave: 'intentos_login_max', etiqueta: 'Intentos de acceso', valor: 5, unidad: 'intentos', descripcion: 'Fallos permitidos antes de bloquear.', propuesta: false, min: 1, max: 20, decimales: 0 },
  { clave: 'bloqueo_login_min', etiqueta: 'Bloqueo de acceso', valor: 15, unidad: 'min', descripcion: 'Duración del bloqueo temporal.', propuesta: false, min: 1, max: 1440, decimales: 0 },
  { clave: 'vigencia_recuperacion_min', etiqueta: 'Vigencia de recuperación', valor: 30, unidad: 'min', descripcion: 'Validez del token de contraseña de un solo uso.', propuesta: false, min: 5, max: 120, decimales: 0 },
];

export const BITACORA_INICIAL: RegistroBitacora[] = [
  { id: 1, fecha: isoHace(2), usuario: 'Paola Zamora', accion: 'CAMBIO_ROL', entidad: 'usuario', entidadId: '2', detalle: 'Rol de Luis Fernando Ramírez cambiado a OPERATIVO.', ip: '192.168.1.24' },
  { id: 2, fecha: isoHace(6), usuario: 'Paola Zamora', accion: 'ACTUALIZA_PARAMETRO', entidad: 'configuracion', entidadId: 'merma_meta_pct', detalle: 'Meta de merma actualizada a 5 %.', ip: '192.168.1.24' },
  { id: 3, fecha: isoHace(20), usuario: 'Paola Zamora', accion: 'ACTUALIZA_PRECIO', entidad: 'producto', entidadId: '1', detalle: 'Precio de HOODIE ROJA actualizado a $1,250.00 MXN.', ip: '192.168.1.24' },
  { id: 4, fecha: isoHace(28), usuario: 'Paola Zamora', accion: 'ACTUALIZA_RECETA', entidad: 'receta', entidadId: 'R-004', detalle: 'Receta vigente de SD-CH actualizada.', ip: '10.0.0.14' },
  { id: 5, fecha: isoHace(36), usuario: 'Luis Fernando Ramírez', accion: 'AJUSTE_INVENTARIO', entidad: 'movimiento_producto', entidadId: '45', detalle: 'Conteo físico de SD-MD-NG con diferencia +2 unidades.', ip: '192.168.1.31' },
  { id: 6, fecha: isoHace(52), usuario: 'Paola Zamora', accion: 'CANCELA_VENTA', entidad: 'venta', entidadId: 'VTA-1031', detalle: 'Venta cancelada por solicitud del cliente.', ip: '192.168.1.24' },
  { id: 7, fecha: isoHace(74), usuario: 'Paola Zamora', accion: 'ALTA_USUARIO', entidad: 'usuario', entidadId: '3', detalle: 'Alta de cuenta Operativa de prueba.', ip: '10.0.0.14' },
];

/** Devoluciones de ejemplo: M07 aún no existe en el frontend. */
export const DEVOLUCIONES_DEMO: Record<number, number> = {
  1: 1,
  2: 0,
  3: 2,
  4: 0,
};
