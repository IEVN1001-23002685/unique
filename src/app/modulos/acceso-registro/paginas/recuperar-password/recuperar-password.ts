import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensajeError } from '../../../../core/api/errores';
import {
  TOKEN_RECUPERACION_DEMO,
  VIGENCIA_RECUPERACION_MIN,
} from '../../modelos/acceso-registro';
import { AccesoRegistroServicio } from '../../servicios/acceso-registro-servicio';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
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

  protected enviado = false;
  protected cargando = false;
  protected mensajeInvalido = this.servicio.formularioInvalido;
  protected error = '';

  /** Respuesta invariable: nunca revela si el correo existe (§7 de M01). */
  protected readonly mensajeFijo = this.servicio.recuperacionPendiente;
  protected readonly vigenciaMinutos = VIGENCIA_RECUPERACION_MIN;
  protected readonly enlaceDemostracion: string[] = [
    '/restablecer',
    TOKEN_RECUPERACION_DEMO,
  ];

  errorEnCorreo(): boolean {
    const control = this.formulario.controls.correo;
    return control.invalid && (control.touched || control.dirty);
  }

  onSubmit(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando = true;
    this.error = '';
    this.enviado = false;
    this.servicio.recuperar(this.formulario.controls.correo.value).subscribe({
      next: () => {
        // Se ignora el texto del backend: debe ser siempre el mismo para cualquier correo.
        this.cargando = false;
        this.enviado = true;
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.error = mensajeError(error, 'No fue posible procesar la solicitud.');
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
