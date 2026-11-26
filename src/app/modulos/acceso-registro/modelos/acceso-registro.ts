/**
 * Modelos de interfaz de M01 · Acceso y registro.
 * La identidad, los tokens y el estado autoritativo los gestiona Flask.
 */

export type RolAcceso = 'CLIENTE' | 'OPERATIVO' | 'ADMIN';

export type EstadoCuentaAcceso = 'ACTIVA' | 'SIN_ACCESO' | 'BLOQUEADA' | 'INACTIVA';

export interface CredencialesLogin {
  correo: string;
  contrasena: string;
}

export interface DatosRegistroCliente {
  nombre: string;
  apellidos: string;
  telefono: string;
  correo: string;
  contrasena: string;
  repetirContrasena: string;
  aceptaPrivacidad: boolean;
  recibirPromociones: boolean;
}

export interface IdentidadAcceso {
  id: number;
  nombre: string;
  apellidos?: string;
  correo: string;
  telefono?: string;
  rol: RolAcceso;
  estado_cuenta?: EstadoCuentaAcceso;
}

/** Forma de la respuesta real de /auth/login, /auth/registro y /auth/refrescar. */
export interface SesionAcceso {
  access_token: string;
  usuario: IdentidadAcceso;
  expiraEnMinutos: number;
}

export const RUTAS_POR_ROL: Record<RolAcceso, string> = {
  CLIENTE: '/catalogo',
  OPERATIVO: '/panel',
  ADMIN: '/panel',
};

export function rutaDestinoPorRol(rol: RolAcceso): string {
  return RUTAS_POR_ROL[rol];
}

/** Acepta solo rutas internas para no permitir redirecciones externas desde queryParams. */
export function rutaDestinoSegura(rol: RolAcceso, returnUrl?: string | null): string {
  if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
    return returnUrl;
  }
  return rutaDestinoPorRol(rol);
}

/** Token local usado solo para mostrar el enlace simulado de recuperación (§7 M01). */
export const TOKEN_RECUPERACION_DEMO = 'demo';

export const VIGENCIA_RECUPERACION_MIN = 30;

export const MENSAJES_M01 = {
  registroPendiente: 'Creando tu cuenta…',
  ingresoPendiente: 'Validando tus credenciales…',
  recuperacionPendiente:
    'Si el correo ingresado está registrado, se generó una instrucción de recuperación.',
  restablecimientoPendiente: 'Actualizando tu contraseña…',
  formularioInvalido: 'Revisa los campos marcados antes de continuar.',
} as const;
