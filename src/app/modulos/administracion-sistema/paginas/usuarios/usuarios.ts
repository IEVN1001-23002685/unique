import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { ChipUsuario } from '../../componentes/chip-usuario/chip-usuario';
import {
  ETIQUETAS_ESTADO_USUARIO,
  ETIQUETAS_ROL,
  fechaLegible,
  type UsuarioSistema,
} from '../../modelos/administracion';
import {
  AdministracionSistemaServicio,
  type DatosUsuario,
} from '../../servicios/administracion-sistema-servicio';

type AccionPendiente = 'DESACTIVAR' | 'ACTIVAR' | 'RESTABLECER';

const CONTRASENA_FUERTE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

/** Usuarios y roles: alta, edición, activación y restablecimiento demostrativo. */
@Component({
  selector: 'app-usuarios-sistema',
  imports: [ReactiveFormsModule, RouterLink, ModalConfirmacion, ChipUsuario],
  templateUrl: './usuarios.html',
  styleUrls: ['../../estilos-compartidos.css', './usuarios.css'],
})
export class Usuarios {
  protected readonly servicio = inject(AdministracionSistemaServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly fb = inject(FormBuilder);

  protected readonly roles = ETIQUETAS_ROL;
  protected readonly estados = ETIQUETAS_ESTADO_USUARIO;
  protected readonly formulario = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    apellidos: ['', [Validators.required, Validators.minLength(2)]],
    correo: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    rol: this.fb.control<'ADMIN' | 'OPERATIVO'>('OPERATIVO', Validators.required),
    contrasena: ['', [Validators.required, Validators.pattern(CONTRASENA_FUERTE)]],
  });

  protected readonly editando = signal<number | null>(null);
  protected readonly mostrandoFormulario = signal(false);
  protected readonly errorFormulario = signal<string | null>(null);
  protected readonly temporal = signal<string | null>(null);
  protected readonly pendiente = signal<{
    usuario: UsuarioSistema;
    accion: AccionPendiente;
  } | null>(null);

  protected readonly activos = computed(
    () => this.servicio.usuarios().filter((usuario) => usuario.estado === 'ACTIVA').length,
  );

  protected nuevo(): void {
    this.editando.set(null);
    this.errorFormulario.set(null);
    this.temporal.set(null);
    this.formulario.reset({ rol: 'OPERATIVO', contrasena: '' });
    this.formulario.controls.contrasena.setValidators([
      Validators.required,
      Validators.pattern(CONTRASENA_FUERTE),
    ]);
    this.formulario.controls.contrasena.updateValueAndValidity();
    this.mostrandoFormulario.set(true);
  }

  protected editar(usuario: UsuarioSistema): void {
    this.editando.set(usuario.id);
    this.errorFormulario.set(null);
    this.temporal.set(null);
    this.formulario.patchValue({
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      correo: usuario.correo,
      telefono: usuario.telefono,
      rol: usuario.rol,
      contrasena: '',
    });
    this.formulario.controls.contrasena.setValidators([Validators.pattern(CONTRASENA_FUERTE)]);
    this.formulario.controls.contrasena.updateValueAndValidity();
    this.mostrandoFormulario.set(true);
  }

  protected cerrarFormulario(): void {
    this.mostrandoFormulario.set(false);
    this.editando.set(null);
  }

  protected guardar(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) {
      this.errorFormulario.set(
        'Revisa los campos marcados. La contraseña debe tener 8 caracteres, mayúscula, minúscula, número y símbolo.',
      );
      return;
    }
    const valor = this.formulario.getRawValue();
    const datos: DatosUsuario = {
      nombre: valor.nombre ?? '',
      apellidos: valor.apellidos ?? '',
      correo: valor.correo ?? '',
      telefono: valor.telefono ?? '',
      rol: valor.rol ?? 'OPERATIVO',
      contrasena: valor.contrasena ?? '',
    };
    const resultado = this.servicio.guardarUsuario(datos, this.editando() ?? undefined);
    this.errorFormulario.set(resultado.ok ? null : resultado.mensaje);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    if (resultado.ok) {
      this.cerrarFormulario();
    }
  }

  protected pedirAccion(usuario: UsuarioSistema, accion: AccionPendiente): void {
    this.temporal.set(null);
    this.pendiente.set({ usuario, accion });
  }

  protected confirmarAccion(): void {
    const pendiente = this.pendiente();
    this.pendiente.set(null);
    if (!pendiente) {
      return;
    }
    if (pendiente.accion === 'RESTABLECER') {
      const resultado = this.servicio.restablecerContrasena(pendiente.usuario.id);
      this.temporal.set(resultado.temporal ?? null);
      this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
      return;
    }
    const resultado = this.servicio.cambiarEstadoUsuario(
      pendiente.usuario.id,
      pendiente.accion === 'ACTIVAR',
    );
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
  }

  protected cancelarAccion(): void {
    this.pendiente.set(null);
  }

  protected fecha(iso: string | null): string {
    return iso === null ? 'Sin acceso' : fechaLegible(iso);
  }

  protected errorEn(
    control: 'nombre' | 'apellidos' | 'correo' | 'telefono' | 'contrasena',
  ): boolean {
    const campo = this.formulario.controls[control];
    return campo.invalid && (campo.touched || campo.dirty);
  }

  protected mensajeModal(): string {
    const pendiente = this.pendiente();
    if (!pendiente) {
      return '';
    }
    const nombre = `${pendiente.usuario.nombre} ${pendiente.usuario.apellidos}`;
    if (pendiente.accion === 'RESTABLECER') {
      return `Generar una contraseña temporal de demostración para ${nombre}. No se guardará ni se enviará.`;
    }
    return pendiente.accion === 'ACTIVAR'
      ? `Reactivar la cuenta de ${nombre}.`
      : `Desactivar la cuenta de ${nombre}. El historial se conserva y no se puede desactivar al último Administrador activo.`;
  }
}
