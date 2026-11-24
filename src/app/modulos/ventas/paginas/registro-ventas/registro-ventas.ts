import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ChipEstadoVenta } from '../../componentes/chip-estado-venta/chip-estado-venta';
import { NavegacionVentas } from '../../componentes/navegacion-ventas/navegacion-ventas';
import { VentasServicio, fechaHoyIso } from '../../servicios/ventas-servicio';
import type { CanalVenta, EstadoPago } from '../../modelos/venta';

type Periodo = 'TODOS' | 'HOY' | 'MES';

@Component({
  selector: 'app-registro-ventas',
  imports: [CurrencyPipe, DatePipe, RouterLink, ChipEstadoVenta, NavegacionVentas],
  templateUrl: './registro-ventas.html',
  styleUrl: './registro-ventas.css',
})
export class RegistroVentas {
  protected readonly servicio = inject(VentasServicio);
  private readonly avisos = inject(AvisosServicio);

  private readonly tamanoPagina = 6;

  protected readonly busqueda = signal('');
  protected readonly periodo = signal<Periodo>('TODOS');
  protected readonly canal = signal<CanalVenta | 'TODOS'>('TODOS');
  protected readonly estadoPago = signal<EstadoPago | 'TODOS'>('TODOS');
  protected readonly pagina = signal(1);

  protected readonly periodos: { valor: Periodo; etiqueta: string }[] = [
    { valor: 'TODOS', etiqueta: 'Todos los periodos' },
    { valor: 'HOY', etiqueta: 'Hoy' },
    { valor: 'MES', etiqueta: 'Este mes' },
  ];

  protected readonly canales: { valor: CanalVenta | 'TODOS'; etiqueta: string }[] = [
    { valor: 'TODOS', etiqueta: 'Todos los canales' },
    { valor: 'TIENDA', etiqueta: 'Tienda' },
    { valor: 'MANUAL', etiqueta: 'Manual' },
    { valor: 'CAMBIO', etiqueta: 'Cambio' },
  ];

  protected readonly estadosPago: { valor: EstadoPago | 'TODOS'; etiqueta: string }[] = [
    { valor: 'TODOS', etiqueta: 'Todos los pagos' },
    { valor: 'PENDIENTE', etiqueta: 'Pendiente' },
    { valor: 'PAGADA', etiqueta: 'Pagada' },
    { valor: 'REEMBOLSADA_PARCIAL', etiqueta: 'Reembolso parcial' },
    { valor: 'REEMBOLSADA', etiqueta: 'Reembolsada' },
  ];

  protected readonly indicadores = this.servicio.indicadores;

  protected readonly filtrados = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const hoy = fechaHoyIso();
    const mes = hoy.slice(0, 7);
    const periodo = this.periodo();
    const canal = this.canal();
    const estado = this.estadoPago();

    return this.servicio
      .ventas()
      .filter((venta) => {
        const coincidePeriodo =
          periodo === 'TODOS' ||
          (periodo === 'HOY' ? venta.fecha.startsWith(hoy) : venta.fecha.startsWith(mes));
        const coincideCanal = canal === 'TODOS' || venta.canal === canal;
        const coincideEstado = estado === 'TODOS' || venta.estadoPago === estado;
        const coincideTexto =
          termino === '' ||
          venta.folio.toLowerCase().includes(termino) ||
          venta.cliente.toLowerCase().includes(termino);

        return coincidePeriodo && coincideCanal && coincideEstado && coincideTexto;
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  });

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.filtrados().length / this.tamanoPagina)),
  );

  protected readonly paginaSegura = computed(() =>
    Math.min(Math.max(1, this.pagina()), this.totalPaginas()),
  );

  protected readonly numerosPagina = computed(() =>
    Array.from({ length: this.totalPaginas() }, (_, indice) => indice + 1),
  );

  protected readonly visibles = computed(() => {
    const inicio = (this.paginaSegura() - 1) * this.tamanoPagina;
    return this.filtrados().slice(inicio, inicio + this.tamanoPagina);
  });

  protected readonly sinFiltros = computed(
    () =>
      this.busqueda().trim() === '' &&
      this.periodo() === 'TODOS' &&
      this.canal() === 'TODOS' &&
      this.estadoPago() === 'TODOS',
  );

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
    this.pagina.set(1);
  }

  protected alCambiarPeriodo(evento: Event): void {
    this.periodo.set((evento.target as HTMLSelectElement).value as Periodo);
    this.pagina.set(1);
  }

  protected alCambiarCanal(evento: Event): void {
    this.canal.set((evento.target as HTMLSelectElement).value as CanalVenta | 'TODOS');
    this.pagina.set(1);
  }

  protected alCambiarEstado(evento: Event): void {
    this.estadoPago.set((evento.target as HTMLSelectElement).value as EstadoPago | 'TODOS');
    this.pagina.set(1);
  }

  protected restablecer(): void {
    this.busqueda.set('');
    this.periodo.set('TODOS');
    this.canal.set('TODOS');
    this.estadoPago.set('TODOS');
    this.pagina.set(1);
  }

  protected exportarCsv(): void {
    const filas = this.filtrados();
    if (filas.length === 0) {
      this.avisos.mostrar('advertencia', 'No hay ventas filtradas para exportar.');
      return;
    }

    const escapar = (valor: string | number): string => `"${String(valor).replace(/"/g, '""')}"`;
    const cabecera = [
      'Folio',
      'Cliente',
      'Fecha',
      'Canal',
      'Total MXN',
      'Estado de pago',
      'Estado del pedido',
    ];
    const cuerpo = filas.map((venta) => [
      venta.folio,
      venta.cliente,
      venta.fecha.replace('T', ' '),
      venta.canal,
      venta.total.toFixed(2),
      venta.estadoPago,
      venta.estadoPedido,
    ]);
    const contenido = [cabecera, ...cuerpo].map((fila) => fila.map(escapar).join(',')).join('\r\n');
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${contenido}`], { type: 'text/csv;charset=utf-8;' }),
    );
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `ventas-unique-${fechaHoyIso()}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);

    this.avisos.mostrar(
      'exito',
      `${filas.length} ventas exportadas a CSV de demostración. No se envió nada a un servidor.`,
    );
  }
}
