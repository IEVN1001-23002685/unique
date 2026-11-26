import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionProductos } from '../../componentes/navegacion-productos/navegacion-productos';
import type { FilaVariante } from '../../modelos/producto-maestro';
import { ProductosServicio } from '../../servicios/productos-servicio';

@Component({
  selector: 'app-variantes',
  imports: [RouterLink, NavegacionProductos],
  templateUrl: './variantes.html',
  styleUrl: './variantes.css',
})
export class Variantes {
  protected readonly servicio = inject(ProductosServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly busqueda = signal('');
  protected readonly productoFiltro = signal('TODOS');

  protected readonly filas = this.servicio.filasVariantes;

  protected readonly filtradas = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const producto = this.productoFiltro();

    return this.filas().filter((fila) => {
      const coincide =
        termino === '' ||
        [
          fila.variante.sku,
          fila.productoNombre,
          fila.categoria,
          this.servicio.nombreTalla(fila.variante.talla),
          this.servicio.nombreColor(fila.variante.color),
        ].some((valor) => valor.toLowerCase().includes(termino));
      return coincide && (producto === 'TODOS' || String(fila.productoId) === producto);
    });
  });

  protected readonly conteos = computed(() => {
    const filas = this.filtradas();
    return {
      total: filas.length,
      activas: filas.filter((fila) => fila.variante.activa).length,
      inactivas: filas.filter((fila) => !fila.variante.activa).length,
      sinExistencia: filas.filter((fila) => fila.variante.existencia === 0).length,
    };
  });

  constructor() {
    this.ruta.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.productoFiltro.set(params.get('producto') ?? 'TODOS');
    });
    this.servicio.recargar().subscribe();
  }

  protected reintentar(): void {
    this.servicio.recargar().subscribe();
  }

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarProducto(evento: Event): void {
    this.productoFiltro.set((evento.target as HTMLSelectElement).value);
  }

  protected disponible(fila: FilaVariante): number {
    return fila.variante.existencia - fila.variante.reservado;
  }

  protected alternar(fila: FilaVariante): void {
    this.servicio.alternarVariante(fila.productoId, fila.variante.id).subscribe({
      next: (resultado) =>
        this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje),
      error: () => this.avisos.mostrar('error', 'No fue posible cambiar la variante en Flask.'),
    });
  }

  protected avisoM12(): void {
    this.avisos.mostrar(
      'informacion',
      'M12 · Inventario de prendas aún no está implementado. Las existencias se consultan, nunca se editan desde M10.',
    );
  }
}
