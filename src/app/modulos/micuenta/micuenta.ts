import { Component, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { mensajeError } from '../../core/api/errores';
import { CuentaServicio } from './servicios/cuenta-servicio';

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
  styles: [],
})
export class Micuenta implements OnInit {
  private readonly router = inject(Router);
  private readonly cuenta = inject(CuentaServicio);

  @Output() cerrar = new EventEmitter<void>();
  @Output() cuentaDesactivada = new EventEmitter<void>();
  @Output() cerrarTodasSesiones = new EventEmitter<void>();

  pestanaActiva: 'datos' | 'direcciones' | 'pagos' | 'seguridad' = 'datos';
  mensajeAviso = '';
  cargando = false;
  coberturaCp: boolean | null = null;

  datosPersonales = {
    nombre: '',
    apellidos: '',
    telefono: '',
    correo: '',
    correoOriginal: '',
    contrasenaConfirmacion: '',
  };

  direcciones: DireccionCliente[] = [];
  mostrandoFormDireccion = false;
  editandoDireccionId: number | null = null;
  formDireccion: DireccionCliente = this.nuevaDireccionVacia();

  mediosPago: MedioPagoSimulado[] = [];
  mostrandoFormPago = false;
  tipoNuevoPago: 'tarjeta' | 'cuenta' = 'tarjeta';
  formTarjeta = {
    alias: '',
    numero: '',
    titular: '',
    vencimiento: '',
    cvv: '',
  };
  formCuenta = {
    alias: '',
    titular: '',
    saldoInicial: 1000,
  };

  seguridad = {
    contrasenaActual: '',
    nuevaContrasena: '',
    confirmarContrasena: '',
  };

  ngOnInit(): void {
    this.cuenta.perfil().subscribe({
      next: (perfil) => {
        this.datosPersonales.nombre = perfil.nombre ?? '';
        this.datosPersonales.apellidos = perfil.apellidos ?? '';
        this.datosPersonales.telefono = perfil.telefono ?? '';
        this.datosPersonales.correo = perfil.correo ?? '';
        this.datosPersonales.correoOriginal = perfil.correo ?? '';
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
    this.cuenta.listarDirecciones().subscribe({
      next: (items) => (this.direcciones = items),
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
    this.cuenta.listarMediosPago().subscribe({
      next: (items) => (this.mediosPago = items),
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  cerrarCuenta(): void {
    this.cerrar.emit();
    void this.router.navigate(['/catalogo']);
  }

  cambiarPestana(tab: 'datos' | 'direcciones' | 'pagos' | 'seguridad'): void {
    this.pestanaActiva = tab;
    this.mensajeAviso = '';
  }

  guardarDatos(): void {
    this.cargando = true;
    this.cuenta
      .actualizarPerfil({
        nombre: this.datosPersonales.nombre,
        apellidos: this.datosPersonales.apellidos,
        telefono: this.datosPersonales.telefono,
      })
      .subscribe({
        next: () => {
          this.cargando = false;
          this.datosPersonales.contrasenaConfirmacion = '';
          this.mensajeAviso = 'Datos personales actualizados correctamente.';
        },
        error: (error: unknown) => {
          this.cargando = false;
          this.mensajeAviso = mensajeError(error);
        },
      });
  }

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
      razonSocial: '',
    };
  }

  abrirNuevaDireccion(): void {
    this.editandoDireccionId = null;
    this.formDireccion = this.nuevaDireccionVacia();
    this.coberturaCp = null;
    this.mostrandoFormDireccion = true;
  }

  editarDireccion(dir: DireccionCliente): void {
    this.editandoDireccionId = dir.id;
    this.formDireccion = { ...dir };
    this.validarCobertura();
    this.mostrandoFormDireccion = true;
  }

  validarCobertura(): void {
    if (!/^\d{5}$/.test(this.formDireccion.cp)) {
      this.coberturaCp = null;
      return;
    }
    this.cuenta.cobertura(this.formDireccion.cp).subscribe({
      next: (respuesta) => (this.coberturaCp = respuesta.cobertura),
      error: () => (this.coberturaCp = false),
    });
  }

  guardarDireccion(): void {
    const operacion =
      this.editandoDireccionId === null
        ? this.cuenta.crearDireccion(this.formDireccion)
        : this.cuenta.actualizarDireccion(this.editandoDireccionId, this.formDireccion);
    operacion.subscribe({
      next: (direccion) => {
        if (this.editandoDireccionId === null) {
          this.direcciones.push(direccion);
        } else {
          const indice = this.direcciones.findIndex((d) => d.id === direccion.id);
          if (indice !== -1) this.direcciones[indice] = direccion;
        }
        this.mostrandoFormDireccion = false;
        this.mensajeAviso = 'Dirección guardada.';
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  eliminarDireccion(id: number): void {
    this.cuenta.eliminarDireccion(id).subscribe({
      next: () => {
        this.direcciones = this.direcciones.filter((d) => d.id !== id);
        this.mensajeAviso = 'Dirección desactivada de tu lista.';
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  agregarMedioPago(): void {
    const cuerpo: Record<string, unknown> =
      this.tipoNuevoPago === 'tarjeta'
        ? {
            tipo: 'TARJETA',
            alias: this.formTarjeta.alias || 'Tarjeta',
            titular: this.formTarjeta.titular,
            numero_tarjeta: this.formTarjeta.numero.replace(/\s+/g, ''),
            vence_mes: this.mesVencimiento(this.formTarjeta.vencimiento),
            vence_anio: this.anioVencimiento(this.formTarjeta.vencimiento),
            cvv: this.formTarjeta.cvv,
          }
        : {
            tipo: 'CUENTA',
            alias: this.formCuenta.alias || 'Cuenta simulada',
            titular: this.formCuenta.titular,
            saldo_inicial: this.formCuenta.saldoInicial,
          };

    this.cuenta.crearMedioPago(cuerpo).subscribe({
      next: (medio) => {
        this.mediosPago.push(medio);
        this.formTarjeta = { alias: '', numero: '', titular: '', vencimiento: '', cvv: '' };
        this.formCuenta = { alias: '', titular: '', saldoInicial: 1000 };
        this.mostrandoFormPago = false;
        this.mensajeAviso = 'Medio de pago guardado.';
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  editarAliasPago(pago: MedioPagoSimulado): void {
    const nuevoAlias = prompt('Nuevo alias para este medio de pago:', pago.alias);
    if (!nuevoAlias?.trim()) return;
    this.cuenta.actualizarMedioPago(pago.id, nuevoAlias.trim()).subscribe({
      next: (actualizado) => (pago.alias = actualizado.alias),
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  eliminarMedioPago(id: number): void {
    this.cuenta.eliminarMedioPago(id).subscribe({
      next: () => {
        this.mediosPago = this.mediosPago.filter((p) => p.id !== id);
        this.mensajeAviso = 'Medio de pago eliminado.';
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  actualizarContrasena(): void {
    if (!this.seguridad.contrasenaActual) {
      this.mensajeAviso = 'Ingresa tu contraseña actual.';
      return;
    }
    if (this.seguridad.nuevaContrasena !== this.seguridad.confirmarContrasena) {
      this.mensajeAviso = 'La nueva contraseña y su confirmación no coinciden.';
      return;
    }
    this.cuenta
      .cambiarContrasena(this.seguridad.contrasenaActual, this.seguridad.nuevaContrasena)
      .subscribe({
        next: () => {
          this.seguridad = { contrasenaActual: '', nuevaContrasena: '', confirmarContrasena: '' };
          this.mensajeAviso = 'Contraseña actualizada correctamente.';
        },
        error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
      });
  }

  onCerrarSesiones(): void {
    this.cerrarTodasSesiones.emit();
    this.mensajeAviso =
      'Cambiar tu contraseña revoca las sesiones de refresco abiertas en otros dispositivos.';
  }

  onDesactivarCuenta(): void {
    this.cuentaDesactivada.emit();
    this.mensajeAviso = 'La desactivación de cuentas la realiza un Administrador.';
  }

  private mesVencimiento(valor: string): number | null {
    const [mes] = valor.split('/');
    const numero = Number(mes);
    return Number.isInteger(numero) && numero >= 1 && numero <= 12 ? numero : null;
  }

  private anioVencimiento(valor: string): number | null {
    const [, anio] = valor.split('/');
    const numero = Number(anio);
    if (!Number.isFinite(numero)) return null;
    return numero < 100 ? 2000 + numero : numero;
  }
}
