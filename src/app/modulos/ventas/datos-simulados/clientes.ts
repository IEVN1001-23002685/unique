import type { ClienteVenta } from '../modelos/venta';

/** DATO DE DEMOSTRACIÓN (M08). Clientes existentes para la venta manual. */
export const CLIENTES_SIMULADOS: ClienteVenta[] = [
  {
    id: 1,
    nombre: 'María Fernanda López',
    correo: 'fernanda.lopez@example.com',
    telefono: '4771234567',
    esNuevoSinAcceso: false,
  },
  {
    id: 2,
    nombre: 'Jorge Alberto Ruiz',
    correo: 'jorge.ruiz@example.com',
    telefono: '4772345678',
    esNuevoSinAcceso: false,
  },
  {
    id: 3,
    nombre: 'Lucía Martínez Soto',
    correo: 'lucia.martinez@example.com',
    telefono: '4773456789',
    esNuevoSinAcceso: false,
  },
  {
    id: 4,
    nombre: 'Diego Hernández Cruz',
    correo: 'diego.hernandez@example.com',
    telefono: '4774567890',
    esNuevoSinAcceso: false,
  },
];
