import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalAutenticacionServicio } from '../../../../nucleo/servicios/modal-autenticacion-servicio';
import { rutaDestinoSegura } from '../../modelos/acceso-registro';
import { AccesoRegistroServicio } from '../../servicios/acceso-registro-servicio';
import { coincide, passwordFuerte, telefono10 } from '../../validadores/acceso-registro.validadores';

type CampoRegistro =
  | 'nombre'
  | 'apellidos'
  | 'telefono'
  | 'correo'
  | 'contrasena'
  | 'repetirContrasena'
  | 'aceptaPrivacidad';

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule],
  styleUrl: './registro.css',
  templateUrl: './registro.html',
})
export class Registro {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly modal = inject(ModalAutenticacionServicio);
  private readonly servicio = inject(AccesoRegistroServicio);

  private readonly returnUrl = this.ruta.snapshot.queryParamMap.get('returnUrl');

  readonly cerrar = output<void>();
  readonly irAIniciarSesion = output<void>();

  readonly mensajePendiente = this.servicio.registroPendiente;
  readonly mensajeInvalido = this.servicio.formularioInvalido;

  readonly formulario = this.fb.nonNullable.group(
    {
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      telefono: ['', [Validators.required, telefono10]],
      correo: ['', [Validators.required, Validators.email]],
      contrasena: ['', [Validators.required, passwordFuerte]],
      repetirContrasena: ['', [Validators.required]],
      aceptaPrivacidad: [false, [Validators.requiredTrue]],
      recibirPromociones: [false],
    },
    { validators: coincide('contrasena', 'repetirContrasena') },
  );

  readonly cargando = signal(false);
  readonly mensaje = signal('');

  enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.mensaje.set(this.mensajeInvalido);
      return;
    }

    const valores = this.formulario.getRawValue();
    this.cargando.set(true);
    this.mensaje.set(this.mensajePendiente);

    this.servicio
      .registrar({
        nombre: valores.nombre,
        apellidos: valores.apellidos,
        telefono: valores.telefono,
        correo: valores.correo,
        contrasena: valores.contrasena,
        repetirContrasena: valores.repetirContrasena,
        aceptaPrivacidad: valores.aceptaPrivacidad,
        recibirPromociones: valores.recibirPromociones,
      })
      .subscribe({
        next: () => {
          this.cargando.set(false);
          this.modal.cerrar();
          void this.router.navigateByUrl(rutaDestinoSegura('CLIENTE', this.returnUrl));
        },
        error: (error: unknown) => {
          this.cargando.set(false);
          this.mensaje.set(this.textoError(error, 'No fue posible crear la cuenta.'));
        },
      });
  }

  irAlInicio(): void {
    this.irAIniciarSesion.emit();
    if (this.modal.modalActiva() === null) {
      void this.router.navigate(['/login'], {
        queryParams: this.returnUrl === null ? {} : { returnUrl: this.returnUrl },
      });
    }
  }

  cerrarVista(): void {
    this.cerrar.emit();
    if (this.modal.modalActiva() === null) {
      void this.router.navigate(['/catalogo']);
    }
  }

  errorEn(campo: CampoRegistro): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  mensajeDe(campo: CampoRegistro): string {
    const control = this.formulario.controls[campo];
    if (control.hasError('required') || control.hasError('requiredTrue')) {
      return campo === 'aceptaPrivacidad' ? 'Debes aceptar el aviso de privacidad.' : 'Este campo es obligatorio.';
    }
    if (control.hasError('minlength')) return 'Escribe al menos 2 caracteres.';
    if (control.hasError('telefono10')) return 'El teléfono debe tener 10 dígitos.';
    if (control.hasError('email')) return 'Escribe un correo electrónico válido.';
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
