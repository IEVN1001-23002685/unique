import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.html',
})
export class Registro {
  @Output() cerrar = new EventEmitter<void>();
  @Output() irAIniciarSesion = new EventEmitter<void>();

  usuario = {
    nombreCompleto: '',
    telefono: '',
    correo: '',
    contrasena: '',
    repetirContrasena: ''
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
  }

  onIrAIniciarSesion(): void {
    this.irAIniciarSesion.emit();
  }
}
