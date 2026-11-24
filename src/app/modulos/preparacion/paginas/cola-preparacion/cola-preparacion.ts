import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ChipEstadoPreparacion } from '../../componentes/chip-estado-preparacion/chip-estado-preparacion';
import { NavegacionPreparacion } from '../../componentes/navegacion-preparacion/navegacion-preparacion';
import { PasosPreparacion } from '../../componentes/pasos-preparacion/pasos-preparacion';
import type { Pedido } from '../../../pedidos/modelos/pedido';
import type { PrioridadPreparacion } from '../../modelos/preparacion';
import { PreparacionServicio } from '../../servicios/preparacion-servicio';

type OrdenCola = 'PRIORIDAD' | 'FECHA';

@Component({
  selector: 'app-cola-preparacion',
  imports: [DatePipe, RouterLink, ChipEstadoPreparacion, NavegacionPreparacion, PasosPreparacion],
  templateUrl: './cola-preparacion.html',
  styleUrls: ['./cola-preparacion.css', '../../estilos-compartidos.css'],
})
export class ColaPreparacion {
  protected readonly servicio = inject(PreparacionServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly router = inject(Router);

  protected readonly busqueda = signal('');
  protected readonly prioridad = signal<PrioridadPreparacion | 'TODAS'>('TODAS');
  protected readonly orden = signal<OrdenCola>('PRIORIDAD');

  protected readonly indicadores = this.servicio.indicadores;
  protected readonly enCurso = this.servicio.enCurso;
  protected readonly terminadas = this.servicio.terminadas;

  protected readonly filtrados = computed<Pedido[]>(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const lista = this.servicio.cola().filter((pedido) => {
      const coincidePrioridad =
        this.prioridad() === 'TODAS' || pedido.prioridad === this.prioridad();
      const coincideTexto =
        termino === '' ||
        pedido.folio.toLowerCase().includes(termino) ||
        pedido.cliente.toLowerCase().includes(termino) ||
        pedido.lineas.some((linea) => linea.sku.toLowerCase().includes(termino));
      return coincidePrioridad && coincideTexto;
    });

    if (this.orden() === 'FECHA') {
      return [...lista].sort((a, b) =>
        (a.fechaPromesa ?? '9999').localeCompare(b.fechaPromesa ?? '9999'),
      );
    }
    return lista;
  });

  protected readonly sinFiltros = computed(
    () => this.busqueda().trim() === '' && this.prioridad() === 'TODAS',
  );

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarPrioridad(evento: Event): void {
    this.prioridad.set(
      (evento.target as HTMLSelectElement).value as PrioridadPreparacion | 'TODAS',
    );
  }

  protected alCambiarOrden(evento: Event): void {
    this.orden.set((evento.target as HTMLSelectElement).value as OrdenCola);
  }

  protected restablecer(): void {
    this.busqueda.set('');
    this.prioridad.set('TODAS');
    this.orden.set('PRIORIDAD');
  }

  protected tomar(pedido: Pedido): void {
    const resultado = this.servicio.tomarPedido(pedido.folio);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'advertencia', resultado.mensaje);
    if (resultado.ok && resultado.folio) {
      void this.router.navigate(['/preparacion', resultado.folio]);
    }
  }

  protected paso(folioPreparacion: string) {
    const preparacion = this.servicio.obtener(folioPreparacion);
    return preparacion ? this.servicio.pasoDe(preparacion.estado) : 'PICKING';
  }

  protected articulos(pedido: Pedido): number {
    return pedido.lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  }
}
