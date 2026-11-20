import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface CredencialesLogin {
  correo: string;
  contrasena: string;
}

@Component({
  selector: 'app-inicio-sesion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inicio-sesion.html',
})
export class InicioSesion {
  @Output() cerrar = new EventEmitter<void>();
  @Output() irARegistro = new EventEmitter<void>();
  @Output() enviarLogin = new EventEmitter<CredencialesLogin>();

  credenciales: CredencialesLogin = {
    correo: '',
    contrasena: ''
  };

  onSubmit(): void {
    this.enviarLogin.emit({ ...this.credenciales });
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  onIrARegistro(): void {
    this.irARegistro.emit();
  }
}
