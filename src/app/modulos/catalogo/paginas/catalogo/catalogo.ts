import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { TarjetaProducto } from '../../../../compartido/componentes/tarjeta-producto/tarjeta-producto';
import { BusquedaCatalogoServicio } from '../../../../nucleo/servicios/busqueda-catalogo-servicio';
import { DesplegableCategorias } from '../../componentes/desplegable-categorias/desplegable-categorias';
import { PRODUCTOS_SIMULADOS } from '../../datos-simulados/productos';
import {
  COLORES_CATALOGO,
  CodigoColorCatalogo,
  CodigoTallaCatalogo,
  OrdenCatalogo,
  ProductoCatalogo,
  TALLAS_CATALOGO,
  productoDisponible,
  productoVisible,
} from '../../modelos/catalogo';

type RangoPrecio = 'todos' | 'hasta-300' | '301-500' | 'desde-501';

@Component({
  imports: [DesplegableCategorias, TarjetaProducto],
  selector: 'app-catalogo',
  styleUrl: './catalogo.css',
  templateUrl: './catalogo.html',
})
export class Catalogo {
  private readonly busqueda = inject(BusquedaCatalogoServicio);

  /** M10 entrega solo productos activos con al menos una variante activa. */
  protected readonly productos = signal<ProductoCatalogo[]>(
    PRODUCTOS_SIMULADOS.filter(productoVisible),
  );

  protected readonly categoriaSeleccionada = signal<string | null>(null);
  protected readonly colorSeleccionado = signal<CodigoColorCatalogo | null>(null);
  protected readonly tallaSeleccionada = signal<CodigoTallaCatalogo | null>(null);
  protected readonly rangoPrecio = signal<RangoPrecio>('todos');
  protected readonly soloDisponibles = signal(false);
  protected readonly orden = signal<OrdenCatalogo>('relevancia');
  protected readonly sinConexion = signal(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  protected readonly coloresCatalogo = COLORES_CATALOGO;

  protected readonly rangosPrecio: ReadonlyArray<{ valor: RangoPrecio; etiqueta: string }> = [
    { valor: 'todos', etiqueta: 'Todos los precios' },
    { valor: 'hasta-300', etiqueta: 'Hasta $300.00' },
    { valor: '301-500', etiqueta: '$301.00 a $500.00' },
    { valor: 'desde-501', etiqueta: 'Desde $501.00' },
  ];

  protected readonly opcionesOrden: ReadonlyArray<{ valor: OrdenCatalogo; etiqueta: string }> = [
    { valor: 'relevancia', etiqueta: 'Orden: relevancia' },
    { valor: 'precio-asc', etiqueta: 'Orden: precio menor' },
    { valor: 'precio-desc', etiqueta: 'Orden: precio mayor' },
    { valor: 'novedad', etiqueta: 'Orden: novedad' },
  ];

  /** Las categorías se derivan de los datos simulados, sin inventar catálogo. */
  protected readonly categorias = computed(() => [
    ...new Set(this.productos().map((producto) => producto.categoria)),
  ]);

  protected readonly colores = computed(() =>
    (Object.keys(COLORES_CATALOGO) as CodigoColorCatalogo[]).filter((color) =>
      this.productos().some((producto) =>
        producto.variantes.some((variante) => variante.activa && variante.colorCodigo === color),
      ),
    ),
  );

  protected readonly tallas = computed(() =>
    TALLAS_CATALOGO.filter((talla) =>
      this.productos().some((producto) =>
        producto.variantes.some((variante) => variante.activa && variante.talla === talla),
      ),
    ),
  );

  /** Etiqueta automática: más unidades vendidas en los últimos 30 días. */
  protected readonly masBuscadoId = computed(() => {
    const productos = this.productos();
    if (productos.length === 0) {
      return null;
    }
    return productos.reduce((ganador, producto) =>
      producto.vendidosUltimos30Dias > ganador.vendidosUltimos30Dias ? producto : ganador,
    ).id;
  });

  protected readonly hayFiltros = computed(
    () =>
      this.categoriaSeleccionada() !== null ||
      this.colorSeleccionado() !== null ||
      this.tallaSeleccionada() !== null ||
      this.rangoPrecio() !== 'todos' ||
      this.soloDisponibles(),
  );

  protected readonly productosFiltrados = computed(() => {
    const termino = this.busqueda.termino().trim().toLowerCase();
    const categoria = this.categoriaSeleccionada();
    const color = this.colorSeleccionado();
    const talla = this.tallaSeleccionada();
    const rango = this.rangoPrecio();
    const soloDisponibles = this.soloDisponibles();

    const filtrados = this.productos()
      .filter((producto) => {
        const coincideCategoria = categoria === null || producto.categoria === categoria;
        const coincideBusqueda =
          termino === '' ||
          producto.nombre.toLowerCase().includes(termino) ||
          producto.descripcion.toLowerCase().includes(termino);
        const coincideColor =
          color === null ||
          producto.variantes.some((variante) => variante.activa && variante.colorCodigo === color);
        const coincideTalla =
          talla === null ||
          producto.variantes.some((variante) => variante.activa && variante.talla === talla);
        const coincidePrecio = this.enRango(producto.precio, rango);
        const coincideDisponibilidad = !soloDisponibles || productoDisponible(producto);

        return (
          coincideCategoria &&
          coincideBusqueda &&
          coincideColor &&
          coincideTalla &&
          coincidePrecio &&
          coincideDisponibilidad
        );
      })
      .map((producto) => ({
        ...producto,
        etiqueta: producto.id === this.masBuscadoId() ? 'Más buscado' : undefined,
      }));

    return this.ordenar(filtrados, this.orden());
  });

  private enRango(precio: number, rango: RangoPrecio): boolean {
    switch (rango) {
      case 'hasta-300':
        return precio <= 300;
      case '301-500':
        return precio > 300 && precio <= 500;
      case 'desde-501':
        return precio > 500;
      default:
        return true;
    }
  }

  private ordenar(productos: ProductoCatalogo[], orden: OrdenCatalogo): ProductoCatalogo[] {
    const lista = [...productos];
    switch (orden) {
      case 'precio-asc':
        return lista.sort((a, b) => a.precio - b.precio);
      case 'precio-desc':
        return lista.sort((a, b) => b.precio - a.precio);
      case 'novedad':
        return lista.sort((a, b) => Date.parse(b.creadoEn) - Date.parse(a.creadoEn));
      default:
        return lista;
    }
  }

  protected actualizarColor(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.colorSeleccionado.set(valor === '' ? null : (valor as CodigoColorCatalogo));
  }

  protected actualizarTalla(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.tallaSeleccionada.set(valor === '' ? null : (valor as CodigoTallaCatalogo));
  }

  protected actualizarRango(evento: Event): void {
    this.rangoPrecio.set((evento.target as HTMLSelectElement).value as RangoPrecio);
  }

  protected actualizarOrden(evento: Event): void {
    this.orden.set((evento.target as HTMLSelectElement).value as OrdenCatalogo);
  }

  protected actualizarSoloDisponibles(evento: Event): void {
    this.soloDisponibles.set((evento.target as HTMLInputElement).checked);
  }

  protected limpiarFiltros(): void {
    this.categoriaSeleccionada.set(null);
    this.colorSeleccionado.set(null);
    this.tallaSeleccionada.set(null);
    this.rangoPrecio.set('todos');
    this.soloDisponibles.set(false);
    this.orden.set('relevancia');
    this.busqueda.termino.set('');
  }

  @HostListener('window:online')
  protected alConectar(): void {
    this.sinConexion.set(false);
  }

  @HostListener('window:offline')
  protected alDesconectar(): void {
    this.sinConexion.set(true);
  }
}
