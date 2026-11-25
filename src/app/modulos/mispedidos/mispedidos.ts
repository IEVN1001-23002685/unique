import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

export type EstadoPedido = 'Confirmado' | 'En preparación' | 'Enviado' | 'Entregado' | 'Cancelado';

export interface PasoSeguimientoPedido {
  estado: EstadoPedido;
  fecha: string;
  descripcion: string;
  completado: boolean;
}

export interface ArticuloPedido {
  nombre: string;
  sku: string;
  colorNombre: string;
  talla: string;
  cantidad: number;
  precioUnitarioConIva: number;
}

export interface PedidoCliente {
  id: number;
  folio: string;
  fecha: string;
  estado: EstadoPedido;
  metodoEnvio: 'Estándar' | 'Exprés';
  totalConIva: number;
  direccionResumen: string;
  medioPagoResumen: string;
  facturaResumen?: string;
  articulos: ArticuloPedido[];
  seguimiento: PasoSeguimientoPedido[];
}

@Component({
  selector: 'app-mis-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mispedidos.html',
  styles: [],
})
export class MisPedidos {
  private readonly router = inject(Router);

  @Input() pedidos: PedidoCliente[] = [
    {
      id: 1,
      folio: 'UNQ-849201',
      fecha: '18/11/2026',
      estado: 'Enviado',
      metodoEnvio: 'Estándar',
      totalConIva: 850,
      direccionResumen: 'Blvd. Universidad Tecnológica #225, San Carlos, León, Gto. (CP 37670)',
      medioPagoResumen: 'Tarjeta principal · Visa •••• 4242',
      articulos: [
        {
          nombre: 'SUDADERA',
          sku: 'SD-CH-NG',
          colorNombre: 'Negro',
          talla: 'CH',
          cantidad: 1,
          precioUnitarioConIva: 850,
        },
      ],
      seguimiento: [
        {
          estado: 'Confirmado',
          fecha: '18/11/2026 10:15',
          descripcion: 'Pago simulado validado y pedido registrado.',
          completado: true,
        },
        {
          estado: 'En preparación',
          fecha: '18/11/2026 15:40',
          descripcion: 'Prenda empacada con cuidado.',
          completado: true,
        },
        {
          estado: 'Enviado',
          fecha: '19/11/2026 09:20',
          descripcion: 'En camino con paquetería.',
          completado: true,
        },
        {
          estado: 'Entregado',
          fecha: 'Estimado 23/11/2026',
          descripcion: 'Entrega en domicilio registrada.',
          completado: false,
        },
      ],
    },
    {
      id: 2,
      folio: 'UNQ-847110',
      fecha: '05/11/2026',
      estado: 'Entregado',
      metodoEnvio: 'Exprés',
      totalConIva: 280,
      direccionResumen: 'Blvd. Universidad Tecnológica #225, San Carlos, León, Gto. (CP 37670)',
      medioPagoResumen: 'Monedero UNIQUE · Cuenta simulada',
      facturaResumen: 'XAXX010101000 · Cliente Demo',
      articulos: [
        {
          nombre: 'PLAYERA',
          sku: 'PL-MD-BL',
          colorNombre: 'Blanco',
          talla: 'MD',
          cantidad: 1,
          precioUnitarioConIva: 280,
        },
      ],
      seguimiento: [
        {
          estado: 'Confirmado',
          fecha: '05/11/2026 11:00',
          descripcion: 'Pedido confirmado.',
          completado: true,
        },
        {
          estado: 'En preparación',
          fecha: '05/11/2026 14:00',
          descripcion: 'Preparación completada.',
          completado: true,
        },
        {
          estado: 'Enviado',
          fecha: '06/11/2026 08:30',
          descripcion: 'Despachado en envío exprés.',
          completado: true,
        },
        {
          estado: 'Entregado',
          fecha: '07/11/2026 16:10',
          descripcion: 'Entregado satisfactoriamente.',
          completado: true,
        },
      ],
    },
  ];

  @Output() cerrar = new EventEmitter<void>();
  @Output() irACatalogo = new EventEmitter<void>();
  @Output() solicitarCambioODevolucion = new EventEmitter<PedidoCliente>();

  busquedaFolio = '';
  filtroEstado: 'todos' | EstadoPedido = 'todos';
  pedidoSeleccionado: PedidoCliente | null = null;
  mensajeAviso = '';

  estadosDisponibles: EstadoPedido[] = [
    'Confirmado',
    'En preparación',
    'Enviado',
    'Entregado',
    'Cancelado',
  ];

  get pedidosFiltrados(): PedidoCliente[] {
    const query = this.busquedaFolio.trim().toLowerCase();
    return this.pedidos.filter((p) => {
      const coincideFolio = !query || p.folio.toLowerCase().includes(query);
      const coincideEstado = this.filtroEstado === 'todos' || p.estado === this.filtroEstado;
      return coincideFolio && coincideEstado;
    });
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
    this.pedidoSeleccionado = pedido;
    this.mensajeAviso = '';
  }

  volverALista(): void {
    this.pedidoSeleccionado = null;
    this.mensajeAviso = '';
  }

  puedeCancelar(pedido: PedidoCliente): boolean {
    return pedido.estado === 'Confirmado' || pedido.estado === 'En preparación';
  }

  cancelarPedido(pedido: PedidoCliente): void {
    if (!this.puedeCancelar(pedido)) return;
    pedido.estado = 'Cancelado';
    pedido.seguimiento.push({
      estado: 'Cancelado',
      fecha: 'Hoy',
      descripcion: 'Pedido cancelado desde Mi cuenta.',
      completado: true,
    });
    this.mensajeAviso = `El pedido ${pedido.folio} ha sido marcado como Cancelado.`;
  }

  onSolicitarCambio(pedido: PedidoCliente): void {
    this.solicitarCambioODevolucion.emit(pedido);
    this.mensajeAviso = `Solicitud de cambio/devolución iniciada para el folio ${pedido.folio}.`;
    void this.router.navigate(['/devoluciones']);
  }
}
