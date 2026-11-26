/** Modelos de interfaz de M02 · Mi cuenta. Flask sigue siendo la fuente autoritativa. */

export type TipoDireccion = 'envio' | 'facturacion';

export interface DireccionCliente {
  id: number;
  tipo: TipoDireccion;
  alias: string;
  destinatario: string;
  telefono: string;
  calle: string;
  numExt: string;
  numInt: string;
  colonia: string;
  municipio: string;
  estado: string;
  cp: string;
  referencia: string;
  predeterminada: boolean;
  rfc?: string;
  razonSocial?: string;
}

export interface MedioPagoSimulado {
  id: number;
  tipo: 'tarjeta' | 'cuenta';
  alias: string;
  titular: string;
  marca?: string;
  ultimos4?: string;
  vencimiento?: string;
  saldo?: number;
}

export interface PerfilCuenta {
  id: number;
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  acepta_promociones: boolean;
}

/** El correo solo se envía cuando cambia y debe ir acompañado de la contraseña actual. */
export interface DatosActualizacionPerfil {
  nombre: string;
  apellidos: string;
  telefono: string;
  correo?: string;
  contrasena_actual?: string;
}

export interface CoberturaEnvio {
  codigo_postal: string;
  cobertura: boolean;
  tarifa: Record<string, unknown> | null;
  costo: string | null;
  dias_estimados: number | null;
}
