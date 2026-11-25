import { CurrencyPipe } from '@angular/common';
import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CarritoServicio } from '../../../carrito/servicios/carrito-servicio';
import { PRODUCTOS_SIMULADOS } from '../../datos-simulados/productos';
import {
  COLORES_CATALOGO,
  CodigoColorCatalogo,
  CodigoTallaCatalogo,
  GUIA_MEDIDAS,
  ProductoCatalogo,
  VarianteCatalogo,
  estadoDisponibilidad,
  fechaEstimada,
  productoVisible,
} from '../../modelos/catalogo';

@Component({
  imports: [CurrencyPipe, RouterLink],
  selector: 'app-detalle-producto',
  styleUrl: './detalle-producto.css',
  templateUrl: './detalle-producto.html',
})
export class DetalleProducto {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly carrito = inject(CarritoServicio);

  protected readonly producto = signal<ProductoCatalogo | undefined>(undefined);
  protected readonly imagenNoDisponible = signal(false);
  protected readonly colorSeleccionado = signal<CodigoColorCatalogo | null>(null);
  protected readonly tallaSeleccionada = signal<CodigoTallaCatalogo | null>(null);
  protected readonly cantidad = signal(1);
  protected readonly mensaje = signal('');
  protected readonly sinConexion = signal(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  protected readonly coloresCatalogo = COLORES_CATALOGO;
  protected readonly guiaMedidas = GUIA_MEDIDAS;

  constructor() {
    this.ruta.paramMap.pipe(takeUntilDestroyed()).subscribe((parametros) => {
      const slug = parametros.get('slug') ?? '';
      const encontrado = PRODUCTOS_SIMULADOS.find(
        (producto) => producto.slug === slug && productoVisible(producto),
      );
      const primeraVariante = encontrado?.variantes.find((variante) => variante.activa);

      this.producto.set(encontrado);
      this.colorSeleccionado.set(primeraVariante?.colorCodigo ?? null);
      this.tallaSeleccionada.set(primeraVariante?.talla ?? null);
      this.cantidad.set(1);
      this.mensaje.set('');
      this.imagenNoDisponible.set(false);
    });
  }

  protected readonly variantes = computed(() =>
    (this.producto()?.variantes ?? []).filter((variante) => variante.activa),
  );

  protected readonly colores = computed(() => [
    ...new Set(this.variantes().map((variante) => variante.colorCodigo)),
  ]);

  protected readonly tallas = computed(() => [
    ...new Set(
      this.variantes()
        .filter((variante) => variante.colorCodigo === this.colorSeleccionado())
        .map((variante) => variante.talla),
    ),
  ]);

  protected readonly varianteSeleccionada = computed<VarianteCatalogo | undefined>(() => {
    const color = this.colorSeleccionado();
    const talla = this.tallaSeleccionada();
    return (
      this.variantes().find(
        (variante) => variante.colorCodigo === color && variante.talla === talla,
      ) ??
      this.variantes().find((variante) => variante.colorCodigo === color) ??
      this.variantes()[0]
    );
  });

  protected readonly estado = computed(() => {
    const variante = this.varianteSeleccionada();
    return variante ? estadoDisponibilidad(variante) : null;
  });

  protected readonly fechaEstimadaTexto = computed(() => {
    const variante = this.varianteSeleccionada();
    return variante ? fechaEstimada(variante) : undefined;
  });

  protected readonly imagen = computed(
    () => this.varianteSeleccionada()?.imagen || this.producto()?.imagen || '',
  );

  protected readonly compraBloqueada = computed(() => this.estado() === 'Agotado');

  protected get claseEstado(): string {
    switch (this.estado()) {
      case 'Disponible':
        return 'detalle__estado--disponible';
      case 'Pocas unidades':
        return 'detalle__estado--pocas';
      case 'Bajo pedido':
        return 'detalle__estado--pedido';
      default:
        return 'detalle__estado--agotado';
    }
  }

  protected variantePara(
    color: CodigoColorCatalogo,
    talla: CodigoTallaCatalogo,
  ): VarianteCatalogo | undefined {
    return this.variantes().find(
      (variante) => variante.colorCodigo === color && variante.talla === talla,
    );
  }

  protected seleccionarColor(color: CodigoColorCatalogo): void {
    this.colorSeleccionado.set(color);
    this.imagenNoDisponible.set(false);
    const tallaActual = this.tallaSeleccionada();
    const tallerDisponibles = this.tallas();
    if (tallaActual === null || !tallerDisponibles.includes(tallaActual)) {
      this.tallaSeleccionada.set(tallerDisponibles[0] ?? null);
    }
  }

  protected seleccionarTalla(talla: CodigoTallaCatalogo): void {
    this.tallaSeleccionada.set(talla);
  }

  protected disminuirCantidad(): void {
    this.cantidad.update((cantidad) => Math.max(1, cantidad - 1));
  }

  protected aumentarCantidad(): void {
    this.cantidad.update((cantidad) => Math.min(10, cantidad + 1));
  }

  protected cambiarCantidad(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    const entero = Number.isFinite(valor) ? Math.trunc(valor) : 1;
    this.cantidad.set(Math.min(10, Math.max(1, entero)));
  }

  /** Entrega variante (SKU) y cantidad a M04; no reserva existencias (§5 y §7). */
  protected agregarAlCarrito(): void {
    const producto = this.producto();
    const variante = this.varianteSeleccionada();
    if (!producto || !variante) {
      return;
    }

    const estado = estadoDisponibilidad(variante);
    if (estado === 'Agotado') {
      this.mensaje.set('Esta variante está agotada. Elige otra talla o color.');
      return;
    }

    this.carrito.agregar({
      idLinea: variante.sku,
      productoId: producto.id,
      nombre: producto.nombre,
      sku: variante.sku,
      colorNombre: variante.colorNombre,
      talla: variante.talla,
      precioUnitarioConIva: producto.precio,
      cantidad: this.cantidad(),
      estadoDisponibilidad: estado,
      fechaEstimada: fechaEstimada(variante),
      imagenUrl: this.imagen() || producto.imagen,
    });

    void this.router.navigate(['/carrito']);
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
