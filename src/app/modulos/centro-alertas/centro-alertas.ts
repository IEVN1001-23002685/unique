import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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

  protected readonly pestanas: OpcionPestana[] = [
    { ruta: '/alertas/bandeja', etiqueta: 'Bandeja' },
    { ruta: '/alertas/resueltas', etiqueta: 'Bitácora de resueltas' },
    { ruta: '/alertas/reglas', etiqueta: 'Reglas', soloAdmin: true },
  ];

  protected sincronizar(): void {
    this.servicio.sincronizar();
  }
}
