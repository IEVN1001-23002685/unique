import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, debounceTime, switchMap } from 'rxjs';
import { mensajeError } from '../../../../core/api/errores';
import { TarjetaProducto } from '../../../../compartido/componentes/tarjeta-producto/tarjeta-producto';
import { BusquedaCatalogoServicio } from '../../../../nucleo/servicios/busqueda-catalogo-servicio';
import { DesplegableCategorias } from '../../componentes/desplegable-categorias/desplegable-categorias';
import { CatalogoServicio, type OrigenCatalogo } from '../../servicios/catalogo-servicio';
import {
  COLORES_CATALOGO,
  CodigoColorCatalogo,
  CodigoTallaCatalogo,
  OrdenCatalogo,
  ProductoCatalogo,
  TALLAS_CATALOGO,
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
  private readonly catalogo = inject(CatalogoServicio);

  protected readonly termino = this.busqueda.termino;

  protected readonly productos = signal<ProductoCatalogo[]>([]);
  private readonly opciones = signal<ProductoCatalogo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly origen = signal<OrigenCatalogo>('servidor');
  private readonly reintento = signal(0);

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

  protected readonly categorias = computed(() => [
    ...new Set(this.opciones().map((producto) => producto.categoria)),
  ]);

  protected readonly colores = computed(() =>
    (Object.keys(COLORES_CATALOGO) as CodigoColorCatalogo[]).filter((color) =>
      this.opciones().some((producto) =>
        producto.variantes.some((variante) => variante.activa && variante.colorCodigo === color),
      ),
    ),
  );

  protected readonly tallas = computed(() =>
    TALLAS_CATALOGO.filter((talla) =>
      this.opciones().some((producto) =>
        producto.variantes.some((variante) => variante.activa && variante.talla === talla),
      ),
    ),
  );

  protected readonly busquedaActiva = computed(() => this.termino().trim());

  protected readonly hayFiltros = computed(
    () =>
      this.categoriaSeleccionada() !== null ||
      this.colorSeleccionado() !== null ||
      this.tallaSeleccionada() !== null ||
      this.rangoPrecio() !== 'todos' ||
      this.soloDisponibles() ||
      this.busquedaActiva() !== '',
  );

  /** El backend publica solo productos activos con variantes activas y precio vigente. */
  protected readonly catalogoSinPublicaciones = computed(
    () => !this.cargando() && !this.error() && this.opciones().length === 0,
  );

  protected readonly aviso = computed(() => {
    if (this.sinConexion()) {
      return 'Sin conexión: existencias y precios pueden no estar actualizados.';
    }
    if (this.origen() === 'cache') {
      return 'Sin conexión: se muestran los últimos datos consultados. Existencias y precios pueden no estar actualizados.';
    }
    if (this.origen() === 'demostracion') {
      return 'Catálogo de demostración: Flask no respondió. Precios y disponibilidad son ejemplos, no datos confirmados.';
    }
    return '';
  });

  protected readonly productosFiltrados = computed(() => {
    const filtrados = this.productos()
      .filter(productoVisible)
      .filter((producto) => this.enRango(producto.precio, this.rangoPrecio()));
    return this.ordenar(filtrados, this.orden());
  });

  constructor() {
    this.catalogo
      .listar({ categoria: null, color: null, talla: null, soloDisponibles: false, busqueda: '' })
      .subscribe({
        next: (respuesta) => this.opciones.set(respuesta.datos.filter(productoVisible)),
      });

    combineLatest([
      toObservable(this.categoriaSeleccionada),
      toObservable(this.colorSeleccionado),
      toObservable(this.tallaSeleccionada),
      toObservable(this.soloDisponibles),
      toObservable(this.termino),
      toObservable(this.reintento),
    ])
      .pipe(
        debounceTime(120),
        takeUntilDestroyed(),
        switchMap(([categoria, color, talla, soloDisponibles, termino]) => {
          this.cargando.set(true);
          this.error.set('');
          return this.catalogo.listar({
            categoria,
            color,
            talla,
            soloDisponibles,
            busqueda: termino,
          });
        }),
      )
      .subscribe({
        next: (respuesta) => {
          const visibles = respuesta.datos.filter(productoVisible);
          this.productos.set(visibles);
          this.origen.set(respuesta.origen);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          this.productos.set([]);
          this.cargando.set(false);
          this.error.set(mensajeError(error, 'No fue posible cargar el catálogo.'));
        },
      });
  }

  protected reintentar(): void {
    this.error.set('');
    this.cargando.set(true);
    this.reintento.update((valor) => valor + 1);
  }

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
        return lista.sort((a, b) => this.fechaOrden(b) - this.fechaOrden(a));
      default:
        return lista.sort(
          (a, b) =>
            Number(b.masBuscado) - Number(a.masBuscado) ||
            this.fechaOrden(b) - this.fechaOrden(a),
        );
    }
  }

  private fechaOrden(producto: ProductoCatalogo): number {
    const fecha = Date.parse(producto.creadoEn);
    return Number.isNaN(fecha) ? 0 : fecha;
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

  protected limpiarBusqueda(): void {
    this.termino.set('');
  }

  protected limpiarFiltros(): void {
    this.categoriaSeleccionada.set(null);
    this.colorSeleccionado.set(null);
    this.tallaSeleccionada.set(null);
    this.rangoPrecio.set('todos');
    this.soloDisponibles.set(false);
    this.orden.set('relevancia');
    this.termino.set('');
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
