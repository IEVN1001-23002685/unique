import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { formatearFechaHora } from '../../../../core/api/formato';
import {
  claseEstado,
  etiquetaEstado,
  etiquetaMotivo,
  etiquetaResolucion,
  type SolicitudCambioDevolucion,
} from '../../modelos/cambio-devolucion';

const FILTROS = [
  { valor: 'TODOS', etiqueta: 'Todas' },
  { valor: 'SOLICITADA', etiqueta: 'Solicitadas' },
  { valor: 'APROBADA', etiqueta: 'Aprobadas' },
  { valor: 'RECIBIDA', etiqueta: 'Recibidas' },
  { valor: 'RESUELTA', etiqueta: 'Resueltas' },
  { valor: 'RECHAZADA', etiqueta: 'Rechazadas' },
] as const;

/** Mis solicitudes del cliente: folio, estado y resolución (§7 M07). */
@Component({
  selector: 'app-cd-mis-solicitudes',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './mis-solicitudes.html',
  styleUrls: ['./mis-solicitudes.css', '../../cambios-devoluciones-compartido.css'],
})
export class MisSolicitudes {
  readonly solicitudes = input<SolicitudCambioDevolucion[]>([]);
  readonly cargando = input(false);
  readonly error = input('');
  readonly recargar = output<void>();

  readonly filtros = FILTROS;
  readonly filtro = signal('TODOS');
  readonly busqueda = new FormControl('', { nonNullable: true });
  private readonly consulta = toSignal(this.busqueda.valueChanges, { initialValue: '' });

  readonly etiquetaEstado = etiquetaEstado;
  readonly etiquetaMotivo = etiquetaMotivo;
  readonly etiquetaResolucion = etiquetaResolucion;
  readonly claseEstado = claseEstado;
  readonly formatearFechaHora = formatearFechaHora;

  readonly filtradas = computed(() => {
    const texto = this.consulta().trim().toLowerCase();
    return this.solicitudes().filter(
      (caso) =>
        (this.filtro() === 'TODOS' || caso.estado === this.filtro()) &&
        (!texto ||
          caso.folioCaso.toLowerCase().includes(texto) ||
          caso.folioPedido.toLowerCase().includes(texto)),
    );
  });

  protected cambiarFiltro(valor: string): void {
    this.filtro.set(valor);
  }
}
