import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ChipEstadoCompra } from '../../componentes/chip-estado-compra/chip-estado-compra';
import { NavegacionCompras } from '../../componentes/navegacion-compras/navegacion-compras';
import type { EstadoOrdenCompra, OrdenCompra } from '../../modelos/compra';
import { ComprasServicio } from '../../servicios/compras-servicio';

@Component({
  selector: 'app-ordenes',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    ChipEstadoCompra,
    NavegacionCompras,
    ModalConfirmacion,
  ],
  templateUrl: './ordenes.html',
  styleUrls: ['./ordenes.css', '../../compras-compartido.css'],
})
export class Ordenes {
  protected readonly servicio = inject(ComprasServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly router = inject(Router);

  protected readonly busqueda = signal('');
  protected readonly filtro = signal<EstadoOrdenCompra | 'TODOS'>('TODOS');
  protected readonly porCancelar = signal<OrdenCompra | null>(null);
  protected readonly porEliminar = signal<OrdenCompra | null>(null);

  protected readonly opciones: { valor: EstadoOrdenCompra | 'TODOS'; etiqueta: string }[] = [
    { valor: 'TODOS', etiqueta: 'Todas' },
    { valor: 'BORRADOR', etiqueta: 'Borrador' },
    { valor: 'EMITIDA', etiqueta: 'Emitidas' },
    { valor: 'PARCIAL', etiqueta: 'Parciales' },
    { valor: 'RECIBIDA', etiqueta: 'Recibidas' },
    { valor: 'CANCELADA', etiqueta: 'Canceladas' },
  ];

  protected readonly totales = computed(() => {
    const lista = this.servicio.ordenes();
    return {
      borradores: lista.filter((orden) => orden.estado === 'BORRADOR').length,
      emitidas: lista.filter((orden) => orden.estado === 'EMITIDA').length,
      enProceso: lista.filter((orden) => ['PARCIAL', 'RECIBIDA'].includes(orden.estado)).length,
      retrasadas: lista.filter((orden) => this.servicio.retrasada(orden)).length,
    };
  });

  protected readonly filtradas = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const estado = this.filtro();
    return this.servicio.ordenes().filter((orden) => {
      const coincideEstado = estado === 'TODOS' || orden.estado === estado;
      const coincideTexto =
        termino === '' ||
        orden.folio.toLowerCase().includes(termino) ||
        this.servicio.proveedorNombre(orden.proveedorId).toLowerCase().includes(termino) ||
        orden.lineas.some((linea) =>
          (this.servicio.obtenerMaterial(linea.materialId)?.nombre ?? '')
            .toLowerCase()
            .includes(termino),
        );
      return coincideEstado && coincideTexto;
    });
  });

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected materiales(orden: OrdenCompra): string {
    return orden.lineas
      .map((linea) => this.servicio.obtenerMaterial(linea.materialId)?.codigo ?? 'Material')
      .join(', ');
  }

  protected emitir(orden: OrdenCompra): void {
    this.servicio.emitirOrden(orden.id);
    this.avisos.mostrar(
      'exito',
      `${orden.folio} se emitió en la demostración. El envío en PDF a Flask está pendiente.`,
    );
  }

  protected descargarPdf(orden: OrdenCompra): void {
    this.avisos.mostrar(
      'informacion',
      `La descarga de ${orden.folio} se habilitará con GET /ordenes-compra/{id}/pdf de Flask.`,
    );
  }

  protected confirmarCancelacion(): void {
    const orden = this.porCancelar();
    if (!orden) {
      return;
    }
    this.servicio.cancelarOrden(orden.id);
    this.porCancelar.set(null);
    this.avisos.mostrar('advertencia', `${orden.folio} se canceló solo en memoria.`);
  }

  protected confirmarEliminacion(): void {
    const orden = this.porEliminar();
    if (!orden) {
      return;
    }
    const resultado = this.servicio.eliminarOrden(orden.id);
    this.porEliminar.set(null);
    this.avisos.mostrar(
      resultado === 'eliminado' ? 'exito' : 'advertencia',
      resultado === 'eliminado'
        ? `${orden.folio} se eliminó del borrador de demostración.`
        : `${orden.folio} tiene historial: ya no se puede eliminar, usa cancelar.`,
    );
  }

  protected async abrirRecepcion(orden: OrdenCompra): Promise<void> {
    await this.router.navigate(['/recepciones'], { queryParams: { oc: orden.folio } });
  }
}
