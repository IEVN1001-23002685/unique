/**
 * Modelos de interfaz de M01 · Acceso y registro (§3, §6, §7 y §10 del documento
 * UNIQUE v3.0). Solo describen lo que puede mostrar el frontend; la identidad,
 * los tokens y el estado autoritativo de la cuenta los gestionará Flask.
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
  correo: string;
  rol: RolAcceso;
}

export interface SesionAcceso {
  token: string;
  identidad: IdentidadAcceso;
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

export const MENSAJES_M01 = {
  registroPendiente:
    'Datos listos para enviar a Flask. Esta demostración no crea una cuenta ni guarda información.',
  ingresoPendiente:
    'La validación de credenciales y la redirección por rol se conectará con Flask. No se creó una sesión real.',
  recuperacionPendiente:
    'Si el correo ingresado está registrado, se ha generado un enlace temporal para restablecer tu contraseña.',
  restablecimientoPendiente:
    'Contraseña lista para enviar a Flask. Esta demostración no la guarda ni cambia el acceso.',
  formularioInvalido: 'Revisa los campos marcados antes de continuar.',
} as const;
