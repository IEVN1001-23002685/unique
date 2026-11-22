import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChipEstadoPedido } from '../../componentes/chip-estado-pedido/chip-estado-pedido';
import { NavegacionPedidos } from '../../componentes/navegacion-pedidos/navegacion-pedidos';
import { SemaforoPedido } from '../../componentes/semaforo-pedido/semaforo-pedido';
import {
  ESTADOS_TABLERO,
  ETIQUETAS_ESTADO,
  PedidosServicio,
} from '../../servicios/pedidos-servicio';
import type { EstadoPedido, Pedido, PrioridadPedido } from '../../modelos/pedido';

type Periodo = 'TODOS' | 'HOY' | 'MES';
type Vista = 'tablero' | 'lista';

interface ColumnaTablero {
  estado: EstadoPedido;
  etiqueta: string;
  pedidos: Pedido[];
}

@Component({
  selector: 'app-bandeja-pedidos',
  imports: [RouterLink, ChipEstadoPedido, NavegacionPedidos, SemaforoPedido],
  templateUrl: './bandeja-pedidos.html',
  styleUrl: './bandeja-pedidos.css',
})
export class BandejaPedidos {
  protected readonly servicio = inject(PedidosServicio);

  protected readonly busqueda = signal('');
  protected readonly prioridad = signal<PrioridadPedido | 'TODOS'>('TODOS');
  protected readonly periodo = signal<Periodo>('TODOS');
  protected readonly estado = signal<EstadoPedido | 'TODOS'>('TODOS');
  protected readonly vista = signal<Vista>('tablero');

  protected readonly prioridades: { valor: PrioridadPedido | 'TODOS'; etiqueta: string }[] = [
    { valor: 'TODOS', etiqueta: 'Todas las prioridades' },
    { valor: 'ALTA', etiqueta: 'Alta' },
    { valor: 'NORMAL', etiqueta: 'Normal' },
  ];

  protected readonly periodos: { valor: Periodo; etiqueta: string }[] = [
    { valor: 'TODOS', etiqueta: 'Todos los periodos' },
    { valor: 'HOY', etiqueta: 'Hoy' },
    { valor: 'MES', etiqueta: 'Este mes' },
  ];

  protected readonly estados: { valor: EstadoPedido | 'TODOS'; etiqueta: string }[] = [
    { valor: 'TODOS', etiqueta: 'Todos los estados activos' },
    ...ESTADOS_TABLERO.map((estado) => ({ valor: estado, etiqueta: ETIQUETAS_ESTADO[estado] })),
  ];

  constructor() {
    // M08 entrega pagos validados y cancelaciones; M09 conserva la propiedad del estado.
    this.servicio.sincronizarDesdeVentas();
  }

  protected readonly indicadores = this.servicio.indicadores;

  protected readonly filtrados = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const mes = hoy.slice(0, 7);
    const periodo = this.periodo();

    return this.servicio
      .pedidos()
      .filter((pedido) => ESTADOS_TABLERO.includes(pedido.estado))
      .filter((pedido) => {
        const coincidePeriodo =
          periodo === 'TODOS' ||
          (periodo === 'HOY'
            ? pedido.fechaCreacion.startsWith(hoy)
            : pedido.fechaCreacion.startsWith(mes));
        const coincidePrioridad =
          this.prioridad() === 'TODOS' || pedido.prioridad === this.prioridad();
        const coincideEstado = this.estado() === 'TODOS' || pedido.estado === this.estado();
        const coincideTexto =
          termino === '' ||
          pedido.folio.toLowerCase().includes(termino) ||
          pedido.ventaFolio.toLowerCase().includes(termino) ||
          pedido.cliente.toLowerCase().includes(termino) ||
          pedido.lineas.some((linea) => linea.sku.toLowerCase().includes(termino));

        return coincidePeriodo && coincidePrioridad && coincideEstado && coincideTexto;
      })
      .sort((a, b) => {
        if (a.prioridad !== b.prioridad) {
          return a.prioridad === 'ALTA' ? -1 : 1;
        }
        return b.fechaCreacion.localeCompare(a.fechaCreacion);
      });
  });

  protected readonly columnas = computed<ColumnaTablero[]>(() =>
    ESTADOS_TABLERO.map((estado) => ({
      estado,
      etiqueta: ETIQUETAS_ESTADO[estado],
      pedidos: this.filtrados().filter((pedido) => pedido.estado === estado),
    })),
  );

  protected readonly sinFiltros = computed(
    () =>
      this.busqueda().trim() === '' &&
      this.prioridad() === 'TODOS' &&
      this.periodo() === 'TODOS' &&
      this.estado() === 'TODOS',
  );

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarPrioridad(evento: Event): void {
    this.prioridad.set((evento.target as HTMLSelectElement).value as PrioridadPedido | 'TODOS');
  }

  protected alCambiarPeriodo(evento: Event): void {
    this.periodo.set((evento.target as HTMLSelectElement).value as Periodo);
  }

  protected alCambiarEstado(evento: Event): void {
    this.estado.set((evento.target as HTMLSelectElement).value as EstadoPedido | 'TODOS');
  }

  protected restablecer(): void {
    this.busqueda.set('');
    this.prioridad.set('TODOS');
    this.periodo.set('TODOS');
    this.estado.set('TODOS');
  }

  protected tiempo(pedido: Pedido): string {
    return this.servicio.formatoTiempo(this.servicio.horasEnEstado(pedido));
  }
}
