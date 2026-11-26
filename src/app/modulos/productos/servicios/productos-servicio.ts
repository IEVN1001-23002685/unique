import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { ApiService, type ValorParametro } from '../../../core/api/api.service';
import { mensajeError } from '../../../core/api/errores';
import type { IProducto } from '../../../nucleo/modelos/producto';
import { calcularCosteo } from './calculos-producto';
import type {
  CategoriaProducto,
  CodigoColor,
  CodigoTalla,
  DatosCategoria,
  DatosProducto,
  DesgloseCosteo,
  FilaVariante,
  ImagenProducto,
  ParametrosCosteo,
  ProductoMaestro,
  ResultadoCategoria,
  ResultadoProducto,
} from '../modelos/producto-maestro';

const FACTOR_IVA = 1.16;
const POR_PAGINA = 100;

interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

interface DetalleResuelto {
  item: ProductoListaApi;
  producto?: ProductoDetalleApi;
  error?: unknown;
}

interface RespuestaBaja {
  modo?: 'eliminado' | 'desactivado';
}

interface ProductoListaApi {
  id: number;
  codigo_sku: string;
  nombre: string;
  categoria: string;
  precio_venta: string;
  activo: boolean;
  eliminado_en: string | null;
  permite_bajo_pedido: boolean;
  tiene_historial?: boolean | null;
  numero_variantes: number;
  costo_estandar: string | null;
  margen_real: string | null;
}

interface ProductoDetalleApi {
  id: number;
  codigo_sku: string;
  categoria: string;
  categoria_id: number;
  nombre: string;
  descripcion: string;
  composicion_textil: string;
  guia_medidas: string;
  precio_venta: string;
  permite_bajo_pedido: boolean;
  activo: boolean;
  eliminado_en: string | null;
  tiene_historial?: boolean | null;
  variantes: Array<{
    id: number;
    sku: string;
    talla: string;
    color: string;
    activa: boolean;
    existencia: number;
    reservado: number;
    stock_minimo: number;
    cantidad_reposicion: number;
  }>;
  imagenes: Array<{ id: number; color: string | null; url: string; orden: number }>;
  recetas: Array<{ id: number; talla: string; version: number; estado: string; activada_en: string | null }>;
  costo_estandar: string | null;
  margen_real: string | null;
}

interface CategoriaApi {
  id: number;
  nombre: string;
  prefijo_sku: string;
  usa_tallas: boolean;
  activa: boolean;
  descripcion?: string | null;
}

interface CodigoCatalogoApi {
  id: number;
  codigo: string;
  nombre: string;
}

interface MaterialApi {
  id: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad_base: string;
  costo_estandar_base: string;
  merma_estandar_pct: string;
  activo: boolean;
}

interface ColorApi extends CodigoCatalogoApi {
  hex?: string;
  es_comercial?: boolean;
}

function numero(valor: string | number | null | undefined): number {
  const resultado = Number(valor ?? 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

function costeoVacio(): ParametrosCosteo {
  return { lineas: [], manoObra: 0, bordado: 0, indirectos: 0, margenObjetivoPct: 55 };
}

/** M10: productos, variantes, imágenes y catálogos leídos y escritos sólo desde la API. */
@Injectable({ providedIn: 'root' })
export class ProductosServicio {
  private readonly api = inject(ApiService);

  private readonly lista = signal<ProductoMaestro[]>([]);
  private readonly listaCategorias = signal<CategoriaProducto[]>([]);
  private readonly listaColores = signal<{ codigo: CodigoColor; nombre: string }[]>([]);
  private readonly listaTallas = signal<{ codigo: CodigoTalla; nombre: string }[]>([]);
  private readonly listaMateriales = signal<
    Array<{
      id: number;
      codigo: string;
      nombre: string;
      categoria: string;
      unidadBase: string;
      costoBase: number;
      mermaPct: number;
      porPrenda: boolean;
    }>
  >([]);

  readonly productos = computed(() => this.lista());
  readonly categorias = computed(() => this.listaCategorias());
  readonly colores = computed(() => this.listaColores());
  readonly tallas = computed(() => this.listaTallas());
  readonly materiales = computed(() => this.listaMateriales());

  /** Fallos de API visibles en la interfaz; nunca se confunden con catálogos vacíos. */
  readonly errorCarga = signal('');
  readonly errorDetalle = signal('');

  readonly visibles = computed(() =>
    this.lista().filter((producto) => producto.activo && producto.eliminadoEn === null),
  );

  readonly filasVariantes = computed<FilaVariante[]>(() =>
    this.lista().flatMap((producto) =>
      producto.variantes.map((variante) => ({
        productoId: producto.id,
        productoNombre: producto.nombre,
        categoria: this.nombreCategoria(producto.categoriaId),
        variante,
      })),
    ),
  );

  readonly indicadores = computed(() => {
    const productos = this.lista();
    return {
      total: productos.length,
      activos: productos.filter((producto) => producto.activo && producto.eliminadoEn === null)
        .length,
      borradores: productos.filter((producto) => !producto.activo && producto.eliminadoEn === null)
        .length,
      variantes: productos.reduce((suma, producto) => suma + producto.variantes.length, 0),
      categorias: this.listaCategorias().length,
    };
  });

  /** Carga autoritativa de productos y catálogos; ningún dato se inventa en el cliente. */
  recargar(): Observable<void> {
    this.errorCarga.set('');
    this.errorDetalle.set('');
    return forkJoin({
      resumen: this.listarPagina<ProductoListaApi>('/productos'),
      categorias: this.listarPagina<CategoriaApi>('/catalogos/categoria-producto'),
      colores: this.listarPagina<ColorApi>('/catalogos/color'),
      tallas: this.listarPagina<CodigoCatalogoApi>('/catalogos/talla'),
      materiales: this.listarPagina<MaterialApi>('/materiales'),
    }).pipe(
      switchMap(({ resumen, categorias, colores, tallas, materiales }) => {
        this.listaCategorias.set(
          categorias.map((categoria) => ({
            id: categoria.id,
            nombre: categoria.nombre,
            prefijo: categoria.prefijo_sku,
            usaTallas: categoria.usa_tallas,
            activa: categoria.activa,
            descripcion: categoria.descripcion ?? '',
          })),
        );
        this.listaColores.set(
          colores
            .filter((color) => color.codigo !== 'NA')
            .map((color) => ({ codigo: color.codigo as CodigoColor, nombre: color.nombre })),
        );
        this.listaTallas.set(
          tallas.map((talla) => ({ codigo: talla.codigo as CodigoTalla, nombre: talla.nombre })),
        );
        this.listaMateriales.set(
          materiales
            .filter((material) => material.activo)
            .map((material) => ({
              id: material.id,
              codigo: material.codigo,
              nombre: material.nombre,
              categoria: material.categoria,
              unidadBase: material.unidad_base,
              costoBase: numero(material.costo_estandar_base),
              mermaPct: numero(material.merma_estandar_pct),
              porPrenda: material.categoria === 'Empaque',
            })),
        );

        if (resumen.length === 0) {
          this.lista.set([]);
          return of(undefined);
        }
        return forkJoin(
          resumen.map((item) =>
            this.api
              .get<ProductoDetalleApi>(`/productos/${item.id}`)
              .pipe(
                map((producto): DetalleResuelto => ({ item, producto })),
                catchError((error: unknown) => of<DetalleResuelto>({ item, error })),
              ),
          ),
        ).pipe(
          tap((respuestas) => {
            const fallos = respuestas.filter((respuesta) => respuesta.error !== undefined);
            this.lista.set(
              respuestas
                .filter((respuesta) => respuesta.producto !== undefined)
                .map((respuesta) => deDetalleApi(respuesta.producto as ProductoDetalleApi)),
            );
            if (fallos.length > 0) {
              this.errorDetalle.set(
                `No fue posible cargar ${fallos.length} producto(s). ${mensajeError(
                  fallos[0].error,
                  'Revisa la conexión con Flask.',
                )}`,
              );
            }
          }),
          map(() => undefined),
        );
      }),
      catchError((error: unknown) => {
        this.errorCarga.set(
          mensajeError(error, 'No fue posible cargar el catálogo, los catálogos base o los materiales.'),
        );
        this.lista.set([]);
        this.listaCategorias.set([]);
        this.listaColores.set([]);
        this.listaTallas.set([]);
        this.listaMateriales.set([]);
        return of(undefined);
      }),
    );
  }

  obtenerProducto(id: number): ProductoMaestro | undefined {
    return this.lista().find((producto) => producto.id === id);
  }

  categoriaDe(id: number): CategoriaProducto | undefined {
    return this.listaCategorias().find((categoria) => categoria.id === id);
  }

  nombreCategoria(id: number): string {
    return this.categoriaDe(id)?.nombre ?? 'Sin categoría';
  }

  nombreColor(codigo: string): string {
    return this.listaColores().find((color) => color.codigo === codigo)?.nombre ?? codigo;
  }

  nombreTalla(codigo: string): string {
    return this.listaTallas().find((talla) => talla.codigo === codigo)?.nombre ?? codigo;
  }

  tallasPorCategoria(id: number): CodigoTalla[] {
    const categoria = this.categoriaDe(id);
    if (!categoria || !categoria.usaTallas) {
      return ['UN'];
    }
    return this.listaTallas()
      .filter((talla) => talla.codigo !== 'UN')
      .map((talla) => talla.codigo);
  }

  /** Vista previa derivada de los códigos ya devueltos por la API; el SKU real lo genera Flask. */
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

  previsualizarSkus(codigo: string, tallas: string[], colores: string[]): string[] {
    if (codigo === '' || tallas.length === 0 || colores.length === 0) {
      return [];
    }
    return tallas.flatMap((talla) => colores.map((color) => `${codigo}-${talla}-${color}`));
  }

  precioSinIva(precio: number): number {
    return Math.round((precio / FACTOR_IVA) * 100) / 100;
  }

  desglose(producto: ProductoMaestro): DesgloseCosteo {
    return calcularCosteo(producto.costeo);
  }

  margenReal(precio: number, costo: number | null): number | null {
    if (costo === null || precio <= 0) {
      return null;
    }
    const base = precio / FACTOR_IVA;
    return Math.round(((base - costo) / base) * 1000) / 10;
  }

  validarActivacion(producto: ProductoMaestro): string[] {
    const razones: string[] = [];
    if (producto.imagenes.length === 0) {
      razones.push('Agrega al menos una imagen.');
    }
    const faltantes = producto.tallas.filter((talla) => !producto.recetasVigentes.includes(talla));
    if (faltantes.length > 0) {
      razones.push(
        `Falta receta VIGENTE (M11) para ${faltantes.map((talla) => this.nombreTalla(talla)).join(', ')}.`,
      );
    }
    return razones;
  }

  guardarProducto(datos: DatosProducto, id?: number): Observable<ResultadoProducto> {
    const precio = datos.precioVenta ?? calcularCosteo(datos.costeo).precioConIva;
    const imagenesPorColor = Object.fromEntries(
      Object.entries(datos.imagenesPorColor).filter(([, url]) => url !== ''),
    );
    const comun = {
      nombre: datos.nombre.trim(),
      descripcion: datos.descripcion.trim(),
      composicion_textil: datos.composicionTextil.trim(),
      guia_medidas: datos.guiaMedidas.trim(),
      precio_venta: precio.toFixed(2),
      permite_bajo_pedido: datos.permiteBajoPedido,
      colores: datos.colores,
      tallas: datos.tallas,
      imagen_general: datos.imagenGeneral,
      imagenes_por_color: imagenesPorColor,
    };
    const catalogo = {
      categoria_id: datos.categoriaId,
      stock_minimo: datos.stockMinimo,
      cantidad_reposicion: datos.cantidadReposicion,
    };
    const peticion =
      id === undefined
        ? this.api.post<ProductoDetalleApi>('/productos', { ...comun, ...catalogo })
        : this.api.patch<ProductoDetalleApi>(`/productos/${id}`, { ...comun, ...catalogo });

    return peticion.pipe(
      switchMap((respuesta) =>
        this.recargar().pipe(
          map(() => {
            const base =
              id === undefined
                ? `Producto ${respuesta.nombre} creado con ${respuesta.variantes.length} variante(s); SKU generado por Flask.`
                : `Producto ${respuesta.nombre} actualizado; precio y disponibilidad recalculados por Flask.`;
            const recarga = this.errorCarga() || this.errorDetalle();
            return {
              ok: true,
              productoId: respuesta.id,
              mensaje: recarga
                ? `${base} La operación se envió, pero la recarga mostró un aviso; usa «Reintentar».`
                : base,
            };
          }),
        ),
      ),
    );
  }

  /** Activar usa su endpoint dedicado; la baja se gestiona con `eliminarProducto`. */
  activarProducto(id: number): Observable<ResultadoProducto> {
    return this.api.post<ProductoDetalleApi>(`/productos/${id}/activar`, {}).pipe(
      switchMap(() =>
        this.recargar().pipe(
          map(() => ({
            ok: true,
            mensaje: 'Producto activado. M03 lo publicará con las variantes vigentes.',
          })),
        ),
      ),
    );
  }

  alternarVariante(idProducto: number, idVariante: number): Observable<ResultadoProducto> {
    const variante = this.obtenerProducto(idProducto)?.variantes.find((item) => item.id === idVariante);
    if (!variante) {
      return of({ ok: false, mensaje: 'No encontramos la variante solicitada.' });
    }
    return this.api
      .patch<{ sku: string; activa: boolean }>(`/variantes/${idVariante}`, {
        activa: !variante.activa,
      })
      .pipe(
        switchMap((respuesta) =>
          this.recargar().pipe(
            map(() => ({
              ok: true,
              mensaje: `${respuesta.sku}: variante ${respuesta.activa ? 'activada' : 'desactivada'} en Flask.`,
            })),
          ),
        ),
      );
  }

  eliminarProducto(id: number): Observable<ResultadoProducto> {
    const producto = this.obtenerProducto(id);
    return this.api.delete<RespuestaBaja>(`/productos/${id}`).pipe(
      switchMap((respuesta) =>
        this.recargar().pipe(
          map(() => {
            const modo =
              respuesta?.modo ??
              (producto?.tieneHistorial === true
                ? ('desactivado' as const)
                : producto?.tieneHistorial === false
                  ? ('eliminado' as const)
                  : undefined);
            const mensaje =
              modo === 'desactivado'
                ? 'Producto desactivado con borrado lógico; su historial se conserva.'
                : modo === 'eliminado'
                  ? 'Producto eliminado por Flask al no tener ventas ni movimientos.'
                  : 'Flask procesó la baja; consulta el estatus resultante en el catálogo.';
            return { ok: true, modo, mensaje };
          }),
        ),
      ),
    );
  }

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

  existePrefijo(prefijo: string, excluirId?: number): boolean {
    const normalizado = prefijo.trim().toUpperCase();
    return this.listaCategorias().some(
      (categoria) =>
        categoria.id !== excluirId && categoria.prefijo.toUpperCase() === normalizado,
    );
  }

  existeNombreCategoria(nombre: string, excluirId?: number): boolean {
    const normalizado = nombre.trim().toLocaleLowerCase('es-MX');
    return this.listaCategorias().some(
      (categoria) =>
        categoria.id !== excluirId &&
        categoria.nombre.trim().toLocaleLowerCase('es-MX') === normalizado,
    );
  }

  guardarCategoria(datos: DatosCategoria, id?: number): Observable<ResultadoCategoria> {
    const nombre = datos.nombre.trim();
    const prefijo = datos.prefijo.trim().toUpperCase();
    if (nombre.length < 3) {
      return of({ ok: false, mensaje: 'El nombre de la categoría debe tener al menos 3 caracteres.' });
    }
    if (!/^[A-Z]{2}$/.test(prefijo)) {
      return of({ ok: false, mensaje: 'El prefijo debe tener exactamente dos letras, por ejemplo SD.' });
    }
    if (this.existeNombreCategoria(nombre, id) || this.existePrefijo(prefijo, id)) {
      return of({ ok: false, mensaje: 'Ya existe una categoría con ese nombre o prefijo.' });
    }

    const cuerpo = {
      nombre,
      usa_tallas: datos.usaTallas,
      activa: datos.activa,
      descripcion: datos.descripcion.trim(),
      ...(id === undefined ? { prefijo_sku: prefijo } : {}),
    };
    const peticion =
      id === undefined
        ? this.api.post<CategoriaApi>('/catalogos/categoria-producto', cuerpo)
        : this.api.patch<CategoriaApi>(`/catalogos/categoria-producto/${id}`, cuerpo);
    return peticion.pipe(
      switchMap((respuesta) =>
        this.recargar().pipe(
          map(() => ({
            ok: true,
            categoriaId: respuesta.id,
            mensaje: `Categoría ${respuesta.nombre} guardada en Flask. Los SKU existentes no se modifican.`,
          })),
        ),
      ),
    );
  }

  alternarCategoria(id: number): Observable<ResultadoCategoria> {
    const categoria = this.categoriaDe(id);
    if (!categoria) {
      return of({ ok: false, mensaje: 'No encontramos la categoría solicitada.' });
    }
    return this.api
      .patch<CategoriaApi>(`/catalogos/categoria-producto/${id}`, { activa: !categoria.activa })
      .pipe(
        switchMap((respuesta) =>
          this.recargar().pipe(
            map(() => ({
              ok: true,
              mensaje: `Categoría ${respuesta.nombre} ${respuesta.activa ? 'activada' : 'desactivada'} en Flask.`,
            })),
          ),
        ),
      );
  }

  private listarPagina<T>(
    path: string,
    params: Record<string, ValorParametro> = {},
    pagina = 1,
    acumulado: T[] = [],
  ): Observable<T[]> {
    return this.api
      .get<Pagina<T>>(path, { params: { ...params, pagina, por_pagina: POR_PAGINA } })
      .pipe(
        switchMap((respuesta) => {
          const items = [...acumulado, ...respuesta.items];
          return items.length < respuesta.total
            ? this.listarPagina(path, params, pagina + 1, items)
            : of(items);
        }),
      );
  }
}

function deDetalleApi(item: ProductoDetalleApi): ProductoMaestro {
  const imagenes: ImagenProducto[] = item.imagenes.map((imagen) => ({
    color: (imagen.color ?? null) as CodigoColor | null,
    url: imagen.url,
    orden: imagen.orden,
  }));
  const tallas = Array.from(
    new Set(item.variantes.map((variante) => variante.talla as CodigoTalla)),
  );
  const colores = Array.from(
    new Set(item.variantes.map((variante) => variante.color as CodigoColor)),
  );
  return {
    id: item.id,
    slug: item.nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    nombre: item.nombre,
    codigoSku: item.codigo_sku,
    categoriaId: item.categoria_id,
    descripcion: item.descripcion,
    composicionTextil: item.composicion_textil,
    guiaMedidas: item.guia_medidas,
    precioVenta: numero(item.precio_venta),
    permiteBajoPedido: item.permite_bajo_pedido,
    activo: item.activo,
    eliminadoEn: item.eliminado_en,
    imagenes,
    tallas,
    colores,
    variantes: item.variantes.map((variante) => ({
      id: variante.id,
      sku: variante.sku,
      talla: variante.talla as CodigoTalla,
      color: variante.color as CodigoColor,
      activa: variante.activa,
      existencia: variante.existencia,
      reservado: variante.reservado,
      stockMinimo: variante.stock_minimo,
      cantidadReposicion: variante.cantidad_reposicion,
    })),
    costeo: costeoVacio(),
    costoEstandar: item.costo_estandar === null ? null : numero(item.costo_estandar),
    recetasVigentes: item.recetas
      .filter((receta) => receta.estado === 'VIGENTE')
      .map((receta) => receta.talla as CodigoTalla),
    tieneHistorial: item.tiene_historial ?? null,
    bitacora: [],
  };
}
