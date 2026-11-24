import { Injectable, computed, signal } from '@angular/core';
import type { CodigoTalla, ProductoMaestro } from '../../productos/modelos/producto-maestro';
import { PRODUCTOS_MAESTRO_SIMULADOS } from '../../productos/datos-simulados/productos-maestro';
import {
  DISENOS_BORDADO,
  EMPAQUE_POR_PRENDA,
  INVENTARIO_MATERIAL_DEMO,
  MATERIALES,
  RECETAS_SIMULADAS,
} from '../datos-simulados/recetas';
import type {
  DatosDiseno,
  DatosReceta,
  DisenoBordado,
  FilaHistorial,
  LineaReceta,
  MaterialCatalogo,
  Receta,
  ResultadoM11,
} from '../modelos/receta';
import { cantidadBruta, costear, margenReal, prendasPosibles, redondear } from './calculos-receta';

/**
 * Estado de M11 en memoria. Sustituir por HttpClient cuando Flask esté disponible.
 * Lee el catálogo de materiales y la instantánea de productos como contratos de
 * solo lectura: M15 es dueño del inventario y M10 del precio de venta.
 */
@Injectable({
  providedIn: 'root',
})
export class RecetasServicio {
  private readonly lista = signal<Receta[]>(structuredClone(RECETAS_SIMULADAS));
  private readonly disenosLista = signal<DisenoBordado[]>(structuredClone(DISENOS_BORDADO));

  readonly recetas = this.lista.asReadonly();
  readonly disenos = this.disenosLista.asReadonly();
  readonly materiales = MATERIALES;
  readonly inventario = INVENTARIO_MATERIAL_DEMO;
  readonly empaquePorPrenda = EMPAQUE_POR_PRENDA;

  /** Productos de M10 como instantánea de solo lectura (nombre, tallas y precio). */
  private readonly catalogo: readonly ProductoMaestro[] = PRODUCTOS_MAESTRO_SIMULADOS;

  readonly productos = this.catalogo.map((producto) => ({
    id: producto.id,
    nombre: producto.nombre,
  }));

  readonly totales = computed(() => {
    const recetas = this.lista();
    return {
      total: recetas.length,
      vigentes: recetas.filter((receta) => receta.estado === 'VIGENTE').length,
      borradores: recetas.filter((receta) => receta.estado === 'BORRADOR').length,
      archivadas: recetas.filter((receta) => receta.estado === 'ARCHIVADA').length,
      disenos: this.disenosLista().length,
    };
  });

  private readonly porCodigo = new Map(MATERIALES.map((material) => [material.codigo, material]));

  materialDe(codigo: string): MaterialCatalogo | undefined {
    return this.porCodigo.get(codigo);
  }

  nombreMaterial(codigo: string): string {
    return this.porCodigo.get(codigo)?.nombre ?? codigo;
  }

  productoDe(id: number): ProductoMaestro | undefined {
    return this.catalogo.find((producto) => producto.id === id);
  }

  nombreProducto(id: number): string {
    return this.productoDe(id)?.nombre ?? 'Producto sin identificar';
  }

  precioVigente(id: number): number {
    return this.productoDe(id)?.precioVenta ?? 0;
  }

  recetaDe(id: number): Receta | undefined {
    return this.lista().find((receta) => receta.id === id);
  }

  disenoDe(id: number): DisenoBordado | undefined {
    return this.disenosLista().find((diseno) => diseno.id === id);
  }

  nombreDiseno(id: number): string {
    const diseno = this.disenoDe(id);
    return diseno ? `${diseno.codigo} · ${diseno.nombre}` : 'Diseño sin identificar';
  }

  tallasDeProducto(id: number): CodigoTalla[] {
    return this.productoDe(id)?.tallas ?? [];
  }

  recetasDeProducto(productoId: number, talla?: CodigoTalla): Receta[] {
    return this.lista()
      .filter(
        (receta) =>
          receta.productoId === productoId && (talla === undefined || receta.talla === talla),
      )
      .sort((a, b) => b.version - a.version);
  }

  vigenteDe(productoId: number, talla: CodigoTalla): Receta | undefined {
    return this.lista().find(
      (receta) =>
        receta.productoId === productoId && receta.talla === talla && receta.estado === 'VIGENTE',
    );
  }

  /** Tallas con receta VIGENTE; M10 lo consulta para decidir si puede activar el producto. */
  tallasVigentesDe(productoId: number): CodigoTalla[] {
    return this.lista()
      .filter((receta) => receta.productoId === productoId && receta.estado === 'VIGENTE')
      .map((receta) => receta.talla);
  }

  /** Para sugerir precio se usa la talla de mayor costo (§7.5). */
  costoEstandarDe(productoId: number): number | null {
    const vigentes = this.lista().filter(
      (receta) => receta.productoId === productoId && receta.estado === 'VIGENTE',
    );
    if (vigentes.length === 0) {
      return null;
    }
    return Math.max(...vigentes.map((receta) => this.costeo(receta).costoEstandar));
  }

  costeo(receta: Receta) {
    return costear(receta, MATERIALES, EMPAQUE_POR_PRENDA, this.disenosLista());
  }

  margenDe(precio: number, receta: Receta): number | null {
    return margenReal(precio, this.costeo(receta).costoEstandar);
  }

  alcanzaPara(receta: Receta): number | null {
    return prendasPosibles(receta, INVENTARIO_MATERIAL_DEMO);
  }

  /** Diseños PENDIENTE enlazados: producir no se bloquea, pero genera alerta informativa. */
  disenosPendientes(receta: Receta): string[] {
    return receta.bordados
      .map((bordado) => this.disenoDe(bordado.disenoId))
      .filter(
        (diseno): diseno is DisenoBordado => diseno !== undefined && diseno.estado === 'PENDIENTE',
      )
      .map((diseno) => diseno.codigo);
  }

  /** Etiquetas precargadas según §11.4; la talla no aplica a gorro ni bolsa. */
  etiquetasEsperadas(productoId: number, talla: CodigoTalla): string[] {
    const producto = this.productoDe(productoId);
    const conTalla = producto?.tallas.includes('UN') === false;
    const composicion: Record<number, string> = {
      1: 'ETQ-COM-SD',
      2: 'ETQ-COM-PL',
      3: 'ETQ-COM-PN',
      4: 'ETQ-COM-GO',
      5: 'ETQ-COM-BO',
    };
    return [
      'ETQ-MAR',
      ...(conTalla ? [`ETQ-TAL-${talla}`] : []),
      composicion[productoId] ?? 'ETQ-COM-SD',
    ];
  }

  validarActivacion(receta: Receta): string[] {
    const razones: string[] = [];
    const Codigos = receta.lineas.map((linea) => linea.materialCodigo);
    const esTejido = receta.lineas.some((linea) => {
      const material = this.materialDe(linea.materialCodigo);
      return material?.categoria === 'Tela' || linea.materialCodigo === 'HIL-EST';
    });

    if (!esTejido) {
      razones.push('Falta una línea de tela o de hilo de tejido.');
    }
    if (!Codigos.includes('HIL-COS')) {
      razones.push('Falta una línea de hilo de costura (HIL-COS).');
    }

    const esperadas = this.etiquetasEsperadas(receta.productoId, receta.talla);
    const faltantes = esperadas.filter((codigo) => !Codigos.includes(codigo));
    if (faltantes.length > 0) {
      razones.push(`Faltan etiquetas: ${faltantes.join(', ')}.`);
    }

    const mermasInvalidas = receta.lineas.filter(
      (linea) => !Number.isFinite(linea.mermaPct) || linea.mermaPct < 0 || linea.mermaPct >= 100,
    );
    if (mermasInvalidas.length > 0) {
      razones.push('La merma debe estar entre 0 % y menos de 100 % en todas las líneas.');
    }

    if (receta.estado === 'ARCHIVADA') {
      razones.push('Una versión archivada no puede activarse; cópiala a un borrador nuevo.');
    }
    return razones;
  }

  guardarBorrador(datos: DatosReceta, id?: number): ResultadoM11 {
    const actual = id === undefined ? undefined : this.recetaDe(id);
    if (id !== undefined && !actual) {
      return { ok: false, mensaje: 'No encontramos la receta que intentas editar.' };
    }
    if (actual?.estado === 'VIGENTE') {
      return {
        ok: false,
        mensaje:
          'Una receta VIGENTE no se edita: usa «Copiar a borrador» para crear una versión nueva.',
      };
    }
    if (actual?.estado === 'ARCHIVADA') {
      return {
        ok: false,
        mensaje: 'Una receta ARCHIVADA no se edita: cópiala a un borrador nuevo.',
      };
    }

    const producto = this.productoDe(datos.productoId);
    if (!producto || !producto.tallas.includes(datos.talla)) {
      return { ok: false, mensaje: 'Selecciona un producto y una talla válidos.' };
    }

    const lineas: LineaReceta[] = datos.lineas.map((linea, indice) => {
      const material = this.materialDe(linea.materialCodigo);
      const factor =
        Number.isFinite(linea.factorConsumo) && linea.factorConsumo > 0 ? linea.factorConsumo : 1;
      const merma = Number.isFinite(linea.mermaPct) ? linea.mermaPct : (material?.mermaPct ?? 0);
      return {
        id: actual?.lineas[indice]?.id ?? this.siguienteLineaId() + indice,
        materialCodigo: linea.materialCodigo,
        cantidadNeta: redondear(linea.cantidadNeta, 6),
        unidadCaptura: linea.unidadCaptura,
        factorConsumo: factor,
        mermaPct: merma,
        cantidadBruta: cantidadBruta(redondear(linea.cantidadNeta, 6), factor, merma),
        esEtiqueta: linea.esEtiqueta,
        nota: linea.nota.trim(),
      };
    });

    if (
      lineas.some((linea) => linea.cantidadNeta < 0 || linea.mermaPct < 0 || linea.mermaPct >= 100)
    ) {
      return {
        ok: false,
        mensaje: 'Revisa las cantidades y mermas: la merma debe ser menor a 100 %.',
      };
    }

    const ahora = new Date().toISOString();
    const receta: Receta = {
      id: actual?.id ?? this.siguienteRecetaId(),
      productoId: datos.productoId,
      talla: datos.talla,
      version: actual?.version ?? this.siguienteVersion(datos.productoId, datos.talla),
      estado: 'BORRADOR',
      origenRecetaId: actual?.origenRecetaId ?? null,
      manoObra: redondear(datos.manoObra),
      costoBordado: redondear(datos.costoBordado),
      costosIndirectos: redondear(datos.costosIndirectos),
      nota: datos.nota.trim(),
      creadaPor: actual?.creadaPor ?? 'Administrador',
      creadaEn: actual?.creadaEn ?? ahora,
      activadaEn: null,
      lineas,
      bordados: datos.bordados.map((bordado, indice) => ({
        id: actual?.bordados[indice]?.id ?? this.siguienteBordadoId() + indice,
        disenoId: bordado.disenoId,
        aplicaciones: Math.max(1, Math.trunc(bordado.aplicaciones)),
        ubicacion: bordado.ubicacion.trim(),
      })),
      bitacora: [
        ...(actual?.bitacora ?? []),
        {
          id: (actual?.bitacora.length ?? 0) + 1,
          fecha: ahora,
          usuario: 'Administrador',
          accion: 'Guardado de borrador',
          detalle: `Versión ${actual?.version ?? this.siguienteVersion(datos.productoId, datos.talla)} guardada con ${lineas.length} línea(s).`,
        },
      ],
    };

    this.lista.update((recetas) =>
      actual
        ? recetas.map((item) => (item.id === receta.id ? receta : item))
        : [...recetas, receta],
    );

    return {
      ok: true,
      recetaId: receta.id,
      mensaje: `Borrador v${receta.version} guardado en memoria. Costo y margen se recalculan sin tocar recetas ya activadas.`,
    };
  }

  copiarReceta(id: number, productoId?: number, talla?: CodigoTalla): ResultadoM11 {
    const original = this.recetaDe(id);
    if (!original) {
      return { ok: false, mensaje: 'No encontramos la receta de origen.' };
    }
    const destinoProducto = productoId ?? original.productoId;
    const destinoTalla = talla ?? original.talla;
    if (!this.productoDe(destinoProducto)?.tallas.includes(destinoTalla)) {
      return { ok: false, mensaje: 'El producto de destino no admite esa talla.' };
    }

    const ahora = new Date().toISOString();
    const copia: Receta = {
      ...structuredClone(original),
      id: this.siguienteRecetaId(),
      productoId: destinoProducto,
      talla: destinoTalla,
      version: this.siguienteVersion(destinoProducto, destinoTalla),
      estado: 'BORRADOR',
      origenRecetaId: original.id,
      creadaEn: ahora,
      activadaEn: null,
      bitacora: [
        ...original.bitacora,
        {
          id: original.bitacora.length + 1,
          fecha: ahora,
          usuario: 'Administrador',
          accion: 'Copia',
          detalle: `Copiada de ${this.nombreProducto(original.productoId)} ${original.talla} v${original.version} a ${this.nombreProducto(destinoProducto)} ${destinoTalla}.`,
        },
      ],
    };

    this.lista.update((recetas) => [...recetas, copia]);
    return {
      ok: true,
      recetaId: copia.id,
      mensaje: `Copia creada como borrador v${copia.version}. Puedes ajustarla antes de activarla.`,
    };
  }

  activarReceta(id: number): ResultadoM11 {
    const receta = this.recetaDe(id);
    if (!receta) {
      return { ok: false, mensaje: 'No encontramos la receta.' };
    }
    const razones = this.validarActivacion(receta);
    if (razones.length > 0) {
      return { ok: false, mensaje: `No se puede activar: ${razones.join(' ')}` };
    }

    const ahora = new Date().toISOString();
    this.lista.update((recetas) =>
      recetas.map((item) => {
        if (
          item.estado === 'VIGENTE' &&
          item.productoId === receta.productoId &&
          item.talla === receta.talla &&
          item.id !== id
        ) {
          return {
            ...item,
            estado: 'ARCHIVADA' as const,
            bitacora: [
              ...item.bitacora,
              {
                id: item.bitacora.length + 1,
                fecha: ahora,
                usuario: 'Administrador',
                accion: 'Archivado automático',
                detalle: `Quedó archivada al activar la versión ${receta.version}. Las órdenes ya creadas conservan su receta.`,
              },
            ],
          };
        }
        if (item.id === id) {
          return {
            ...item,
            estado: 'VIGENTE' as const,
            activadaEn: ahora,
            bitacora: [
              ...item.bitacora,
              {
                id: item.bitacora.length + 1,
                fecha: ahora,
                usuario: 'Administrador',
                accion: 'Activación',
                detalle: `Versión ${item.version} activada. Quedó vigente para ${this.nombreProducto(item.productoId)} ${item.talla}.`,
              },
            ],
          };
        }
        return item;
      }),
    );

    return {
      ok: true,
      mensaje:
        'Versión activada en memoria. La anterior pasó a ARCHIVADA; M10 ya consulta el nuevo costo.',
    };
  }

  archivarReceta(id: number): ResultadoM11 {
    const receta = this.recetaDe(id);
    if (!receta || receta.estado === 'ARCHIVADA') {
      return { ok: false, mensaje: 'La receta ya está archivada o no existe.' };
    }
    const ahora = new Date().toISOString();
    this.lista.update((recetas) =>
      recetas.map((item) =>
        item.id === id
          ? {
              ...item,
              estado: 'ARCHIVADA' as const,
              bitacora: [
                ...item.bitacora,
                {
                  id: item.bitacora.length + 1,
                  fecha: ahora,
                  usuario: 'Administrador',
                  accion: 'Archivado',
                  detalle: `Versión ${item.version} archivada manualmente.`,
                },
              ],
            }
          : item,
      ),
    );
    return {
      ok: true,
      mensaje:
        'Receta archivada. Si era vigente, el producto dejará de cumplir la regla de activación en M10.',
    };
  }

  comparar(idA: number, idB: number): FilaHistorial[] {
    const a = this.recetaDe(idA);
    const b = this.recetaDe(idB);
    if (!a || !b) {
      return [];
    }

    const filas: FilaHistorial[] = [];
    const claves = new Set([
      ...a.lineas.map((l) => l.materialCodigo),
      ...b.lineas.map((l) => l.materialCodigo),
    ]);
    for (const clave of claves) {
      const lineaA = a.lineas.find((linea) => linea.materialCodigo === clave);
      const lineaB = b.lineas.find((linea) => linea.materialCodigo === clave);
      const detalle = (linea: LineaReceta | undefined): string =>
        linea
          ? `${linea.cantidadNeta} ${linea.unidadCaptura} · factor ${linea.factorConsumo} · merma ${linea.mermaPct} % · bruta ${linea.cantidadBruta}`
          : '—';
      filas.push({
        id: filas.length + 1,
        clave,
        descripcion: this.nombreMaterial(clave),
        detalleA: detalle(lineaA),
        detalleB: detalle(lineaB),
        estado: !lineaA
          ? 'NUEVA'
          : !lineaB
            ? 'ELIMINADA'
            : detalle(lineaA) === detalle(lineaB)
              ? 'IGUAL'
              : 'CAMBIO',
      });
    }

    filas.push(
      {
        id: filas.length + 1,
        clave: 'COSTOS',
        descripcion: 'Mano de obra / bordado / indirectos',
        detalleA: `${a.manoObra} / ${a.costoBordado} / ${a.costosIndirectos}`,
        detalleB: `${b.manoObra} / ${b.costoBordado} / ${b.costosIndirectos}`,
        estado:
          a.manoObra === b.manoObra &&
          a.costoBordado === b.costoBordado &&
          a.costosIndirectos === b.costosIndirectos
            ? 'IGUAL'
            : 'CAMBIO',
      },
      {
        id: filas.length + 1,
        clave: 'BORDADOS',
        descripcion: 'Diseños de bordado enlazados',
        detalleA:
          a.bordados
            .map((bordado) => `${this.nombreDiseno(bordado.disenoId)} ×${bordado.aplicaciones}`)
            .join('; ') || '—',
        detalleB:
          b.bordados
            .map((bordado) => `${this.nombreDiseno(bordado.disenoId)} ×${bordado.aplicaciones}`)
            .join('; ') || '—',
        estado:
          a.bordados.length === b.bordados.length &&
          a.bordados.every(
            (bordado, indice) =>
              bordado.disenoId === b.bordados[indice]?.disenoId &&
              bordado.aplicaciones === b.bordados[indice]?.aplicaciones,
          )
            ? 'IGUAL'
            : 'CAMBIO',
      },
    );
    return filas;
  }

  guardarDiseno(datos: DatosDiseno, id?: number): ResultadoM11 {
    const actual = id === undefined ? undefined : this.disenoDe(id);
    if (id !== undefined && !actual) {
      return { ok: false, mensaje: 'No encontramos el diseño.' };
    }
    const nombre = datos.nombre.trim();
    if (nombre.length < 3) {
      return { ok: false, mensaje: 'El nombre del diseño debe tener al menos 3 caracteres.' };
    }
    if (datos.anchoCm <= 0 || datos.altoCm <= 0) {
      return { ok: false, mensaje: 'El ancho y el alto deben ser mayores a cero.' };
    }
    if (datos.hilos.some((hilo) => hilo.metrosPorAplicacion < 0)) {
      return { ok: false, mensaje: 'Los metros por aplicación no pueden ser negativos.' };
    }

    const conHilos = datos.hilos.some((hilo) => hilo.metrosPorAplicacion > 0);
    const diseno: DisenoBordado = {
      id: actual?.id ?? this.siguienteDisenoId(),
      codigo: actual?.codigo ?? this.siguienteCodigoDiseno(),
      nombre,
      anchoCm: redondear(datos.anchoCm, 1),
      altoCm: redondear(datos.altoCm, 1),
      estado: actual?.estado === 'DIGITALIZADO' || conHilos ? 'DIGITALIZADO' : 'PENDIENTE',
      notas: datos.notas.trim(),
      activo: datos.activo,
      hilos: datos.hilos.map((hilo, indice) => ({
        id: actual?.hilos[indice]?.id ?? this.siguienteHiloId() + indice,
        materialCodigo: hilo.materialCodigo,
        metrosPorAplicacion: redondear(hilo.metrosPorAplicacion, 3),
      })),
    };

    this.disenosLista.update((disenos) =>
      actual
        ? disenos.map((item) => (item.id === diseno.id ? diseno : item))
        : [...disenos, diseno],
    );
    return {
      ok: true,
      disenoId: diseno.id,
      mensaje: actual
        ? 'Diseño actualizado en memoria.'
        : `Diseño ${diseno.codigo} creado en estado ${diseno.estado}. Consumo de hilo: ${diseno.hilos.reduce((s, h) => s + h.metrosPorAplicacion, 0)} m por aplicación.`,
    };
  }

  digitalizarDiseno(id: number): ResultadoM11 {
    const diseno = this.disenoDe(id);
    if (!diseno) {
      return { ok: false, mensaje: 'No encontramos el diseño.' };
    }
    if (diseno.hilos.length === 0 || diseno.hilos.every((hilo) => hilo.metrosPorAplicacion <= 0)) {
      return {
        ok: false,
        mensaje: 'Captura al menos un hilo con metros por aplicación antes de digitalizar.',
      };
    }
    this.disenosLista.update((disenos) =>
      disenos.map((item) => (item.id === id ? { ...item, estado: 'DIGITALIZADO' as const } : item)),
    );
    return {
      ok: true,
      mensaje: `${diseno.codigo} marcado como DIGITALIZADO. Las recetas que lo usan dejan de mostrar la alerta y suman el hilo a su materia prima.`,
    };
  }

  eliminarDiseno(id: number): ResultadoM11 {
    const diseno = this.disenoDe(id);
    if (!diseno) {
      return { ok: false, mensaje: 'No encontramos el diseño.' };
    }
    const usado = this.lista().some((receta) =>
      receta.bordados.some((bordado) => bordado.disenoId === id),
    );
    if (usado) {
      return {
        ok: false,
        mensaje: `${diseno.codigo} está enlazado a una receta. No se elimina para conservar el consumo de las órdenes.`,
      };
    }
    this.disenosLista.update((disenos) => disenos.filter((item) => item.id !== id));
    return { ok: true, mensaje: `${diseno.codigo} eliminado de la demostración.` };
  }

  etiquetasHilo(): MaterialCatalogo[] {
    return MATERIALES.filter((material) => material.codigo.startsWith('HIL-BOR-'));
  }

  private siguienteRecetaId(): number {
    return this.lista().reduce((maximo, receta) => Math.max(maximo, receta.id), 0) + 1;
  }

  private siguienteVersion(productoId: number, talla: CodigoTalla): number {
    return (
      this.recetasDeProducto(productoId, talla).reduce(
        (maximo, receta) => Math.max(maximo, receta.version),
        0,
      ) + 1
    );
  }

  private siguienteLineaId(): number {
    return (
      this.lista().reduce(
        (maximo, receta) => Math.max(maximo, ...receta.lineas.map((linea) => linea.id)),
        0,
      ) + 1
    );
  }

  private siguienteBordadoId(): number {
    return (
      this.lista().reduce(
        (maximo, receta) => Math.max(maximo, ...receta.bordados.map((bordado) => bordado.id)),
        0,
      ) + 1
    );
  }

  private siguienteDisenoId(): number {
    return this.disenosLista().reduce((maximo, diseno) => Math.max(maximo, diseno.id), 0) + 1;
  }

  private siguienteCodigoDiseno(): string {
    const usados = new Set(this.disenosLista().map((diseno) => diseno.codigo));
    let consecutivo = 1;
    while (usados.has(`DIS-${String(consecutivo).padStart(3, '0')}`)) {
      consecutivo += 1;
    }
    return `DIS-${String(consecutivo).padStart(3, '0')}`;
  }

  private siguienteHiloId(): number {
    return (
      this.disenosLista().reduce(
        (maximo, diseno) => Math.max(maximo, ...diseno.hilos.map((hilo) => hilo.id)),
        0,
      ) + 1
    );
  }
}
