import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { mensajeError } from '../../core/api/errores';
import {
  ComprobantePedido,
  FILTROS_ESTADO,
  MisPedidosServicio,
  PedidoCliente,
  etiquetaEstado,
} from './servicios/mis-pedidos-servicio';

export type {
  ArticuloPedido,
  ComprobantePedido,
  PasoSeguimientoPedido,
  PedidoCliente,
} from './servicios/mis-pedidos-servicio';
export { etiquetaEstado } from './servicios/mis-pedidos-servicio';

const CANCELABLES = ['RECIBIDO', 'CONFIRMADO', 'EN_PRODUCCION'];

@Component({
  selector: 'app-mis-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mispedidos.html',
  styles: [],
})
export class MisPedidos implements OnInit {
  private readonly router = inject(Router);
  private readonly servicio = inject(MisPedidosServicio);
  private _pedidos: PedidoCliente[] = [];

  @Input() set pedidos(_pedidos: PedidoCliente[]) {
    // La fuente de verdad es Flask; el padre ya no reemplaza el historial.
  }
  get pedidos(): PedidoCliente[] {
    return this._pedidos;
  }

  @Output() cerrar = new EventEmitter<void>();
  @Output() irACatalogo = new EventEmitter<void>();
  @Output() solicitarCambioODevolucion = new EventEmitter<PedidoCliente>();

  readonly filtros = FILTROS_ESTADO;
  readonly etiquetaEstado = etiquetaEstado;

  busquedaFolio = '';
  filtroEstado = 'TODOS';
  pedidoSeleccionado: PedidoCliente | null = null;
  comprobante: ComprobantePedido | null = null;
  mensajeAviso = '';
  cargando = true;

  ngOnInit(): void {
    this.cargar();
  }

  get pedidosFiltrados(): PedidoCliente[] {
    const query = this.busquedaFolio.trim().toLowerCase();
    return this._pedidos.filter((pedido) => !query || pedido.folio.toLowerCase().includes(query));
  }

  cargar(): void {
    this.cargando = true;
    this.servicio.listar(this.filtroEstado).subscribe({
      next: (pedidos) => {
        this._pedidos = pedidos;
        this.cargando = false;
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.mensajeAviso = mensajeError(error, 'No fue posible cargar tus pedidos.');
      },
    });
  }

  cambiarFiltro(estado: string): void {
    this.filtroEstado = estado;
    this.cargar();
  }

  cerrarPedidos(): void {
    this.cerrar.emit();
    void this.router.navigate(['/catalogo']);
  }

  explorarCatalogo(): void {
    this.irACatalogo.emit();
    void this.router.navigate(['/catalogo']);
  }

  abrirSeguimiento(pedido: PedidoCliente): void {
    this.mensajeAviso = '';
    this.comprobante = null;
    this.servicio.detalle(pedido.id).subscribe({
      next: (detalle) => (this.pedidoSeleccionado = detalle),
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  volverALista(): void {
    this.pedidoSeleccionado = null;
    this.comprobante = null;
    this.mensajeAviso = '';
  }

  puedeCancelar(pedido: PedidoCliente): boolean {
    return CANCELABLES.includes(pedido.estado);
  }

  cancelarPedido(pedido: PedidoCliente): void {
    const motivo = window.prompt('Indica el motivo de la cancelación:');
    if (!motivo || motivo.trim().length < 3) return;
    this.servicio.cancelar(pedido.id, motivo.trim()).subscribe({
      next: (cancelado) => {
        this.pedidoSeleccionado = cancelado;
        this._pedidos = this._pedidos.map((item) => (item.id === cancelado.id ? cancelado : item));
        this.mensajeAviso = `El pedido ${cancelado.folio} fue cancelado.`;
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  verComprobante(pedido: PedidoCliente): void {
    this.servicio.comprobante(pedido.id).subscribe({
      next: (comprobante) => (this.comprobante = comprobante),
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  onSolicitarCambio(pedido: PedidoCliente): void {
    this.solicitarCambioODevolucion.emit(pedido);
    void this.router.navigate(['/devoluciones'], {
      queryParams: { pedido_id: pedido.id, folio: pedido.folio },
    });
  }
}
