import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthSessionService } from '../services/auth-session.service';
@Component({
  selector: 'app-panel-admin',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './panel-admin.component.html',
  styleUrl: './panel-admin.component.css',
})
export class PanelAdminComponent {
  auth = inject(AuthSessionService);
  get rol() {
    return this.auth.usuario?.rol ?? 'OPERATIVO';
  }
  salir() {
    this.auth.cerrarSesion();
    location.href = '/login-admin';
  }
}
