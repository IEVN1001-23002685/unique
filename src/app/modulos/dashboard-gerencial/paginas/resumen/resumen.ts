import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChipSemaforo } from '../../componentes/chip-semaforo/chip-semaforo';
import { TarjetaMetrica } from '../../componentes/tarjeta-metrica/tarjeta-metrica';
import { mxn, numero } from '../../modelos/dashboard';
import { DashboardServicio } from '../../servicios/dashboard-servicio';

@Component({
  selector: 'app-resumen',
  imports: [RouterLink, ChipSemaforo, TarjetaMetrica],
  templateUrl: './resumen.html',
  styleUrls: ['../../estilos-compartidos.css', './resumen.css'],
})
export class Resumen {
  protected readonly servicio = inject(DashboardServicio);
  protected readonly mxn = mxn;
  protected readonly numero = numero;

  protected readonly maxVenta = computed(() =>
    Math.max(1, ...this.servicio.ventasPorMes().map((mes) => mes.valor)),
  );

  protected anchura(valor: number): string {
    return `${Math.max(3, Math.round((valor / this.maxVenta()) * 100))}%`;
  }
}
