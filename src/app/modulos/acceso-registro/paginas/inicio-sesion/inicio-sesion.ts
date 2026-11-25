import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalAutenticacionServicio } from '../../../../nucleo/servicios/modal-autenticacion-servicio';
import { CredencialesLogin } from '../../modelos/acceso-registro';
import { AccesoRegistroServicio } from '../../servicios/acceso-registro-servicio';

@Component({
  selector: 'app-inicio-sesion',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './inicio-sesion.html',
  styleUrl: './inicio-sesion.css',
})
export class InicioSesion {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly modal = inject(ModalAutenticacionServicio);
  private readonly servicio = inject(AccesoRegistroServicio);

  @Output() cerrar = new EventEmitter<void>();
  @Output() irARegistro = new EventEmitter<void>();
  @Output() enviarLogin = new EventEmitter<CredencialesLogin>();

  protected readonly mensajeInvalido = this.servicio.formularioInvalido;
  protected readonly mensajePendiente = this.servicio.ingresoPendiente;

  readonly formulario = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', [Validators.required]],
  });

  protected mensaje = '';

  protected errorEn(campo: 'correo' | 'contrasena'): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  onSubmit(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.mensaje = this.mensajeInvalido;
      return;
    }

    this.mensaje = this.mensajePendiente;
    this.enviarLogin.emit({ ...this.formulario.getRawValue() });
  }

  onOlvidarContrasena(): void {
    this.modal.cerrar();
    void this.router.navigate(['/recuperar']);
  }

  onCerrar(): void {
    this.cerrar.emit();
    // Dentro del modal, el contenedor cierra la vista; como página, vuelve al catálogo.
    if (this.modal.modalActiva() === null) {
      void this.router.navigate(['/catalogo']);
    }
  }

  onIrARegistro(): void {
    this.irARegistro.emit();
    if (this.modal.modalActiva() === null) {
      void this.router.navigate(['/registro']);
    }
  }
}
