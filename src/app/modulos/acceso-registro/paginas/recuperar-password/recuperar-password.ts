import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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

  enviado = false;
  enlaceSimulado = '';
  mensajeInvalido = this.servicio.formularioInvalido;

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

    // No se envía correo real: solo se muestra un enlace local de demostración.
    const tokenSimulado = Math.random().toString(36).substring(2, 10);
    this.enlaceSimulado = this.router.serializeUrl(
      this.router.createUrlTree(['/restablecer', tokenSimulado]),
    );
    this.enviado = true;
  }

  onVolverALogin(): void {
    void this.router.navigate(['/login']);
  }

  onCerrar(): void {
    void this.router.navigate(['/catalogo']);
  }
}
