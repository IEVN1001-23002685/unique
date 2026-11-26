import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChipSemaforo } from '../../componentes/chip-semaforo/chip-semaforo';
import { TarjetaMetrica } from '../../componentes/tarjeta-metrica/tarjeta-metrica';
import { numero, porcentaje } from '../../modelos/dashboard';
import { DashboardServicio } from '../../servicios/dashboard-servicio';

@Component({
  selector: 'app-abastecimiento',
  imports: [DatePipe, RouterLink, ChipSemaforo, TarjetaMetrica],
  templateUrl: './abastecimiento.html',
  styleUrls: ['../../estilos-compartidos.css', './abastecimiento.css'],
})
export class Abastecimiento {
  protected readonly servicio = inject(DashboardServicio);
  protected readonly numero = numero;
  protected readonly porcentaje = porcentaje;
}
