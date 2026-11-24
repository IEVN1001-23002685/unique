import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { NavegacionVentas } from '../../componentes/navegacion-ventas/navegacion-ventas';
import { VentasServicio } from '../../servicios/ventas-servicio';
import type { Descuento } from '../../modelos/venta';

type FiltroAplicacion = 'TODOS' | 'CUPON' | 'AUTOMATICO';
type FiltroActivo = 'TODOS' | 'ACTIVOS' | 'INACTIVOS';

@Component({
  selector: 'app-descuentos-cupones',
  imports: [RouterLink, ModalConfirmacion, NavegacionVentas],
  templateUrl: './descuentos-cupones.html',
  styleUrl: './descuentos-cupones.css',
})
export class DescuentosCupones {
  protected readonly servicio = inject(VentasServicio);
  private readonly avisos = inject(AvisosServicio);

  protected readonly busqueda = signal('');
  protected readonly aplicacion = signal<FiltroAplicacion>('TODOS');
  protected readonly activo = signal<FiltroActivo>('TODOS');
  protected readonly descuentoAEliminar = signal<Descuento | null>(null);

  protected readonly filtrados = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const aplicacion = this.aplicacion();
    const activo = this.activo();

    return this.servicio.descuentos().filter((descuento) => {
      const coincideAplicacion = aplicacion === 'TODOS' || descuento.aplicacion === aplicacion;
      const coincideActivo =
        activo === 'TODOS' || (activo === 'ACTIVOS' ? descuento.activo : !descuento.activo);
      const coincideTexto =
        termino === '' ||
        descuento.nombre.toLowerCase().includes(termino) ||
        (descuento.codigo ?? '').toLowerCase().includes(termino);

      return coincideAplicacion && coincideActivo && coincideTexto;
    });
  });

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarAplicacion(evento: Event): void {
    this.aplicacion.set((evento.target as HTMLSelectElement).value as FiltroAplicacion);
  }

  protected alCambiarActivo(evento: Event): void {
    this.activo.set((evento.target as HTMLSelectElement).value as FiltroActivo);
  }

  protected formatoValor(descuento: Descuento): string {
    return descuento.tipo === 'PORCENTAJE'
      ? `${descuento.valor}%`
      : `$${descuento.valor.toFixed(2)}`;
  }

  protected vigencia(descuento: Descuento): string {
    return descuento.vigenteHasta === null
      ? `Desde ${descuento.vigenteDesde}`
      : `${descuento.vigenteDesde} al ${descuento.vigenteHasta}`;
  }

  protected confirmarEliminacion(): void {
    const descuento = this.descuentoAEliminar();
    if (!descuento) {
      return;
    }

    const resultado = this.servicio.eliminarDescuento(descuento.id);
    this.descuentoAEliminar.set(null);

    if (resultado === 'desactivado') {
      this.avisos.mostrar(
        'advertencia',
        `«${descuento.nombre}» ya tenía ${descuento.usosActuales} usos: se desactivó en memoria. El historial se conserva.`,
      );
      return;
    }

    this.avisos.mostrar(
      'exito',
      `«${descuento.nombre}» se eliminó de la lista de demostración. Persistencia pendiente de Flask.`,
    );
  }
}
