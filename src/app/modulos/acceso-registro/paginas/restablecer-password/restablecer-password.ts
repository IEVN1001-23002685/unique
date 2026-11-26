import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { coincide, passwordFuerte } from '../../validadores/acceso-registro.validadores';
import { AccesoRegistroServicio } from '../../servicios/acceso-registro-servicio';

@Component({
  selector: 'app-restablecer-password',
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './restablecer-password.css',
  templateUrl: './restablecer-password.html',
})
export class RestablecerPassword {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly servicio = inject(AccesoRegistroServicio);

  readonly token = this.ruta.snapshot.paramMap.get('token') ?? '';
  readonly tokenInvalido = this.token.length === 0;
  readonly mensajePendiente = this.servicio.restablecimientoPendiente;
  readonly mensajeInvalido = this.servicio.formularioInvalido;

  readonly formulario = this.fb.nonNullable.group(
    {
      contrasena: ['', [Validators.required, passwordFuerte]],
      repetirContrasena: ['', [Validators.required]],
    },
    { validators: coincide('contrasena', 'repetirContrasena') },
  );

  readonly cargando = signal(false);
  readonly mensaje = signal('');
  readonly restablecido = signal(false);

  enviar(): void {
    if (this.tokenInvalido) {
      this.mensaje.set('El enlace no es válido. Solicita una nueva instrucción de recuperación.');
      return;
    }

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.mensaje.set(this.mensajeInvalido);
      return;
    }

    this.cargando.set(true);
    this.mensaje.set(this.mensajePendiente);
    const contrasena = this.formulario.controls.contrasena.value;

    this.servicio.restablecer(this.token, contrasena).subscribe({
      next: (respuesta) => {
        this.cargando.set(false);
        this.restablecido.set(true);
        this.mensaje.set(respuesta.mensaje);
        this.formulario.reset({ contrasena: '', repetirContrasena: '' });
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.mensaje.set(this.textoError(error, 'No fue posible actualizar la contraseña.'));
      },
    });
  }

  volverAlLogin(): void {
    void this.router.navigate(['/login']);
  }

  cerrarVista(): void {
    void this.router.navigate(['/catalogo']);
  }

  errorEn(campo: 'contrasena' | 'repetirContrasena'): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  mensajeDe(campo: 'contrasena' | 'repetirContrasena'): string {
    const control = this.formulario.controls[campo];
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('passwordFuerte')) {
      return 'Mínimo 8 caracteres con mayúscula, minúscula, número y símbolo.';
    }
    return '';
  }

  get contrasenasNoCoinciden(): boolean {
    return (
      this.formulario.hasError('coincide') &&
      (this.formulario.controls.repetirContrasena.touched ||
        this.formulario.controls.repetirContrasena.dirty)
    );
  }

  private textoError(error: unknown, alternativa: string): string {
    return error instanceof Error && error.message.trim() !== '' ? error.message : alternativa;
  }
}
