import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChipSemaforo } from '../../componentes/chip-semaforo/chip-semaforo';
import { TarjetaMetrica } from '../../componentes/tarjeta-metrica/tarjeta-metrica';
import { numero, porcentaje } from '../../modelos/dashboard';
import { DashboardServicio } from '../../servicios/dashboard-servicio';

@Component({
  selector: 'app-logistica-devoluciones',
  imports: [RouterLink, ChipSemaforo, TarjetaMetrica],
  templateUrl: './logistica-devoluciones.html',
  styleUrls: ['../../estilos-compartidos.css', './logistica-devoluciones.css'],
})
export class LogisticaDevoluciones {
  protected readonly servicio = inject(DashboardServicio);
  protected readonly numero = numero;
  protected readonly porcentaje = porcentaje;
}
