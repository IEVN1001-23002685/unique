import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface DireccionCliente {
  id: number;
  tipo: 'envio' | 'facturacion';
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

@Component({
  selector: 'app-micuenta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './micuenta.html',
  styles: []
})
export class Micuenta {
  @Output() cerrar = new EventEmitter<void>();
  @Output() cuentaDesactivada = new EventEmitter<void>();
  @Output() cerrarTodasSesiones = new EventEmitter<void>();

  pestanaActiva: 'datos' | 'direcciones' | 'pagos' | 'seguridad' = 'datos';
  mensajeAviso = '';

  // 1. Mis datos
  datosPersonales = {
    nombre: '',
    apellidos: '',
    telefono: '',
    correo: '',
    correoOriginal: '',
    contrasenaConfirmacion: ''
  };

  // 2. Direcciones
  direcciones: DireccionCliente[] = [
    {
      id: 1,
      tipo: 'envio',
      alias: '',
      destinatario: '',
      telefono: '',
      calle: '',
      numExt: '',
      numInt: '',
      colonia: '',
      municipio: '',
      estado: '',
      cp: '',
      referencia: '',
      predeterminada: true
    }
  ];

  mostrandoFormDireccion = false;
  editandoDireccionId: number | null = null;
  formDireccion: DireccionCliente = this.nuevaDireccionVacia();

  // 3. Medios de pago simulados
  mediosPago: MedioPagoSimulado[] = [
  {
    id: 1,
    tipo: 'tarjeta',
    alias: 'Tarjeta de prueba',
    titular: 'Cliente Demo',
    marca: 'Visa',
    ultimos4: '1234',
    vencimiento: '12/28'
  },
  {
    id: 2,
    tipo: 'cuenta',
    alias: 'Cuenta de prueba',
    titular: 'Cliente Demo',
    saldo: 500
  }
];

  mostrandoFormPago = false;
  tipoNuevoPago: 'tarjeta' | 'cuenta' = 'tarjeta';
  formTarjeta = {
    alias: '',
    numero: '',
    titular: '',
    vencimiento: '',
    cvv: ''
  };
  formCuenta = {
    alias: '',
    titular: '',
    saldoInicial: 1000
  };

  // 4. Seguridad
  seguridad = {
    contrasenaActual: '',
    nuevaContrasena: '',
    confirmarContrasena: ''
  };

  cambiarPestana(tab: 'datos' | 'direcciones' | 'pagos' | 'seguridad'): void {
    this.pestanaActiva = tab;
    this.mensajeAviso = '';
  }

  // --- Lógica visual Mis datos ---
  guardarDatos(): void {
    if (
      this.datosPersonales.correo !== this.datosPersonales.correoOriginal &&
      !this.datosPersonales.contrasenaConfirmacion
    ) {
      this.mensajeAviso = 'Para cambiar tu correo debes escribir tu contraseña actual.';
      return;
    }
    this.datosPersonales.correoOriginal = this.datosPersonales.correo;
    this.datosPersonales.contrasenaConfirmacion = '';
    this.mensajeAviso = 'Datos personales actualizados correctamente.';
  }

  // --- Lógica visual Direcciones ---
  nuevaDireccionVacia(): DireccionCliente {
    return {
      id: 0,
      tipo: 'envio',
      alias: '',
      destinatario: '',
      telefono: '',
      calle: '',
      numExt: '',
      numInt: '',
      colonia: '',
      municipio: '',
      estado: '',
      cp: '',
      referencia: '',
      predeterminada: false,
      rfc: '',
      razonSocial: ''
    };
  }

  abrirNuevaDireccion(): void {
    this.editandoDireccionId = null;
    this.formDireccion = this.nuevaDireccionVacia();
    this.mostrandoFormDireccion = true;
  }

  editarDireccion(dir: DireccionCliente): void {
    this.editandoDireccionId = dir.id;
    this.formDireccion = { ...dir };
    this.mostrandoFormDireccion = true;
  }

  guardarDireccion(): void {
    if (this.formDireccion.predeterminada) {
      this.direcciones.forEach((d) => {
        if (d.tipo === this.formDireccion.tipo) {
          d.predeterminada = false;
        }
      });
    }

    if (this.editandoDireccionId !== null) {
      const idx = this.direcciones.findIndex((d) => d.id === this.editandoDireccionId);
      if (idx !== -1) {
        this.direcciones[idx] = { ...this.formDireccion };
      }
      this.mensajeAviso = 'Dirección actualizada.';
    } else {
      this.direcciones.push({
        ...this.formDireccion,
        id: Date.now()
      });
      this.mensajeAviso = 'Dirección agregada.';
    }
    this.mostrandoFormDireccion = false;
  }

  eliminarDireccion(id: number): void {
    this.direcciones = this.direcciones.filter((d) => d.id !== id);
    this.mensajeAviso = 'Dirección desactivada de tu lista.';
  }

  tieneCobertura(cp: string): boolean {
    return /^\d{5}$/.test(cp);
  }

  // --- Lógica visual Medios de pago ---
  agregarMedioPago(): void {
    if (this.tipoNuevoPago === 'tarjeta') {
      const limpio = this.formTarjeta.numero.replace(/\s+/g, '');
      const ultimos4 = limpio.slice(-4) || '0000';
      this.mediosPago.push({
        id: Date.now(),
        tipo: 'tarjeta',
        alias: this.formTarjeta.alias || 'Tarjeta',
        titular: this.formTarjeta.titular,
        marca: limpio.startsWith('5') ? 'Mastercard' : 'Visa',
        ultimos4,
        vencimiento: this.formTarjeta.vencimiento
      });
      // Se descartan número completo y CVV
      this.formTarjeta = { alias: '', numero: '', titular: '', vencimiento: '', cvv: '' };
    } else {
      this.mediosPago.push({
        id: Date.now(),
        tipo: 'cuenta',
        alias: this.formCuenta.alias || 'Cuenta simulada',
        titular: this.formCuenta.titular,
        saldo: this.formCuenta.saldoInicial
      });
      this.formCuenta = { alias: '', titular: '', saldoInicial: 1000 };
    }
    this.mostrandoFormPago = false;
    this.mensajeAviso = 'Medio de pago guardado.';
  }

  editarAliasPago(pago: MedioPagoSimulado): void {
    const nuevoAlias = prompt('Nuevo alias para este medio de pago:', pago.alias);
    if (nuevoAlias && nuevoAlias.trim()) {
      pago.alias = nuevoAlias.trim();
    }
  }

  eliminarMedioPago(id: number): void {
    this.mediosPago = this.mediosPago.filter((p) => p.id !== id);
    this.mensajeAviso = 'Medio de pago eliminado.';
  }

  // --- Lógica visual Seguridad ---
  actualizarContrasena(): void {
    if (!this.seguridad.contrasenaActual) {
      this.mensajeAviso = 'Ingresa tu contraseña actual.';
      return;
    }
    if (this.seguridad.nuevaContrasena !== this.seguridad.confirmarContrasena) {
      this.mensajeAviso = 'La nueva contraseña y su confirmación no coinciden.';
      return;
    }
    this.seguridad = { contrasenaActual: '', nuevaContrasena: '', confirmarContrasena: '' };
    this.mensajeAviso = 'Contraseña actualizada correctamente.';
  }

  onCerrarSesiones(): void {
    this.cerrarTodasSesiones.emit();
    this.mensajeAviso = 'Se cerraron las sesiones en todos los dispositivos.';
  }

  onDesactivarCuenta(): void {
    this.cuentaDesactivada.emit();
    this.mensajeAviso = 'Tu cuenta ha pasado a estado INACTIVA (se conserva tu historial).';
  }
}