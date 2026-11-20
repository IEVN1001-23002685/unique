import { Component, computed, inject, signal } from '@angular/core';
import { TarjetaProducto } from '../../../../compartido/componentes/tarjeta-producto/tarjeta-producto';
import { BusquedaCatalogoServicio } from '../../../../nucleo/servicios/busqueda-catalogo-servicio';
import { DesplegableCategorias } from '../../componentes/desplegable-categorias/desplegable-categorias';
import { PRODUCTOS_SIMULADOS } from '../../datos-simulados/productos';

@Component({
  imports: [DesplegableCategorias, TarjetaProducto],
  selector: 'app-catalogo',
  styleUrl: './catalogo.css',
  templateUrl: './catalogo.html',
})
export class Catalogo {
  private readonly busqueda = inject(BusquedaCatalogoServicio);

  protected readonly productos = PRODUCTOS_SIMULADOS;
  protected readonly categoriaSeleccionada = signal<string | null>(null);

  /** Las categorías se derivan de los datos simulados, sin inventar catálogo. */
  protected readonly categorias = computed(() => [
    ...new Set(this.productos.map((producto) => producto.categoria)),
  ]);

  protected readonly productosFiltrados = computed(() => {
    const termino = this.busqueda.termino().trim().toLowerCase();
    const categoria = this.categoriaSeleccionada();

    return this.productos.filter((producto) => {
      const coincideCategoria = categoria === null || producto.categoria === categoria;
      const coincideBusqueda =
        termino === '' ||
        producto.nombre.toLowerCase().includes(termino) ||
        producto.descripcion.toLowerCase().includes(termino);

      return coincideCategoria && coincideBusqueda;
    });
  });
}
