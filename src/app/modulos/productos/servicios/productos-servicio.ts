import { Injectable, computed, inject, signal } from '@angular/core';
import type { IProducto } from '../../../nucleo/modelos/producto';
import { RecetasServicio } from '../../recetas/servicios/recetas-servicio';
import {
  CATEGORIAS_PRODUCTO,
  COLORES_PRODUCTO,
  PRODUCTOS_MAESTRO_SIMULADOS,
  TALLAS_PRODUCTO,
} from '../datos-simulados/productos-maestro';
import type {
  CategoriaProducto,
  CodigoColor,
  CodigoTalla,
  DatosProducto,
  FilaVariante,
  ImagenProducto,
  ProductoMaestro,
  ResultadoProducto,
} from '../modelos/producto-maestro';

const FACTOR_IVA = 1.16;

/**
 * Estado de M10 en memoria. Sustituir por HttpClient cuando Flask esté disponible.
 * Genera los SKU con la regla 6.5 y conserva las fronteras de propiedad: el costo
 * y la existencia se leen (demo), M11 y M12 son los dueños reales.
 */
@Injectable({
  providedIn: 'root',
})
export class ProductosServicio {
  private readonly recetas = inject(RecetasServicio);

  private readonly lista = signal<ProductoMaestro[]>(structuredClone(PRODUCTOS_MAESTRO_SIMULADOS));

  /**
   * M10 conserva la propiedad del producto y del precio. El costo y las tallas con receta vigente
   * se proyectan desde M11; no se copian reglas ni se escriben en este servicio.
   */
  private readonly conCosteo = computed(() =>
    this.lista().map((producto) => ({
      ...producto,
      costoEstandar: this.recetas.costoEstandarDe(producto.id),
      recetasVigentes: this.recetas.tallasVigentesDe(producto.id),
    })),
  );

  readonly productos = this.conCosteo;
  readonly categorias = CATEGORIAS_PRODUCTO;
  readonly colores = COLORES_PRODUCTO;
  readonly tallas = TALLAS_PRODUCTO;

  readonly visibles = computed(() =>
    this.productos().filter((producto) => producto.activo && producto.eliminadoEn === null),
  );

  readonly filasVariantes = computed<FilaVariante[]>(() =>
    this.productos().flatMap((producto) =>
      producto.variantes.map((variante) => ({
        productoId: producto.id,
        productoNombre: producto.nombre,
        categoria: this.nombreCategoria(producto.categoriaId),
        variante,
      })),
    ),
  );

  readonly indicadores = computed(() => {
    const productos = this.productos();
    return {
      total: productos.length,
      activos: productos.filter((producto) => producto.activo && producto.eliminadoEn === null)
        .length,
      borradores: productos.filter((producto) => !producto.activo && producto.eliminadoEn === null)
        .length,
      variantes: productos.reduce((suma, producto) => suma + producto.variantes.length, 0),
    };
  });

  obtenerProducto(id: number): ProductoMaestro | undefined {
    return this.productos().find((producto) => producto.id === id);
  }

  categoriaDe(id: number): CategoriaProducto | undefined {
    return this.categorias.find((categoria) => categoria.id === id);
  }

  nombreCategoria(id: number): string {
    return this.categoriaDe(id)?.nombre ?? 'Sin categoría';
  }

  nombreColor(codigo: CodigoColor): string {
    return this.colores.find((color) => color.codigo === codigo)?.nombre ?? codigo;
  }

  nombreTalla(codigo: CodigoTalla): string {
    return this.tallas.find((talla) => talla.codigo === codigo)?.nombre ?? codigo;
  }

  /** Tallas permitidas por categoría; GO y BO usan únicamente UN. */
  tallasPorCategoria(id: number): CodigoTalla[] {
    const categoria = this.categoriaDe(id);
    if (!categoria || !categoria.usaTallas) {
      return ['UN'];
    }
    return this.tallas.filter((talla) => talla.codigo !== 'UN').map((talla) => talla.codigo);
  }

  /**
   * Código base del SKU. Se consideran también los productos desactivados o
   * dados de baja: si SD existe, el siguiente es SD2, después SD3 (§6.5).
   */
  siguienteCodigoSku(categoriaId: number, excluirId?: number): string {
    const categoria = this.categoriaDe(categoriaId);
    if (!categoria) {
      return '';
    }

    const usados = new Set(
      this.lista()
        .filter((producto) => producto.categoriaId === categoriaId && producto.id !== excluirId)
        .map((producto) => producto.codigoSku),
    );

    if (!usados.has(categoria.prefijo)) {
      return categoria.prefijo;
    }

    let consecutivo = 2;
    while (usados.has(`${categoria.prefijo}${consecutivo}`)) {
      consecutivo += 1;
    }
    return `${categoria.prefijo}${consecutivo}`;
  }

  /** Vista previa de los SKU que se generarían con la combinación indicada. */
  previsualizarSkus(codigo: string, tallas: CodigoTalla[], colores: CodigoColor[]): string[] {
    if (codigo === '' || tallas.length === 0 || colores.length === 0) {
      return [];
    }
    return tallas.flatMap((talla) => colores.map((color) => `${codigo}-${talla}-${color}`));
  }

  precioSinIva(precio: number): number {
    return Math.round((precio / FACTOR_IVA) * 100) / 100;
  }

  /** Margen real (%) según §7 de M11: (precio / 1.16 − costo) ÷ (precio / 1.16). */
  margenReal(precio: number, costo: number | null): number | null {
    if (costo === null || precio <= 0) {
      return null;
    }
    const base = precio / FACTOR_IVA;
    return Math.round(((base - costo) / base) * 1000) / 10;
  }

  /** Razones por las que un producto no puede activarse; vacío significa que sí puede. */
  validarActivacion(producto: ProductoMaestro): string[] {
    const razones: string[] = [];
    if (producto.imagenes.length === 0) {
      razones.push('Agrega al menos una imagen.');
    }
    const vigentes = this.recetas.tallasVigentesDe(producto.id);
    const faltantes = producto.tallas.filter((talla) => !vigentes.includes(talla));
    if (faltantes.length > 0) {
      razones.push(
        `Falta receta VIGENTE (M11) para ${faltantes.map((talla) => this.nombreTalla(talla)).join(', ')}.`,
      );
    }
    return razones;
  }

  guardarProducto(datos: DatosProducto, id?: number): ResultadoProducto {
    const nombre = datos.nombre.trim();
    const categoria = this.categoriaDe(datos.categoriaId);
    const colores = this.colores
      .map((color) => color.codigo)
      .filter((color) => datos.colores.includes(color));
    const tallas = this.tallasPorCategoria(datos.categoriaId).filter((talla) =>
      datos.tallas.includes(talla),
    );

    if (!categoria) {
      return { ok: false, mensaje: 'Selecciona una categoría válida.' };
    }
    if (nombre.length < 3) {
      return { ok: false, mensaje: 'El nombre del producto debe tener al menos 3 caracteres.' };
    }
    if (!Number.isFinite(datos.precioVenta) || datos.precioVenta <= 0) {
      return { ok: false, mensaje: 'El precio de venta debe ser mayor a cero.' };
    }
    if (colores.length === 0 || tallas.length === 0) {
      return { ok: false, mensaje: 'Selecciona al menos un color y una talla.' };
    }

    const actual = id === undefined ? undefined : this.obtenerProducto(id);
    if (id !== undefined && !actual) {
      return { ok: false, mensaje: 'No encontramos el producto que intentas editar.' };
    }

    const codigoSku = actual?.codigoSku ?? this.siguienteCodigoSku(datos.categoriaId);
    const imagenes = this.construirImagenes(datos.imagenGeneral, datos.imagenesPorColor, colores);
    const variantes = this.construirVariantes(
      actual?.variantes ?? [],
      codigoSku,
      tallas,
      colores,
      datos.stockMinimo,
      datos.cantidadReposicion,
    );
    const bitacora = [...(actual?.bitacora ?? [])];
    if (actual && actual.precioVenta !== datos.precioVenta) {
      bitacora.push({
        id: bitacora.reduce((maximo, entrada) => Math.max(maximo, entrada.id), 0) + 1,
        fecha: new Date().toISOString(),
        usuario: 'Administrador',
        campo: 'precio_venta',
        detalle: `De ${this.formatoMoneda(actual.precioVenta)} a ${this.formatoMoneda(datos.precioVenta)}. Las ventas anteriores no se modifican.`,
      });
    }

    const producto: ProductoMaestro = {
      id: actual?.id ?? this.siguienteProductoId(),
      slug: actual?.slug ?? this.slugUnico(nombre),
      nombre,
      codigoSku,
      categoriaId: datos.categoriaId,
      descripcion: datos.descripcion.trim(),
      composicionTextil: datos.composicionTextil.trim(),
      guiaMedidas: datos.guiaMedidas.trim(),
      precioVenta: datos.precioVenta,
      permiteBajoPedido: datos.permiteBajoPedido,
      activo: actual?.activo ?? false,
      eliminadoEn: actual?.eliminadoEn ?? null,
      imagenes,
      tallas,
      colores,
      variantes,
      // Costo y recetas vigentes se derivan de M11; no se guardan copias aquí.
      costoEstandar: null,
      recetasVigentes: [],
      tieneHistorial: actual?.tieneHistorial ?? false,
      bitacora,
    };

    this.lista.update((productos) =>
      actual
        ? productos.map((item) => (item.id === producto.id ? producto : item))
        : [...productos, producto],
    );

    return {
      ok: true,
      productoId: producto.id,
      mensaje: actual
        ? `Producto actualizado en memoria. ${variantes.length} variante(s), ningún SKU existente modificado.`
        : `Producto creado en memoria con ${variantes.length} variante(s) y SKU generados. Queda como borrador hasta activar sus recetas en M11.`,
    };
  }

  cambiarActivo(id: number, activar: boolean): ResultadoProducto {
    const producto = this.obtenerProducto(id);
    if (!producto) {
      return { ok: false, mensaje: 'No encontramos el producto.' };
    }

    if (activar) {
      const razones = this.validarActivacion(producto);
      if (razones.length > 0) {
        return { ok: false, mensaje: `No se puede activar: ${razones.join(' ')}` };
      }
    }

    this.lista.update((productos) =>
      productos.map((item) => (item.id === id ? { ...item, activo: activar } : item)),
    );

    return {
      ok: true,
      mensaje: activar
        ? 'Producto marcado como activo en memoria. M03 lo publicará cuando Flask sincronice el catálogo.'
        : 'Producto desactivado en memoria; dejará de mostrarse en la tienda al integrar M03.',
    };
  }

  /** Desactiva o activa una sola variante, sin afectar a las demás. */
  alternarVariante(idProducto: number, idVariante: number): boolean {
    const producto = this.obtenerProducto(idProducto);
    if (!producto || !producto.variantes.some((variante) => variante.id === idVariante)) {
      return false;
    }

    this.lista.update((productos) =>
      productos.map((item) =>
        item.id === idProducto
          ? {
              ...item,
              variantes: item.variantes.map((variante) =>
                variante.id === idVariante ? { ...variante, activa: !variante.activa } : variante,
              ),
            }
          : item,
      ),
    );
    return true;
  }

  eliminarProducto(id: number): ResultadoProducto {
    const producto = this.obtenerProducto(id);
    if (!producto) {
      return { ok: false, mensaje: 'No encontramos el producto.' };
    }

    if (producto.tieneHistorial) {
      this.lista.update((productos) =>
        productos.map((item) =>
          item.id === id ? { ...item, activo: false, eliminadoEn: new Date().toISOString() } : item,
        ),
      );
      return {
        ok: true,
        modo: 'desactivado',
        mensaje:
          'Producto desactivado con borrado lógico: se conservan ventas, recetas y movimientos.',
      };
    }

    this.lista.update((productos) => productos.filter((item) => item.id !== id));
    return {
      ok: true,
      modo: 'eliminado',
      mensaje: 'Producto eliminado de la demostración al no tener ventas ni movimientos.',
    };
  }

  /** Proyección para M03: solo productos activos, sin costos. */
  productosActivosParaTienda(): IProducto[] {
    return this.visibles().map((producto) => ({
      id: producto.id,
      slug: producto.slug,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      descripcionDetalle: producto.descripcion,
      precio: producto.precioVenta,
      categoria: this.nombreCategoria(producto.categoriaId),
      imagen: producto.imagenes[0]?.url ?? '',
    }));
  }

  private construirImagenes(
    general: string,
    porColor: Partial<Record<CodigoColor, string>>,
    colores: CodigoColor[],
  ): ImagenProducto[] {
    const imagenes: ImagenProducto[] = [];
    if (general !== '') {
      imagenes.push({ color: null, url: general, orden: 1 });
    }
    colores.forEach((color, indice) => {
      const url = porColor[color];
      if (url) {
        imagenes.push({ color, url, orden: indice + 2 });
      }
    });
    return imagenes;
  }

  private construirVariantes(
    existentes: ProductoMaestro['variantes'],
    codigoSku: string,
    tallas: CodigoTalla[],
    colores: CodigoColor[],
    stockMinimo: number,
    cantidadReposicion: number,
  ): ProductoMaestro['variantes'] {
    const variantes = [...existentes];
    let siguienteId = this.siguienteVarianteId();

    for (const talla of tallas) {
      for (const color of colores) {
        const yaExiste = variantes.some(
          (variante) => variante.talla === talla && variante.color === color,
        );
        if (yaExiste) {
          continue;
        }
        variantes.push({
          id: siguienteId++,
          sku: `${codigoSku}-${talla}-${color}`,
          talla,
          color,
          activa: true,
          existencia: 0,
          reservado: 0,
          stockMinimo,
          cantidadReposicion,
        });
      }
    }
    return variantes;
  }

  private siguienteProductoId(): number {
    return this.lista().reduce((maximo, producto) => Math.max(maximo, producto.id), 0) + 1;
  }

  private siguienteVarianteId(): number {
    return (
      this.lista().reduce(
        (maximo, producto) =>
          Math.max(maximo, ...producto.variantes.map((variante) => variante.id)),
        0,
      ) + 1
    );
  }

  private slugUnico(nombre: string): string {
    const base =
      nombre
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'producto';
    const usados = new Set(this.lista().map((producto) => producto.slug));
    if (!usados.has(base)) {
      return base;
    }
    let consecutivo = 2;
    while (usados.has(`${base}-${consecutivo}`)) {
      consecutivo += 1;
    }
    return `${base}-${consecutivo}`;
  }

  private formatoMoneda(valor: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(valor);
  }
}
