import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthSessionService } from '../../../core/auth/auth-session.service';

/** §10.2 · Pantalla pública de 403. Los permisos definitivos se validarán en Flask. */
@Component({
  selector: 'app-sin-acceso',
  imports: [RouterLink],
  styleUrl: './sin-acceso.css',
  templateUrl: './sin-acceso.html',
})
export class SinAcceso {
  private readonly sesion = inject(AuthSessionService);
  private readonly router = inject(Router);

  get tieneSesion(): boolean {
    return this.sesion.autenticado;
  }

  cerrarSesion(): void {
    this.sesion.cerrarSesionLocal();
    void this.router.navigate(['/login']);
  }
}
