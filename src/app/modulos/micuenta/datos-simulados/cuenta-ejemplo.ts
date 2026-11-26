/**
 * Datos de demostración de M02. Solo se usan cuando el usuario pulsa «Cargar ejemplo»
 * ante la falta de API: nunca se envían ni se interpretan como datos persistidos.
 */
import type {
  DireccionCliente,
  MedioPagoSimulado,
  PerfilCuenta,
} from '../modelos/cuenta';

export const PERFIL_EJEMPLO: PerfilCuenta = {
  id: 1,
  nombre: 'María Fernanda',
  apellidos: 'López Ramírez',
  correo: 'maria.fernanda@correo.mx',
  telefono: '5512345678',
  acepta_promociones: true,
};

export const DIRECCIONES_EJEMPLO: readonly DireccionCliente[] = [
  {
    id: 101,
    tipo: 'envio',
    alias: 'Casa',
    destinatario: 'María Fernanda López',
    telefono: '5512345678',
    calle: 'Av. Insurgentes Sur',
    numExt: '1234',
    numInt: '5B',
    colonia: 'Del Valle Centro',
    municipio: 'Benito Juárez',
    estado: 'Ciudad de México',
    cp: '03100',
    referencia: 'Portón negro, timbre 5B',
    predeterminada: true,
  },
  {
    id: 102,
    tipo: 'facturacion',
    alias: 'Trabajo',
    destinatario: 'Estudio Creativo Aurora SA de CV',
    telefono: '5559876543',
    calle: 'Calle Álvaro Obregón',
    numExt: '87',
    numInt: '',
    colonia: 'Roma Norte',
    municipio: 'Cuauhtémoc',
    estado: 'Ciudad de México',
    cp: '06700',
    referencia: '',
    predeterminada: true,
    rfc: 'AUR120315AB1',
    razonSocial: 'Estudio Creativo Aurora SA de CV',
  },
];

export const MEDIOS_EJEMPLO: readonly MedioPagoSimulado[] = [
  {
    id: 201,
    tipo: 'tarjeta',
    alias: 'Tarjeta principal',
    titular: 'María F. López',
    marca: 'VISA',
    ultimos4: '4242',
    vencimiento: '09/28',
  },
  {
    id: 202,
    tipo: 'cuenta',
    alias: 'Saldo UNIQUE',
    titular: 'María Fernanda López',
    saldo: 1250,
  },
];

/** Coberturas de ejemplo para probar el indicador sin backend. */
export const CPS_CON_COBERTURA_EJEMPLO: ReadonlySet<string> = new Set([
  '03100',
  '06700',
  '06000',
  '11560',
]);
