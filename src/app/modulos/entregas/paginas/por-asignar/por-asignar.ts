import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ModalAsignacion } from '../../componentes/modal-asignacion/modal-asignacion';
import { NavegacionEntregas } from '../../componentes/navegacion-entregas/navegacion-entregas';
import type { Pedido } from '../../../pedidos/modelos/pedido';
import type { DatosAsignacion, DireccionEntrega } from '../../modelos/entrega';
import { EntregasServicio } from '../../servicios/entregas-servicio';

type Orden = 'CP' | 'FECHA';

@Component({
  selector: 'app-por-asignar',
  imports: [DatePipe, RouterLink, ModalAsignacion, NavegacionEntregas],
  templateUrl: './por-asignar.html',
  styleUrls: ['../../estilos-compartidos.css', './por-asignar.css'],
})
export class PorAsignar {
  protected readonly servicio = inject(EntregasServicio);
  private readonly avisos = inject(AvisosServicio);

  protected readonly busqueda = signal('');
  protected readonly orden = signal<Orden>('CP');
  protected readonly asignando = signal<Pedido | null>(null);
  protected readonly indicadores = this.servicio.indicadores;

  protected readonly filtrados = computed<Pedido[]>(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const lista = this.servicio.porAsignar().filter((pedido) => {
      const direccion = this.servicio.direccionDe(pedido);
      return (
        termino === '' ||
        pedido.folio.toLowerCase().includes(termino) ||
        pedido.ventaFolio.toLowerCase().includes(termino) ||
        pedido.cliente.toLowerCase().includes(termino) ||
        direccion.colonia.toLowerCase().includes(termino) ||
        direccion.cp.includes(termino)
      );
    });

    return lista.sort((a, b) => {
      if (this.orden() === 'FECHA') {
        return (a.fechaPromesa ?? '9999').localeCompare(b.fechaPromesa ?? '9999');
      }
      const cpA = this.servicio.direccionDe(a).cp;
      const cpB = this.servicio.direccionDe(b).cp;
      return (
        cpA.localeCompare(cpB) || (a.fechaPromesa ?? '9999').localeCompare(b.fechaPromesa ?? '9999')
      );
    });
  });

  protected readonly sinFiltros = computed(() => this.busqueda().trim() === '');

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarOrden(evento: Event): void {
    this.orden.set((evento.target as HTMLSelectElement).value as Orden);
  }

  protected restablecer(): void {
    this.busqueda.set('');
    this.orden.set('CP');
  }

  protected asignar(datos: DatosAsignacion): void {
    const resultado = this.servicio.asignar(datos);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    if (resultado.ok) {
      this.asignando.set(null);
    }
  }

  protected direccion(pedido: Pedido): DireccionEntrega {
    return this.servicio.direccionDe(pedido);
  }

  protected piezas(pedido: Pedido): number {
    return pedido.lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  }
}
