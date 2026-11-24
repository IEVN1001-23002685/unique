import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recuperar-password.html',
  styles: []
})
export class RecuperarPassword {
  @Output() volverALogin = new EventEmitter<void>();
  @Output() cerrar = new EventEmitter<void>();

  correo = '';
  enviado = false;
  enlaceSimulado = '';
  mostrarAyudaCorreo = false;

  mensajeFijo =
    'Si el correo ingresado está registrado, se ha generado un enlace temporal para restablecer tu contraseña.';

  onSubmit(): void {
    const tokenSimulado = Math.random().toString(36).substring(2, 10);
    this.enlaceSimulado = `http://localhost:4200/restablecer?token=${tokenSimulado} (vigencia: 30 min)`;
    this.enviado = true;
  }

  onVolverALogin(): void {
    this.volverALogin.emit();
  }

  onCerrar(): void {
    this.cerrar.emit();
  }
}