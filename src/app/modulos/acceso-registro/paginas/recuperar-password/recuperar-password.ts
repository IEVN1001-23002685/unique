import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { mensajeError } from '../../../../core/api/errores';
import { AccesoRegistroServicio } from '../../servicios/acceso-registro-servicio';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './recuperar-password.html',
  styleUrl: './recuperar-password.css',
})
export class RecuperarPassword {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly servicio = inject(AccesoRegistroServicio);

  readonly formulario = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
  });

  enviado = false;
  cargando = false;
  mensajeInvalido = this.servicio.formularioInvalido;
  mensaje = '';

  /** Respuesta invariable: nunca revela si el correo existe (§7 de M01). */
  readonly mensajeFijo = this.servicio.recuperacionPendiente;

  protected errorEnCorreo(): boolean {
    const control = this.formulario.controls.correo;
    return control.invalid && (control.touched || control.dirty);
  }

  onSubmit(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando = true;
    this.mensaje = '';
    this.servicio.recuperar(this.formulario.controls.correo.value).subscribe({
      next: (respuesta) => {
        this.cargando = false;
        this.mensaje = respuesta.mensaje;
        this.enviado = true;
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.mensaje = mensajeError(error, 'No fue posible procesar la solicitud.');
      },
    });
  }

  onVolverALogin(): void {
    void this.router.navigate(['/login']);
  }

  onCerrar(): void {
    void this.router.navigate(['/catalogo']);
  }
}
