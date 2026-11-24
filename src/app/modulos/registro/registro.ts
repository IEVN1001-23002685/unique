import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalAutenticacionServicio } from '../../nucleo/servicios/modal-autenticacion-servicio';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  private readonly router = inject(Router);
  private readonly modal = inject(ModalAutenticacionServicio);

  @Output() cerrar = new EventEmitter<void>();
  @Output() irAIniciarSesion = new EventEmitter<void>();

  usuario = {
    nombreCompleto: '',
    telefono: '',
    correo: '',
    contrasena: '',
    repetirContrasena: '',
  };

  onSubmit(): void {
    if (this.usuario.contrasena !== this.usuario.repetirContrasena) {
      alert('Las contraseñas no coinciden.');
      return;
    }

    console.log('Datos de registro:', this.usuario);
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
