import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalAutenticacionServicio } from '../../nucleo/servicios/modal-autenticacion-servicio';

export interface CredencialesLogin {
  correo: string;
  contrasena: string;
}

@Component({
  selector: 'app-inicio-sesion',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './inicio-sesion.html',
  styleUrl: './inicio-sesion.css',
})
export class InicioSesion {
  private readonly router = inject(Router);
  private readonly modal = inject(ModalAutenticacionServicio);

  @Output() cerrar = new EventEmitter<void>();
  @Output() irARegistro = new EventEmitter<void>();
  @Output() enviarLogin = new EventEmitter<CredencialesLogin>();

  credenciales: CredencialesLogin = {
    correo: '',
    contrasena: '',
  };

  onSubmit(): void {
    this.enviarLogin.emit({ ...this.credenciales });
  }

  onCerrar(): void {
    this.cerrar.emit();
    // Dentro del modal, el contenedor cierra la vista; como página, vuelve al catálogo.
    if (this.modal.modalActiva() === null) {
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
