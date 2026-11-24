import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import type { RolVistaAlertas } from './modelos/alerta-centro';
import { AlertasServicio } from './servicios/alertas-servicio';

interface OpcionPestana {
  ruta: string;
  etiqueta: string;
  soloAdmin?: boolean;
}

/** Cascarón común de M21: contadores, vista de rol y navegación entre pantallas. */
@Component({
  selector: 'app-centro-alertas',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './centro-alertas.html',
  styleUrls: ['./estilos-compartidos.css', './centro-alertas.css'],
})
export class CentroAlertas {
  protected readonly servicio = inject(AlertasServicio);
  private readonly router = inject(Router);

  protected readonly pestanas: OpcionPestana[] = [
    { ruta: '/alertas/bandeja', etiqueta: 'Bandeja' },
    { ruta: '/alertas/resueltas', etiqueta: 'Bitácora de resueltas' },
    { ruta: '/alertas/reglas', etiqueta: 'Reglas', soloAdmin: true },
  ];

  protected alCambiarRol(evento: Event): void {
    const rol = (evento.target as HTMLSelectElement).value as RolVistaAlertas;
    this.servicio.cambioRol(rol);
    this.servicio.cambiarRol(rol);
    if (rol === 'Operativo' && this.router.url.includes('/reglas')) {
      void this.router.navigate(['/alertas', 'bandeja']);
    }
  }

  protected sincronizar(): void {
    this.servicio.sincronizar();
  }
}
