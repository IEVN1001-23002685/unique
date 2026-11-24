import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NavegacionEntregas } from '../../componentes/navegacion-entregas/navegacion-entregas';
import type { ProductoRepartido } from '../../modelos/entrega';
import { EntregasServicio } from '../../servicios/entregas-servicio';

@Component({
  selector: 'app-productos-repartidos',
  imports: [DatePipe, RouterLink, NavegacionEntregas],
  templateUrl: './productos-repartidos.html',
  styleUrls: ['../../estilos-compartidos.css', './productos-repartidos.css'],
})
export class ProductosRepartidos {
  protected readonly servicio = inject(EntregasServicio);
  protected readonly repartidores = this.servicio.repartidores;
  protected readonly repartidorId = signal(0);
  protected readonly fecha = signal('');

  protected readonly filtrados = computed<ProductoRepartido[]>(() =>
    this.servicio
      .productosRepartidos()
      .filter(
        (item) =>
          (this.repartidorId() === 0 || item.repartidorId === this.repartidorId()) &&
          (this.fecha() === '' || item.fechaProgramada === this.fecha()),
      ),
  );

  protected readonly totalPiezas = computed(() =>
    this.filtrados().reduce((suma, item) => suma + item.cantidad, 0),
  );

  protected readonly totalPedidos = computed(
    () => new Set(this.filtrados().flatMap((item) => item.pedidos)).size,
  );

  protected alCambiarRepartidor(evento: Event): void {
    this.repartidorId.set(Number((evento.target as HTMLSelectElement).value));
  }

  protected alCambiarFecha(evento: Event): void {
    this.fecha.set((evento.target as HTMLInputElement).value);
  }

  protected restablecer(): void {
    this.repartidorId.set(0);
    this.fecha.set('');
  }
}
