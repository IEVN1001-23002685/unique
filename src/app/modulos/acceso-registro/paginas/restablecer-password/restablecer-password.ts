import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { mensajeError } from '../../../../core/api/errores';
import { AccesoRegistroServicio } from '../../servicios/acceso-registro-servicio';
import { coincide, passwordFuerte } from '../../validadores/acceso-registro.validadores';

@Component({
  selector: 'app-restablecer-password',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './restablecer-password.html',
  styleUrl: './restablecer-password.css',
})
export class RestablecerPassword {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly servicio = inject(AccesoRegistroServicio);

  readonly token = this.ruta.snapshot.paramMap.get('token') ?? '';
  readonly mensajePendiente = this.servicio.restablecimientoPendiente;
  readonly mensajeInvalido = this.servicio.formularioInvalido;

  readonly formulario = this.fb.group(
    {
      contrasena: ['', [Validators.required, passwordFuerte]],
      repetirContrasena: ['', [Validators.required]],
    },
    { validators: coincide('contrasena', 'repetirContrasena') },
  );

  protected mensaje = '';
  protected cargando = false;

  protected errorEn(campo: 'contrasena' | 'repetirContrasena'): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  protected get contrasenasNoCoinciden(): boolean {
    return (
      this.formulario.hasError('coincide') &&
      (this.formulario.controls.repetirContrasena.touched ||
        this.formulario.controls.repetirContrasena.dirty)
    );
  }

  onSubmit(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.mensaje = this.mensajeInvalido;
      return;
    }

    this.mensaje = this.mensajePendiente;
    this.cargando = true;
    this.servicio
      .restablecer(this.token, this.formulario.controls.contrasena.value ?? '')
      .subscribe({
        next: (respuesta) => {
          this.cargando = false;
          this.mensaje = respuesta.mensaje;
        },
        error: (error: unknown) => {
          this.cargando = false;
          this.mensaje = mensajeError(error, 'No fue posible actualizar la contraseña.');
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
