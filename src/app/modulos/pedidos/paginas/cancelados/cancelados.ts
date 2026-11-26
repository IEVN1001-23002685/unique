import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NavegacionPedidos } from '../../componentes/navegacion-pedidos/navegacion-pedidos';
import { PedidosServicio } from '../../servicios/pedidos-servicio';

@Component({
  selector: 'app-cancelados',
  imports: [DatePipe, RouterLink, NavegacionPedidos],
  templateUrl: './cancelados.html',
  styleUrl: './cancelados.css',
})
export class Cancelados {
  protected readonly servicio = inject(PedidosServicio);
  protected readonly busqueda = signal('');

  constructor() {
    this.servicio.recargar().subscribe();
  }

  protected reintentar(): void {
    this.servicio.recargar().subscribe();
  }

  protected readonly cancelados = this.servicio.cancelados;

  protected readonly filtrados = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    if (termino === '') {
      return this.cancelados();
    }
    return this.cancelados().filter(
      (pedido) =>
        pedido.folio.toLowerCase().includes(termino) ||
        pedido.ventaFolio.toLowerCase().includes(termino) ||
        pedido.cliente.toLowerCase().includes(termino) ||
        (pedido.motivoCancelacion ?? '').toLowerCase().includes(termino) ||
        (pedido.canceladoPor ?? '').toLowerCase().includes(termino),
    );
  });

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }
}
