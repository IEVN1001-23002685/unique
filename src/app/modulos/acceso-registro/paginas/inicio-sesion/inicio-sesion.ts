import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalAutenticacionServicio } from '../../../../nucleo/servicios/modal-autenticacion-servicio';
import { mensajeError } from '../../../../core/api/errores';
import { CarritoServicio } from '../../../carrito/servicios/carrito-servicio';
import { CredencialesLogin, rutaDestinoSegura } from '../../modelos/acceso-registro';
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
  private readonly ruta = inject(ActivatedRoute);
  private readonly modal = inject(ModalAutenticacionServicio);
  private readonly servicio = inject(AccesoRegistroServicio);
  private readonly carrito = inject(CarritoServicio);

  private readonly returnUrl = this.ruta.snapshot.queryParamMap.get('returnUrl');

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
  protected cargando = false;

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
    this.cargando = true;
    const credenciales: CredencialesLogin = this.formulario.getRawValue();
    this.servicio.iniciarSesion(credenciales).subscribe({
      next: (respuesta) => {
        this.cargando = false;
        this.enviarLogin.emit(credenciales);
        this.modal.cerrar();
        // M04 revalida el carrito con la sesión ya activa; la fusión la decide Flask.
        this.carrito.cargar().subscribe({ error: () => undefined });
        void this.router.navigateByUrl(rutaDestinoSegura(respuesta.usuario.rol, this.returnUrl));
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.mensaje = mensajeError(error, 'No fue posible iniciar sesión.');
      },
    });
  }

  onOlvidarContrasena(): void {
    this.modal.cerrar();
    void this.router.navigate(['/recuperar']);
  }

  onCerrar(): void {
    // Se captura antes de emitir: el contenedor del modal cierra de forma sincrónica.
    const estabaEnModal = this.modal.modalActiva() !== null;
    this.cerrar.emit();
    if (!estabaEnModal) {
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
