import { Component, inject } from '@angular/core';
import { ChipSemaforo } from '../../componentes/chip-semaforo/chip-semaforo';
import { TarjetaMetrica } from '../../componentes/tarjeta-metrica/tarjeta-metrica';
import { mxn, numero, porcentaje } from '../../modelos/dashboard';
import { DashboardServicio } from '../../servicios/dashboard-servicio';

@Component({
  selector: 'app-produccion-merma',
  imports: [ChipSemaforo, TarjetaMetrica],
  templateUrl: './produccion-merma.html',
  styleUrls: ['../../estilos-compartidos.css', './produccion-merma.css'],
})
export class ProduccionMerma {
  protected readonly servicio = inject(DashboardServicio);
  protected readonly mxn = mxn;
  protected readonly numero = numero;
  protected readonly porcentaje = porcentaje;
}
