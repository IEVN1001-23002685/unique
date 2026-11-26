import { CurrencyPipe } from '@angular/common';
import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { mensajeError } from '../../../../core/api/errores';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { MAX_PIEZAS_POR_LINEA } from '../../../carrito/modelos/carrito';
import { CarritoServicio } from '../../../carrito/servicios/carrito-servicio';
import { CatalogoServicio, type OrigenCatalogo } from '../../servicios/catalogo-servicio';
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
  private readonly catalogo = inject(CatalogoServicio);
  private readonly sesion = inject(AuthStateService);

  protected readonly producto = signal<ProductoCatalogo | undefined>(undefined);
  protected readonly imagenNoDisponible = signal(false);
  protected readonly colorSeleccionado = signal<CodigoColorCatalogo | null>(null);
  protected readonly tallaSeleccionada = signal<CodigoTallaCatalogo | null>(null);
  protected readonly cantidad = signal(1);
  protected readonly mensaje = signal('');
  protected readonly error = signal('');
  protected readonly origen = signal<OrigenCatalogo>('servidor');
  protected readonly miniaturasSinImagen = signal<CodigoColorCatalogo[]>([]);
  protected readonly sinConexion = signal(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  protected readonly coloresCatalogo = COLORES_CATALOGO;
  protected readonly guiaMedidas = GUIA_MEDIDAS;

  constructor() {
    this.ruta.paramMap.pipe(takeUntilDestroyed()).subscribe((parametros) => {
      const productoId = Number(parametros.get('productoId') ?? parametros.get('slug') ?? '0');
      this.cantidad.set(1);
      this.mensaje.set('');
      this.error.set('');
      this.imagenNoDisponible.set(false);
      this.miniaturasSinImagen.set([]);
      this.origen.set('servidor');
      if (!Number.isInteger(productoId) || productoId <= 0) {
        this.producto.set(undefined);
        return;
      }

      this.catalogo.obtener(productoId).subscribe({
        next: (respuesta) => {
          const encontrado = respuesta.datos;
          const primeraVariante = encontrado?.variantes.find((variante) => variante.activa);
          this.producto.set(encontrado && productoVisible(encontrado) ? encontrado : undefined);
          this.origen.set(respuesta.origen);
          this.colorSeleccionado.set(primeraVariante?.colorCodigo ?? null);
          this.tallaSeleccionada.set(primeraVariante?.talla ?? null);
        },
        error: (error: unknown) => {
          this.producto.set(undefined);
          this.error.set(mensajeError(error, 'No fue posible consultar el producto.'));
        },
      });
    });
  }

  protected readonly variantes = computed(() =>
    (this.producto()?.variantes ?? []).filter((variante) => variante.activa),
  );

  protected readonly colores = computed(() => [
    ...new Set(this.variantes().map((variante) => variante.colorCodigo)),
  ]);

  protected readonly aviso = computed(() => {
    if (this.sinConexion()) {
      return 'Sin conexión: existencias y precios pueden no estar actualizados.';
    }
    if (this.origen() === 'cache') {
      return 'Sin conexión: se muestran los últimos datos consultados. Existencias y precios pueden no estar actualizados.';
    }
    if (this.origen() === 'demostracion') {
      return 'Detalle de demostración: Flask no respondió. Precios, existencias y fechas son ejemplos.';
    }
    return '';
  });

  protected readonly miniaturas = computed(() =>
    this.colores().map((color) => ({
      color,
      nombre: COLORES_CATALOGO[color].nombre,
      imagen: this.variantes().find((variante) => variante.colorCodigo === color)?.imagen ?? '',
    })),
  );

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

  protected readonly guiaMedidasTexto = computed(() => this.producto()?.guiaMedidasTexto ?? '');

  protected readonly compraBloqueada = computed(() => {
    const variante = this.varianteSeleccionada();
    return !variante || !variante.comprable || this.estado() === 'Agotado';
  });

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
    color: CodigoColorCatalogo | null,
    talla: CodigoTallaCatalogo,
  ): VarianteCatalogo | undefined {
    return this.variantes().find(
      (variante) => variante.colorCodigo === color && variante.talla === talla,
    );
  }

  protected imagenMiniatura(color: CodigoColorCatalogo): string {
    if (this.miniaturasSinImagen().includes(color)) return '';
    return this.miniaturas().find((miniatura) => miniatura.color === color)?.imagen ?? '';
  }

  protected marcarMiniaturaSinImagen(color: CodigoColorCatalogo): void {
    this.miniaturasSinImagen.update((lista) =>
      lista.includes(color) ? lista : [...lista, color],
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
    this.cantidad.update((cantidad) => Math.min(MAX_PIEZAS_POR_LINEA, cantidad + 1));
  }

  protected cambiarCantidad(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    const entero = Number.isFinite(valor) ? Math.trunc(valor) : 1;
    this.cantidad.set(Math.min(MAX_PIEZAS_POR_LINEA, Math.max(1, entero)));
  }

  /** Entrega variante (SKU) y cantidad a M04; no reserva existencias (§5 y §7). */
  protected agregarAlCarrito(): void {
    const producto = this.producto();
    const variante = this.varianteSeleccionada();
    if (!producto || !variante) {
      return;
    }

    const estado = estadoDisponibilidad(variante);
    if (!variante.comprable || estado === 'Agotado') {
      this.mensaje.set('Esta variante no está disponible. Elige otra talla o color.');
      return;
    }

    // Un invitado puede llevar la muestra al carrito de su navegador; una cuenta
    // con sesión solo puede agregar prendas confirmadas por Flask.
    if (this.origen() !== 'servidor' && this.sesion.autenticado()) {
      this.mensaje.set(
        'Los datos son de demostración y Flask no respondió. No se guardó ningún producto en tu carrito.',
      );
      return;
    }

    this.carrito
      .agregar({
        idLinea: String(variante.id),
        varianteId: variante.id,
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
      })
      .subscribe({
        next: () => void this.router.navigate(['/carrito']),
        error: (error: unknown) => this.mensaje.set(mensajeError(error, 'No fue posible agregar al carrito.')),
      });
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
