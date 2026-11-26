import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionRecetas } from '../../componentes/navegacion-recetas/navegacion-recetas';
import type { Receta } from '../../modelos/receta';
import { RecetasServicio } from '../../servicios/recetas-servicio';

type FiltroEstado = 'TODOS' | Receta['estado'];

@Component({
  selector: 'app-biblioteca-recetas',
  imports: [CurrencyPipe, DatePipe, RouterLink, ModalConfirmacion, NavegacionRecetas],
  templateUrl: './biblioteca-recetas.html',
  styleUrl: './biblioteca-recetas.css',
})
export class BibliotecaRecetas {
  protected readonly servicio = inject(RecetasServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly router = inject(Router);

  protected readonly busqueda = signal('');
  protected readonly productoFiltro = signal('TODOS');
  protected readonly estadoFiltro = signal<FiltroEstado>('TODOS');
  protected readonly archivando = signal<Receta | null>(null);

  protected readonly totales = this.servicio.totales;

  protected readonly filtradas = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const producto = this.productoFiltro();
    const estado = this.estadoFiltro();

    return this.servicio
      .recetas()
      .filter((receta) => {
        const texto = [
          this.servicio.nombreProducto(receta.productoId),
          receta.talla,
          String(receta.version),
          receta.estado,
        ].some((valor) => valor.toLowerCase().includes(termino));
        return (
          texto &&
          (producto === 'TODOS' || String(receta.productoId) === producto) &&
          (estado === 'TODOS' || receta.estado === estado)
        );
      })
      .sort(
        (a, b) =>
          a.productoId - b.productoId || a.talla.localeCompare(b.talla) || b.version - a.version,
      );
  });

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarProducto(evento: Event): void {
    this.productoFiltro.set((evento.target as HTMLSelectElement).value);
  }

  protected alCambiarEstado(evento: Event): void {
    this.estadoFiltro.set((evento.target as HTMLSelectElement).value as FiltroEstado);
  }

  protected editar(receta: Receta): void {
    void this.router.navigate(['/admin/recetas/editar', receta.id]);
  }

  constructor() {
    this.servicio.recargar().subscribe({
      error: () => this.avisos.mostrar('error', 'No fue posible cargar las recetas desde Flask.'),
    });
  }

  protected copiar(receta: Receta): void {
    this.servicio.copiarReceta(receta.id).subscribe((resultado) => {
      this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
      if (resultado.ok && resultado.recetaId !== undefined) {
        void this.router.navigate(['/admin/recetas/editar', resultado.recetaId]);
      }
    });
  }

  protected historial(receta: Receta): void {
    void this.router.navigate(['/admin/recetas/historial'], {
      queryParams: { producto: receta.productoId, talla: receta.talla },
    });
  }

  protected activar(receta: Receta): void {
    this.servicio.activarReceta(receta.id).subscribe((resultado) => {
      this.avisos.mostrar(resultado.ok ? 'exito' : 'advertencia', resultado.mensaje);
    });
  }

  protected razonesActivacion(receta: Receta): string {
    return this.servicio.validarActivacion(receta).join(' ');
  }

  protected pedirArchivado(receta: Receta): void {
    this.archivando.set(receta);
  }

  protected confirmarArchivado(): void {
    const receta = this.archivando();
    if (!receta) {
      return;
    }
    this.servicio.archivarReceta(receta.id).subscribe((resultado) => {
      this.avisos.mostrar(resultado.ok ? 'advertencia' : 'error', resultado.mensaje);
    });
    this.archivando.set(null);
  }
}
