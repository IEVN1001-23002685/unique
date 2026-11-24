import { Component, input } from '@angular/core';
import type { MetricaDashboard } from '../../modelos/dashboard';

/** Tarjeta de indicador reutilizable en las cinco pestañas de M20. */
@Component({
  selector: 'app-tarjeta-metrica',
  templateUrl: './tarjeta-metrica.html',
  styleUrl: './tarjeta-metrica.css',
})
export class TarjetaMetrica {
  readonly metrica = input.required<MetricaDashboard>();
}
