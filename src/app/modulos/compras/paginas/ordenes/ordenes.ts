import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { mensajeError } from '../../../../core/api/errores';
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
  protected readonly guardando = signal(false);

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

  protected reintentar(): void {
    this.servicio.recargar().subscribe();
  }

  protected materiales(orden: OrdenCompra): string {
    return orden.lineas
      .map((linea) => this.servicio.obtenerMaterial(linea.materialId)?.codigo ?? 'Material')
      .join(', ');
  }

  protected emitir(orden: OrdenCompra): void {
    this.guardando.set(true);
    this.servicio
      .emitirOrden(orden.id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: () => this.avisos.mostrar('exito', `${orden.folio} se emitió en Flask.`),
        error: (error: unknown) => this.avisos.mostrar('error', mensajeError(error)),
      });
  }

  protected descargarPdf(orden: OrdenCompra): void {
    this.guardando.set(true);
    this.servicio
      .descargarOrdenPdf(orden.id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (pdf) => {
          const url = URL.createObjectURL(pdf);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = `${orden.folio}.pdf`;
          enlace.click();
          // Se libera después de que el navegador inicia la descarga.
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: (error: unknown) => this.avisos.mostrar('error', mensajeError(error)),
      });
  }

  protected confirmarCancelacion(): void {
    const orden = this.porCancelar();
    if (!orden) {
      return;
    }
    this.guardando.set(true);
    this.servicio
      .cancelarOrden(orden.id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: () => {
          this.porCancelar.set(null);
          this.avisos.mostrar('advertencia', `${orden.folio} se canceló en Flask.`);
        },
        error: (error: unknown) => this.avisos.mostrar('error', mensajeError(error)),
      });
  }

  protected confirmarEliminacion(): void {
    const orden = this.porEliminar();
    if (!orden) {
      return;
    }
    this.guardando.set(true);
    this.servicio
      .eliminarOrden(orden.id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (resultado) => {
          this.porEliminar.set(null);
          this.avisos.mostrar(
            resultado === 'eliminado' ? 'exito' : 'advertencia',
            resultado === 'eliminado'
              ? `${orden.folio} se eliminó en Flask.`
              : `${orden.folio} ya no está en BORRADOR: no se puede eliminar; usa cancelar.`,
          );
        },
        error: (error: unknown) => this.avisos.mostrar('error', mensajeError(error)),
      });
  }

  protected async abrirRecepcion(orden: OrdenCompra): Promise<void> {
    await this.router.navigate(['/recepciones'], { queryParams: { oc: orden.folio } });
  }
}
