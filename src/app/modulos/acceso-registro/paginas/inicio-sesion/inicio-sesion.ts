import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalAutenticacionServicio } from '../../../../nucleo/servicios/modal-autenticacion-servicio';
import { rutaDestinoSegura } from '../../modelos/acceso-registro';
import type { CredencialesLogin } from '../../modelos/acceso-registro';
import { AccesoRegistroServicio } from '../../servicios/acceso-registro-servicio';

@Component({
  selector: 'app-inicio-sesion',
  imports: [ReactiveFormsModule],
  styleUrl: './inicio-sesion.css',
  templateUrl: './inicio-sesion.html',
})
export class InicioSesion {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly modal = inject(ModalAutenticacionServicio);
  private readonly servicio = inject(AccesoRegistroServicio);

  private readonly returnUrl = this.ruta.snapshot.queryParamMap.get('returnUrl');

  readonly cerrar = output<void>();
  readonly irARegistro = output<void>();

  readonly formulario = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', [Validators.required]],
  });

  readonly cargando = signal(false);
  readonly mensaje = signal('');

  enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.mensaje.set(this.servicio.formularioInvalido);
      return;
    }

    const credenciales: CredencialesLogin = this.formulario.getRawValue();
    this.cargando.set(true);
    this.mensaje.set(this.servicio.ingresoPendiente);

    this.servicio.iniciarSesion(credenciales).subscribe({
      next: (respuesta) => {
        this.cargando.set(false);
        this.modal.cerrar();
        void this.router.navigateByUrl(rutaDestinoSegura(respuesta.usuario.rol, this.returnUrl));
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.mensaje.set(this.textoError(error, 'No fue posible iniciar sesión.'));
      },
    });
  }

  irAlRegistro(): void {
    this.irARegistro.emit();
    if (this.modal.modalActiva() === null) {
      void this.router.navigate(['/registro'], {
        queryParams: this.returnUrl === null ? {} : { returnUrl: this.returnUrl },
      });
    }
  }

  irARecuperar(): void {
    this.modal.cerrar();
    void this.router.navigate(['/recuperar']);
  }

  cerrarVista(): void {
    this.cerrar.emit();
    if (this.modal.modalActiva() === null) {
      void this.router.navigate(['/catalogo']);
    }
  }

  errorEn(campo: 'correo' | 'contrasena'): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  mensajeDe(campo: 'correo' | 'contrasena'): string {
    const control = this.formulario.controls[campo];
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('email')) return 'Escribe un correo electrónico válido.';
    return '';
  }

  private textoError(error: unknown, alternativa: string): string {
    return error instanceof Error && error.message.trim() !== '' ? error.message : alternativa;
  }
}
