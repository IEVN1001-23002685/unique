/**
 * Modelos de interfaz de M22 · Administración del sistema (§6 y §7 del
 * documento UNIQUE v3.0). Tipan la proyección en pantalla; la persistencia,
 * los hashes de contraseña y la auditoría autoritativa son de Flask.
 */

export type RolUsuarioSistema = 'ADMIN' | 'OPERATIVO';
export type EstadoCuentaUsuario = 'ACTIVA' | 'SIN_ACCESO' | 'BLOQUEADA' | 'INACTIVA';
export type TipoCatalogo =
  | 'COLOR'
  | 'TALLA'
  | 'CATEGORIA_PRODUCTO'
  | 'CATEGORIA_MATERIAL'
  | 'CAUSA_MERMA'
  | 'TARIFA_ENVIO';
export type AplicaCausaMerma = 'MATERIAL' | 'PRODUCTO' | 'AMBOS';

export interface UsuarioSistema {
  id: number;
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  rol: RolUsuarioSistema;
  estado: EstadoCuentaUsuario;
  intentosFallidos: number;
  ultimoAcceso: string | null;
  creadoEn: string;
}

export interface CompraCliente {
  folio: string;
  fecha: string;
  total: number;
  estadoPago: string;
}

export interface ClienteSistema {
  id: number;
  nombre: string;
  correo: string;
  telefono: string;
  acceso: 'REGISTRADO' | 'SIN_ACCESO';
  compras: number;
  totalCompras: number;
  pagosPendientes: number;
  devolucionesDemo: number;
  saldoSimulado: number;
  historial: CompraCliente[];
}

export interface EntradaCatalogo {
  id: number;
  tipo: TipoCatalogo;
  codigo: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  hex?: string;
  orden?: number;
  prefijo?: string;
  usaTallas?: boolean;
  aplicaA?: AplicaCausaMerma;
  etapaSugerida?: string;
  cpInicio?: string;
  cpFin?: string;
  costo?: number;
  diasEstimados?: number;
}

export interface DatosCatalogo {
  tipo: TipoCatalogo;
  codigo: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  hex: string;
  orden: number | null;
  prefijo: string;
  usaTallas: boolean;
  aplicaA: AplicaCausaMerma | '';
  etapaSugerida: string;
  cpInicio: string;
  cpFin: string;
  costo: number | null;
  diasEstimados: number | null;
}

export interface RegistroBitacora {
  id: number;
  fecha: string;
  usuario: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  detalle: string;
  ip: string;
}

export interface FiltrosBitacora {
  usuario: string;
  entidad: string;
  desde: string;
  hasta: string;
  texto: string;
}

export interface ParametroSistema {
  clave: string;
  etiqueta: string;
  valor: number;
  unidad: string;
  descripcion: string;
  propuesta: boolean;
  min: number;
  max: number;
  decimales: number;
}

export interface ResultadoAdmin {
  ok: boolean;
  mensaje: string;
}

export const ETIQUETAS_ROL: Record<RolUsuarioSistema, string> = {
  ADMIN: 'Administrador',
  OPERATIVO: 'Operativo',
};

export const ETIQUETAS_ESTADO_USUARIO: Record<EstadoCuentaUsuario, string> = {
  ACTIVA: 'Activa',
  SIN_ACCESO: 'Sin acceso',
  BLOQUEADA: 'Bloqueada',
  INACTIVA: 'Inactiva',
};

export const ETIQUETAS_TIPO_CATALOGO: Record<TipoCatalogo, string> = {
  COLOR: 'Colores',
  TALLA: 'Tallas',
  CATEGORIA_PRODUCTO: 'Categorías de producto',
  CATEGORIA_MATERIAL: 'Categorías de material',
  CAUSA_MERMA: 'Causas de merma',
  TARIFA_ENVIO: 'Tarifas de envío por CP',
};

export const TIPOS_CATALOGO: TipoCatalogo[] = [
  'COLOR',
  'TALLA',
  'CATEGORIA_PRODUCTO',
  'CATEGORIA_MATERIAL',
  'CAUSA_MERMA',
  'TARIFA_ENVIO',
];

export const ETIQUETAS_APLICA: Record<AplicaCausaMerma, string> = {
  MATERIAL: 'Material',
  PRODUCTO: 'Producto',
  AMBOS: 'Ambos',
};

const formatoFecha = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function fechaLegible(iso: string): string {
  return formatoFecha.format(new Date(iso));
}

export function mxn(valor: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(valor);
}
