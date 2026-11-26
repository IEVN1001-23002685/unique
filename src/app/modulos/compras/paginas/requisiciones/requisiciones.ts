import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { mensajeError } from '../../../../core/api/errores';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ChipEstadoCompra } from '../../componentes/chip-estado-compra/chip-estado-compra';
import { NavegacionCompras } from '../../componentes/navegacion-compras/navegacion-compras';
import type { EstadoRequisicion, Requisicion } from '../../modelos/compra';
import { ComprasServicio } from '../../servicios/compras-servicio';

@Component({
  selector: 'app-requisiciones',
  imports: [DecimalPipe, RouterLink, ChipEstadoCompra, NavegacionCompras, ModalConfirmacion],
  templateUrl: './requisiciones.html',
  styleUrls: ['./requisiciones.css', '../../compras-compartido.css'],
})
export class Requisiciones {
  protected readonly servicio = inject(ComprasServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly router = inject(Router);

  protected readonly busqueda = signal('');
  protected readonly filtro = signal<EstadoRequisicion | 'TODOS'>('TODOS');
  protected readonly porCancelar = signal<Requisicion | null>(null);

  protected readonly opciones: { valor: EstadoRequisicion | 'TODOS'; etiqueta: string }[] = [
    { valor: 'TODOS', etiqueta: 'Todas' },
    { valor: 'PENDIENTE', etiqueta: 'Pendientes' },
    { valor: 'EN_COTIZACION', etiqueta: 'En cotización' },
    { valor: 'COMPRA_EMITIDA', etiqueta: 'Compra emitida' },
    { valor: 'ATENDIDA', etiqueta: 'Atendidas' },
    { valor: 'CANCELADA', etiqueta: 'Canceladas' },
  ];

  protected readonly totales = computed(() => {
    const lista = this.servicio.requisiciones();
    return {
      pendientes: lista.filter((item) => item.estado === 'PENDIENTE').length,
      cotizacion: lista.filter((item) => item.estado === 'EN_COTIZACION').length,
      emitidas: lista.filter((item) => item.estado === 'COMPRA_EMITIDA').length,
      atendidas: lista.filter((item) => item.estado === 'ATENDIDA').length,
    };
  });

  protected readonly filtradas = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const estado = this.filtro();

    return this.servicio.requisiciones().filter((requisicion) => {
      const coincideEstado = estado === 'TODOS' || requisicion.estado === estado;
      const coincideTexto =
        termino === '' ||
        requisicion.folio.toLowerCase().includes(termino) ||
        (requisicion.ordenProduccion ?? '').toLowerCase().includes(termino) ||
        requisicion.lineas.some((linea) => {
          const material = this.servicio.obtenerMaterial(linea.materialId);
          return (
            (material?.nombre ?? '').toLowerCase().includes(termino) ||
            (material?.codigo ?? '').toLowerCase().includes(termino) ||
            (linea.color ?? '').toLowerCase().includes(termino)
          );
        });
      return coincideEstado && coincideTexto;
    });
  });

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected materialNombre(materialId: number): string {
    const material = this.servicio.obtenerMaterial(materialId);
    return material ? `${material.codigo} · ${material.nombre}` : 'Material no disponible';
  }

  protected puedeGestionar(requisicion: Requisicion): boolean {
    return ['PENDIENTE', 'EN_COTIZACION'].includes(requisicion.estado);
  }

  protected cotizar(requisicion: Requisicion): void {
    this.servicio.generarCotizaciones(requisicion.id).subscribe({
      next: (resultado) => {
        if (!resultado) {
          this.avisos.mostrar(
            'error',
            `${requisicion.folio} no tiene líneas cotizables con proveedores activos.`,
          );
          return;
        }
        this.avisos.mostrar(
          'exito',
          resultado.conAlterno
            ? `Se generaron ${resultado.cantidad} cotizaciones en Flask para comparar.`
            : `Se generó ${resultado.cantidad} cotización en Flask: el material no tiene alterno.`,
        );
        void this.router.navigate(['/compras/cotizaciones'], {
          queryParams: { req: requisicion.folio },
        });
      },
      error: (error: unknown) => this.avisos.mostrar('error', mensajeError(error)),
    });
  }

  protected ordenDirecta(requisicion: Requisicion): void {
    this.servicio.emitirOrdenDirecta(requisicion.id).subscribe({
      next: (orden) => {
        if (!orden) {
          this.avisos.mostrar(
            'advertencia',
            'No hay proveedor principal disponible para emitir la orden directa.',
          );
          return;
        }
        this.avisos.mostrar(
          'exito',
          `${orden.folio} se creó y emitió en Flask con el precio del proveedor principal.`,
        );
        void this.router.navigate(['/compras/ordenes', orden.id, 'editar']);
      },
      error: (error: unknown) => this.avisos.mostrar('error', mensajeError(error)),
    });
  }

  protected confirmarCancelacion(): void {
    const requisicion = this.porCancelar();
    if (!requisicion) {
      return;
    }
    this.servicio.cancelarRequisicion(requisicion.id).subscribe({
      next: () => {
        this.porCancelar.set(null);
        this.avisos.mostrar('advertencia', `${requisicion.folio} se canceló en Flask.`);
      },
      error: (error: unknown) => this.avisos.mostrar('error', mensajeError(error)),
    });
  }
}
