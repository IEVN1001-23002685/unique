import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { mensajeError } from '../../../../core/api/errores';
import { AccesoRegistroServicio } from '../../../acceso-registro/servicios/acceso-registro-servicio';

interface FormaRestablecer {
  contrasena: FormControl<string>;
  confirmacion: FormControl<string>;
}

/** Contraseña fuerte de presentación: Flask hará la validación autoritativa. */
const contrasenaFuerte: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = typeof control.value === 'string' ? control.value : '';
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(valor)
    ? null
    : { passwordFuerte: true };
};

const coincide: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const grupo = control as FormGroup<FormaRestablecer>;
  return grupo.controls.contrasena.value === grupo.controls.confirmacion.value
    ? null
    : { coincide: true };
};

/** M01 · Pantalla de restablecimiento con token de demostración. */
@Component({
  selector: 'app-restablecer',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './restablecer.html',
  styleUrl: './restablecer.css',
})
export class Restablecer {
  private readonly ruta = inject(ActivatedRoute);
  private readonly servicio = inject(AccesoRegistroServicio);

  protected readonly token = this.ruta.snapshot.paramMap.get('token') ?? '';
  protected readonly enviado = signal(false);
  protected readonly intentoEnvio = signal(false);
  protected readonly procesando = signal(false);
  protected readonly mensaje = signal('');

  protected readonly forma = new FormGroup<FormaRestablecer>(
    {
      contrasena: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, contrasenaFuerte],
      }),
      confirmacion: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [coincide] },
  );

  protected esInvalido(campo: keyof FormaRestablecer): boolean {
    const control = this.forma.controls[campo];
    return (this.intentoEnvio() || control.touched) && control.invalid;
  }

  protected enviar(): void {
    this.intentoEnvio.set(true);
    if (this.forma.invalid) {
      this.forma.markAllAsTouched();
      return;
    }
    this.procesando.set(true);
    this.servicio.restablecer(this.token, this.forma.controls.contrasena.value).subscribe({
      next: (respuesta) => {
        this.procesando.set(false);
        this.mensaje.set(respuesta.mensaje);
        this.enviado.set(true);
      },
      error: (error: unknown) => {
        this.procesando.set(false);
        this.mensaje.set(mensajeError(error, 'No fue posible actualizar la contraseña.'));
      },
    });
  }
}
