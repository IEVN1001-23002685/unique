import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NavegacionInventarioPt } from '../../componentes/navegacion-inventario-pt/navegacion-inventario-pt';
import type {
  MovimientoProducto,
  TipoDocumentoMovimiento,
  TipoMovimientoProducto,
} from '../../modelos/inventario-producto-terminado';
import { InventarioProductoServicio } from '../../servicios/inventario-producto-terminado-servicio';

type FiltroTipo = 'TODOS' | TipoMovimientoProducto;
type FiltroDocumento = 'TODOS' | TipoDocumentoMovimiento;

@Component({
  selector: 'app-movimientos-inventario-pt',
  imports: [DatePipe, RouterLink, NavegacionInventarioPt],
  templateUrl: './movimientos.html',
  styleUrls: ['./movimientos.css', '../../estilos-compartidos.css'],
})
export class Movimientos {
  protected readonly servicio = inject(InventarioProductoServicio);

  protected readonly tipos: readonly FiltroTipo[] = [
    'TODOS',
    'PRODUCCION',
    'RESERVA',
    'LIBERA_RESERVA',
    'SALIDA_ENVIO',
    'REINGRESO',
    'MERMA',
    'AJUSTE',
  ];

  protected readonly documentos: readonly FiltroDocumento[] = [
    'TODOS',
    'ORDEN',
    'PEDIDO',
    'DEVOLUCION',
    'ENTREGA',
    'AJUSTE',
  ];

  protected readonly etiquetasTipo: Record<TipoMovimientoProducto, string> = {
    PRODUCCION: 'Producción',
    RESERVA: 'Reserva',
    LIBERA_RESERVA: 'Libera reserva',
    SALIDA_ENVIO: 'Salida por envío',
    REINGRESO: 'Reingreso',
    MERMA: 'Merma',
    AJUSTE: 'Ajuste',
  };

  protected readonly skuFiltro = signal('TODOS');
  protected readonly tipoFiltro = signal<FiltroTipo>('TODOS');
  protected readonly documentoFiltro = signal<FiltroDocumento>('TODOS');
  protected readonly folio = signal('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');

  protected readonly filtrados = computed<MovimientoProducto[]>(() => {
    const sku = this.skuFiltro();
    const tipo = this.tipoFiltro();
    const documento = this.documentoFiltro();
    const folio = this.folio().trim().toLowerCase();
    const desde = this.desde();
    const hasta = this.hasta();

    return this.servicio.movimientos().filter((movimiento) => {
      const fecha = movimiento.fecha.slice(0, 10);
      return (
        (sku === 'TODOS' || movimiento.sku === sku) &&
        (tipo === 'TODOS' || movimiento.tipo === tipo) &&
        (documento === 'TODOS' || movimiento.documentoTipo === documento) &&
        (folio === '' || movimiento.documentoId.toLowerCase().includes(folio)) &&
        (desde === '' || fecha >= desde) &&
        (hasta === '' || fecha <= hasta)
      );
    });
  });

  protected alCambiarSku(evento: Event): void {
    this.skuFiltro.set((evento.target as HTMLSelectElement).value);
  }

  protected alCambiarTipo(evento: Event): void {
    this.tipoFiltro.set((evento.target as HTMLSelectElement).value as FiltroTipo);
  }

  protected alCambiarDocumento(evento: Event): void {
    this.documentoFiltro.set((evento.target as HTMLSelectElement).value as FiltroDocumento);
  }

  protected alCambiarFolio(evento: Event): void {
    this.folio.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarDesde(evento: Event): void {
    this.desde.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarHasta(evento: Event): void {
    this.hasta.set((evento.target as HTMLInputElement).value);
  }

  protected nombreProducto(sku: string): string {
    return this.servicio.filas().find((fila) => fila.sku === sku)?.productoNombre ?? '—';
  }

  protected claseTipo(movimiento: MovimientoProducto): string {
    if (movimiento.tipo === 'PRODUCCION' || movimiento.tipo === 'REINGRESO') {
      return 'entrada';
    }
    if (
      movimiento.tipo === 'SALIDA_ENVIO' ||
      movimiento.tipo === 'MERMA' ||
      (movimiento.tipo === 'AJUSTE' && movimiento.deltaExistencia < 0)
    ) {
      return 'salida';
    }
    if (movimiento.tipo === 'RESERVA' || movimiento.tipo === 'LIBERA_RESERVA') {
      return 'reserva';
    }
    return 'neutro';
  }
}
