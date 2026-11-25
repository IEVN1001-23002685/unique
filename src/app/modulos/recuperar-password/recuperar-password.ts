import { Component, EventEmitter, inject, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recuperar-password.html',
  styles: [],
})
export class RecuperarPassword {
  private readonly router = inject(Router);

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
    this.enlaceSimulado = `${window.location.origin}/restablecer/${tokenSimulado} (vigencia: 30 min)`;
    this.enviado = true;
  }

  onVolverALogin(): void {
    this.volverALogin.emit();
    void this.router.navigate(['/login']);
  }

  onCerrar(): void {
    this.cerrar.emit();
    void this.router.navigate(['/catalogo']);
  }
}
/**
 * Compatibilidad temporal: M01 vive en `modulos/acceso-registro`.
 * Este archivo solo conserva la importación antigua por si algún código externo la usa.
 */
export { RecuperarPassword } from '../acceso-registro/paginas/recuperar-password/recuperar-password';
