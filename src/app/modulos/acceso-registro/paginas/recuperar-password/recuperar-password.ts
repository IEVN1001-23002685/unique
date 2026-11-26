import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ModalAutenticacionServicio } from '../../../../nucleo/servicios/modal-autenticacion-servicio';
import {
  TOKEN_RECUPERACION_DEMO,
  VIGENCIA_RECUPERACION_MIN,
} from '../../modelos/acceso-registro';
import { AccesoRegistroServicio } from '../../servicios/acceso-registro-servicio';

@Component({
  selector: 'app-recuperar-password',
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './recuperar-password.css',
  templateUrl: './recuperar-password.html',
})
export class RecuperarPassword {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly modal = inject(ModalAutenticacionServicio);
  private readonly servicio = inject(AccesoRegistroServicio);

  readonly cerrar = output<void>();

  readonly mensajeFijo = this.servicio.recuperacionPendiente;
  readonly mensajeInvalido = this.servicio.formularioInvalido;
  readonly vigenciaMinutos = VIGENCIA_RECUPERACION_MIN;
  readonly enlaceDemo: string[] = ['/restablecer', TOKEN_RECUPERACION_DEMO];

  readonly formulario = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
  });

  readonly cargando = signal(false);
  readonly enviado = signal(false);
  readonly error = signal('');

  enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.error.set(this.mensajeInvalido);
      return;
    }

    this.cargando.set(true);
    this.enviado.set(false);
    this.error.set('');

    this.servicio.recuperar(this.formulario.controls.correo.value).subscribe({
      next: () => {
        // Se ignora el texto de la respuesta: debe ser igual para cualquier correo.
        this.cargando.set(false);
        this.enviado.set(true);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.error.set(this.textoError(error, 'No fue posible procesar la solicitud.'));
      },
    });
  }

  volverAlLogin(): void {
    this.modal.cerrar();
    void this.router.navigate(['/login']);
  }

  cerrarVista(): void {
    this.cerrar.emit();
    if (this.modal.modalActiva() === null) {
      void this.router.navigate(['/catalogo']);
    }
  }

  errorEnCorreo(): boolean {
    const control = this.formulario.controls.correo;
    return control.invalid && (control.touched || control.dirty);
  }

  mensajeCorreo(): string {
    const control = this.formulario.controls.correo;
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('email')) return 'Escribe un correo electrónico válido.';
    return '';
  }

  private textoError(error: unknown, alternativa: string): string {
    return error instanceof Error && error.message.trim() !== '' ? error.message : alternativa;
  }
}
