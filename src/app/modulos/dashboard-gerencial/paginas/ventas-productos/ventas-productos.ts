import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TarjetaMetrica } from '../../componentes/tarjeta-metrica/tarjeta-metrica';
import { mxn, numero, porcentaje, type MetricaDashboard } from '../../modelos/dashboard';
import { DashboardServicio } from '../../servicios/dashboard-servicio';

@Component({
  selector: 'app-ventas-productos',
  imports: [RouterLink, TarjetaMetrica],
  templateUrl: './ventas-productos.html',
  styleUrls: ['../../estilos-compartidos.css', './ventas-productos.css'],
})
export class VentasProductos {
  protected readonly servicio = inject(DashboardServicio);
  protected readonly mxn = mxn;
  protected readonly numero = numero;
  protected readonly porcentaje = porcentaje;

  protected readonly metricasVentas = computed(() =>
    this.servicio.metricasResumen().filter((metrica) => metrica.soloAdmin),
  );

  protected readonly metricasClientes = computed<MetricaDashboard[]>(() => {
    const clientes = this.servicio.clientes();
    return [
      {
        etiqueta: 'Clientes nuevos',
        valor: numero(clientes.nuevos),
        detalle: 'Primera compra en el periodo',
        tono: 'INFO',
      },
      {
        etiqueta: 'Recompra a 60 días',
        valor: numero(clientes.recompra),
        detalle: 'Segunda compra dentro de 60 días',
        tono: 'INFO',
      },
      {
        etiqueta: 'Tasa de recompra',
        valor: porcentaje(clientes.tasa),
        detalle: 'Clientes con segunda compra ÷ clientes con primera',
        tono: clientes.tasa >= 20 ? 'VERDE' : 'AMBAR',
      },
    ];
  });
}
