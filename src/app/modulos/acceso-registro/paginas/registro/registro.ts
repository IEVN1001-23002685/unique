import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalAutenticacionServicio } from '../../../../nucleo/servicios/modal-autenticacion-servicio';
import { mensajeError } from '../../../../core/api/errores';
import {
  AccesoRegistroServicio,
} from '../../servicios/acceso-registro-servicio';
import {
  coincide,
  passwordFuerte,
  telefono10,
} from '../../validadores/acceso-registro.validadores';

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
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly modal = inject(ModalAutenticacionServicio);
  private readonly servicio = inject(AccesoRegistroServicio);

  @Output() cerrar = new EventEmitter<void>();
  @Output() irAIniciarSesion = new EventEmitter<void>();

  protected readonly mensajeInvalido = this.servicio.formularioInvalido;
  protected readonly mensajePendiente = this.servicio.registroPendiente;

  /** El registro público solo crea Clientes (§3 y §7); la dirección se captura en M02 o M05. */
  readonly formulario = this.fb.group(
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

  protected mensaje = '';
  protected cargando = false;

  protected errorEn(campo: CampoRegistro): boolean {
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
    const valores = this.formulario.getRawValue();
    this.servicio
      .registrar({
        nombre: valores.nombre ?? '',
        apellidos: valores.apellidos ?? '',
        telefono: valores.telefono ?? '',
        correo: valores.correo ?? '',
        contrasena: valores.contrasena ?? '',
        repetirContrasena: valores.repetirContrasena ?? '',
        aceptaPrivacidad: !!valores.aceptaPrivacidad,
        recibirPromociones: !!valores.recibirPromociones,
      })
      .subscribe({
      next: () => {
        this.cargando = false;
        this.modal.cerrar();
        void this.router.navigate(['/catalogo']);
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.mensaje = mensajeError(error, 'No fue posible crear la cuenta.');
      },
    });
  }

  onCerrar(): void {
    this.cerrar.emit();
    if (this.modal.modalActiva() === null) {
      void this.router.navigate(['/catalogo']);
    }
  }

  onIrAIniciarSesion(): void {
    this.irAIniciarSesion.emit();
    if (this.modal.modalActiva() === null) {
      void this.router.navigate(['/login']);
    }
  }
}
