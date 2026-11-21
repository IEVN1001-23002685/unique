import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
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
