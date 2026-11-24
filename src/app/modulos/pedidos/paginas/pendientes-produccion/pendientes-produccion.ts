import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionPedidos } from '../../componentes/navegacion-pedidos/navegacion-pedidos';
import { PedidosServicio } from '../../servicios/pedidos-servicio';
import type { PendienteProduccion } from '../../modelos/pedido';

@Component({
  selector: 'app-pendientes-produccion',
  imports: [DatePipe, RouterLink, NavegacionPedidos],
  templateUrl: './pendientes-produccion.html',
  styleUrl: './pendientes-produccion.css',
})
export class PendientesProduccion {
  protected readonly servicio = inject(PedidosServicio);
  private readonly avisos = inject(AvisosServicio);

  protected readonly busqueda = signal('');

  constructor() {
    this.servicio.sincronizarDesdeVentas();
  }

  protected readonly pendientes = this.servicio.pendientesProduccion;

  protected readonly filtrados = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    if (termino === '') {
      return this.pendientes();
    }
    return this.pendientes().filter(
      (grupo) =>
        grupo.sku.toLowerCase().includes(termino) ||
        grupo.nombreProducto.toLowerCase().includes(termino) ||
        grupo.pedidos.some((folio) => folio.toLowerCase().includes(termino)),
    );
  });

  protected readonly demandaTotal = computed(() =>
    this.filtrados().reduce((suma, grupo) => suma + grupo.demanda, 0),
  );

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected crearOrden(grupo: PendienteProduccion): void {
    this.avisos.mostrar(
      'informacion',
      `La demanda de ${grupo.sku} (${grupo.demanda} unidad(es)) está lista para M16. Crear o ajustar la orden requiere la integración con Flask; no se simuló ninguna orden.`,
    );
  }
}
