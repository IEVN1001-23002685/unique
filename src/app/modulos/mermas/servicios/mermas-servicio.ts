import { Injectable, computed, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { mensajeError } from '../../../core/api/errores';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { decimalPositivo } from '../../../compartido/validadores/validadores-negocio';
import type { LoteMaterial, Material } from '../../inventario/modelos/inventario';
import { InventarioServicio } from '../../inventario/servicios/inventario-servicio';
import type { FilaVariante } from '../../productos/modelos/producto-maestro';
import { ProductosServicio } from '../../productos/servicios/productos-servicio';
import { ProduccionServicio } from '../../produccion/servicios/produccion-servicio';
import type {
  AlertaMerma,
  CausaMerma,
  DatosNuevaMerma,
  EtapaMerma,
  FilaEvolucion,
  FilaIndicador,
  FiltrosZona,
  IndicadoresMerma,
  Merma,
  MermaVista,
  OpcionLote,
  OpcionMaterial,
  OpcionVariante,
  OrigenMerma,
  ProcedenciaMerma,
  ResultadoAccion,
  ResultadoRegistro,
} from '../modelos/merma';
import {
  ETAPAS_MERMA,
  ETIQUETAS_ETAPA,
  ETIQUETAS_PROCEDENCIA,
  META_MERMA_PCT,
} from '../modelos/merma';

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function redondear4(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10000) / 10000;
}

function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function numero(valor: unknown): number {
  const resultado = Number(valor ?? 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

function mesesDelPeriodo(periodo: string, cantidad: number): string[] {
  const [anioTexto, mesTexto] = periodo.split('-');
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  const resultado: string[] = [];
  for (let indice = cantidad - 1; indice >= 0; indice -= 1) {
    const fecha = new Date(anio, mes - 1 - indice, 1);
    resultado.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`);
  }
  return resultado;
}

function referenciaDeFolio(fecha: string, id: number): string {
  return `MER-${fecha.slice(0, 4) || hoyISO().slice(0, 4)}-${String(id).padStart(4, '0')}`;
}

interface PaginaApi<T> {
  items: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

interface MermaApi {
  id: number;
  origen: OrigenMerma;
  inventario_material_id: number | null;
  lote_id: number | null;
  variante_id: number | null;
  orden_produccion_id: number | null;
  recepcion_linea_id: number | null;
  devolucion_linea_id: number | null;
  reversa_de_id: number | null;
  etapa: EtapaMerma;
  causa_id: number;
  causa_nombre: string | null;
  cantidad: string;
  descripcion: string | null;
  evidencia_url: string | null;
  registrada_por: number | string | null;
  fecha: string | null;
  sku?: string | null;
  material_codigo?: string | null;
  costo_perdido?: string;
}

interface CausaApi {
  id: number;
  nombre: string;
  aplica_a: OrigenMerma | 'AMBOS';
  etapa_sugerida: string | null;
  activa: boolean;
}

interface DetalleIndicadorApi {
  fecha: string;
  etapa: string;
  causa: string;
  producto: string | null;
  material: string | null;
  cantidad: string;
  costo_perdido: string;
  porcentaje_etapa: string;
}

interface IndicadoresApi {
  meta_pct: string;
  merma_producto: string;
  merma_material: string;
  unidades_producidas: string;
  material_consumido: string;
  merma_producto_pct: string;
  merma_material_pct: string;
  costo_perdido: string;
  por_etapa: Record<string, { cantidad: string; costo_perdido: string }>;
  top_causas: { causa: string; cantidad: string }[];
  detalle: DetalleIndicadorApi[];
}

interface IndicadoresVacios {
  metaPct: number;
  periodo: string;
  mermaProductoPct: number;
  mermaMaterialPct: number;
  referenciaProducto: number;
  referenciaMaterial: number;
  cantidadProducto: number;
  cantidadMaterial: number;
  costoPerdido: number;
  costoPerdidoMes: number;
  totalRegistros: number;
  porEtapa: FilaIndicador[];
  porCausa: FilaIndicador[];
  porProducto: FilaIndicador[];
  porMaterial: FilaIndicador[];
  causasTop5: FilaIndicador[];
  evolucion: FilaEvolucion[];
  alertas: AlertaMerma[];
}

/**
 * Estado de M17 alimentado por Flask. GET /mermas y POST /mermas son A,O;
 * el catálogo de causas, los indicadores y el reverso son exclusivos de ADMIN.
 * Nunca se edita un registro: un error se corrige con una nueva fila de reverso.
 */
@Injectable({ providedIn: 'root' })
export class MermasServicio {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStateService);
  private readonly inventario = inject(InventarioServicio);
  private readonly productos = inject(ProductosServicio);
  private readonly produccion = inject(ProduccionServicio);

  private readonly lista = signal<Merma[]>([]);
  private readonly listaCausas = signal<CausaMerma[]>([]);
  private readonly total = signal(0);
  private readonly indicadoresApi = signal<IndicadoresApi | null>(null);
  private readonly reversados = signal<Set<number>>(new Set());

  readonly cargado = signal(false);
  readonly esAdministrador = computed(() => this.auth.puede(['ADMIN']));

  readonly mermas = this.lista.asReadonly();
  readonly causas = this.listaCausas.asReadonly();

  readonly vistas = computed<MermaVista[]>(() => {
    const reversados = this.reversados();
    return [...this.lista()]
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)
      .map((merma) => ({
        ...merma,
        etiquetaItem: this.etiquetaItem(merma),
        etiquetaProcedencia: ETIQUETAS_PROCEDENCIA[merma.procedencia],
        reversada: reversados.has(merma.id),
      }));
  });

  constructor() {
    this.recargar().subscribe({ error: () => this.cargado.set(true) });
  }

  recargar(): Observable<void> {
    const admin = this.esAdministrador();
    return forkJoin({
      pagina: this.listarMermas(),
      causas: admin
        ? this.api
            .get<PaginaApi<CausaApi>>('/catalogos/causa-merma', {
              params: { por_pagina: 100 },
            })
            .pipe(
              catchError(() => of({ items: [] as CausaApi[] })),
              map((respuesta) => respuesta.items.map((causa) => this.adaptarCausa(causa))),
            )
        : of([] as CausaMerma[]),
      indicadores: admin
        ? this.api
            .get<IndicadoresApi>('/mermas/indicadores')
            .pipe(catchError(() => of(null)))
        : of(null),
    }).pipe(
      tap(({ pagina, causas, indicadores }) => {
        const filas = pagina.items.map((fila) => this.adaptarMerma(fila, admin));
        this.lista.set(filas);
        this.total.set(pagina.total);
        this.listaCausas.set(
          causas.length > 0 ? causas : this.causasObservadas(filas),
        );
        this.indicadoresApi.set(indicadores);
      }),
      map(() => undefined),
      tap(() => this.cargado.set(true)),
    );
  }

  private listarMermas(): Observable<PaginaApi<MermaApi>> {
    return this.api
      .get<PaginaApi<MermaApi>>('/mermas', { params: { por_pagina: 100 } })
      .pipe(
        switchMap((primera) => {
          const paginas = Math.ceil(primera.total / 100);
          if (paginas <= 1) {
            return of(primera);
          }
          const restantes = Array.from({ length: paginas - 1 }, (_, indice) =>
            this.api.get<PaginaApi<MermaApi>>('/mermas', {
              params: { pagina: indice + 2, por_pagina: 100 },
            }),
          );
          return forkJoin(restantes).pipe(
            map((respuestas) => ({
              ...primera,
              items: [
                ...primera.items,
                ...respuestas.flatMap((respuesta) => respuesta.items),
              ],
            })),
          );
        }),
      );
  }

  private adaptarCausa(causa: CausaApi): CausaMerma {
    const etapa = ETAPAS_MERMA.find((item) => item === causa.etapa_sugerida) ?? null;
    return {
      id: causa.id,
      nombre: causa.nombre,
      aplicaA: causa.aplica_a,
      etapaSugerida: etapa,
      activa: causa.activa,
    };
  }

  private causasObservadas(filas: Merma[]): CausaMerma[] {
    const vistas = new Map<number, CausaMerma>();
    filas.forEach((merma) => {
      if (!vistas.has(merma.causaId)) {
        vistas.set(merma.causaId, {
          id: merma.causaId,
          nombre: merma.causaNombre,
          aplicaA: 'AMBOS',
          etapaSugerida: merma.etapa,
          activa: true,
        });
      }
    });
    return [...vistas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-MX'));
  }

  private adaptarMerma(datos: MermaApi, incluirCostos: boolean): Merma {
    const fecha = datos.fecha ?? hoyISO();
    const existencia =
      datos.inventario_material_id === null
        ? undefined
        : this.inventario.vistaPorId(datos.inventario_material_id);
    const lote =
      datos.lote_id === null
        ? undefined
        : this.inventario.lotes().find((item) => item.id === datos.lote_id);
    const filaVariante =
      datos.variante_id === null
        ? undefined
        : this.productos
            .filasVariantes()
            .find((item) => item.variante.id === datos.variante_id);
    const orden =
      datos.orden_produccion_id === null
        ? undefined
        : this.produccion.ordenes().find((item) => item.id === datos.orden_produccion_id);
    const procedencia = this.procedencia(datos);
    const registradaPor = this.nombreRegistrador(datos.registrada_por);
    const motivo = datos.descripcion ?? null;

    return {
      id: datos.id,
      folio: referenciaDeFolio(fecha, datos.id),
      origen: datos.origen,
      procedencia,
      automatica: procedencia !== 'MANUAL' && procedencia !== 'REVERSION',
      materialId: datos.inventario_material_id,
      materialCodigo: datos.material_codigo ?? existencia?.material.codigo ?? null,
      materialNombre: existencia?.material.nombre ?? null,
      color:
        datos.origen === 'MATERIAL'
          ? (lote?.color ?? existencia?.color ?? 'NA')
          : filaVariante
            ? this.productos.nombreColor(filaVariante.variante.color)
            : 'NA',
      loteId: datos.lote_id,
      loteFolio: lote?.folio ?? null,
      unidadBase: existencia?.material.unidadBase ?? 'pieza',
      varianteId: datos.variante_id,
      sku: datos.sku ?? filaVariante?.variante.sku ?? null,
      nombreProducto: filaVariante?.productoNombre ?? null,
      talla: filaVariante
        ? this.productos.nombreTalla(filaVariante.variante.talla)
        : null,
      cantidad: datos.reversa_de_id !== null ? -numero(datos.cantidad) : numero(datos.cantidad),
      costoPerdido: incluirCostos ? numero(datos.costo_perdido) : 0,
      etapa: datos.etapa,
      causaId: datos.causa_id,
      causaNombre:
        datos.causa_nombre ??
        this.listaCausas().find((causa) => causa.id === datos.causa_id)?.nombre ??
        `Causa ${datos.causa_id}`,
      ordenFolio: orden?.folio ?? null,
      descripcion: motivo,
      evidenciaNombre: datos.evidencia_url,
      registradaPor,
      fecha,
      esReversion: datos.reversa_de_id !== null,
      reversionDeId: datos.reversa_de_id,
      motivoReversion: datos.reversa_de_id !== null ? motivo : null,
    };
  }

  private procedencia(datos: MermaApi): ProcedenciaMerma {
    if (datos.reversa_de_id !== null) {
      return 'REVERSION';
    }
    if (datos.orden_produccion_id !== null) {
      return 'M16';
    }
    if (datos.recepcion_linea_id !== null) {
      return 'M14';
    }
    if (datos.devolucion_linea_id !== null) {
      return 'M07';
    }
    return 'MANUAL';
  }

  private nombreRegistrador(valor: number | string | null): string {
    if (valor === null || valor === '') {
      return 'Sin usuario';
    }
    const usuario = this.auth.usuario();
    return usuario && String(usuario.id) === String(valor) ? usuario.nombre : `Usuario ${valor}`;
  }

  private etiquetaItem(merma: Merma): string {
    if (merma.origen === 'MATERIAL') {
      return `${merma.materialNombre ?? merma.materialCodigo ?? 'Material'} · ${merma.color ?? 'NA'} · ${merma.loteFolio ?? 'sin lote'}`;
    }
    return `${merma.sku ?? 'SKU'} · ${merma.nombreProducto ?? ''} · ${merma.talla ?? 'UN'}/${merma.color ?? 'NA'}`;
  }

  porId(id: number): MermaVista | undefined {
    return this.vistas().find((merma) => merma.id === id);
  }

  esReversada(id: number): boolean {
    return this.reversados().has(id);
  }

  filtrar(filtros: FiltrosZona): MermaVista[] {
    const texto = filtros.texto.trim().toLocaleLowerCase('es-MX');
    const producto = filtros.producto.trim().toLocaleLowerCase('es-MX');

    return this.vistas().filter((merma) => {
      if (filtros.periodo !== 'TODOS' && !merma.fecha.startsWith(filtros.periodo)) {
        return false;
      }
      if (filtros.etapa !== 'TODAS' && merma.etapa !== filtros.etapa) {
        return false;
      }
      if (filtros.causaId !== 'TODAS' && merma.causaId !== filtros.causaId) {
        return false;
      }
      if (filtros.origen !== 'TODOS' && merma.origen !== filtros.origen) {
        return false;
      }
      if (
        producto !== '' &&
        `${merma.sku ?? ''} ${merma.nombreProducto ?? ''} ${merma.materialCodigo ?? ''} ${merma.materialNombre ?? ''}`
          .toLocaleLowerCase('es-MX')
          .includes(producto) === false
      ) {
        return false;
      }
      if (texto === '') {
        return true;
      }
      return [
        merma.folio,
        merma.etiquetaItem,
        ETIQUETAS_ETAPA[merma.etapa],
        merma.causaNombre,
        merma.ordenFolio ?? '',
        merma.descripcion ?? '',
        merma.etiquetaProcedencia,
      ]
        .join(' ')
        .toLocaleLowerCase('es-MX')
        .includes(texto);
    });
  }

  causasPara(origen: OrigenMerma): CausaMerma[] {
    return this.listaCausas().filter(
      (causa) => causa.activa && (causa.aplicaA === 'AMBOS' || causa.aplicaA === origen),
    );
  }

  opcionesMateriales(): OpcionMaterial[] {
    return this.inventario
      .vistas()
      .filter((existencia) => existencia.activo)
      .map((existencia) => ({
        materialId: existencia.materialId,
        codigo: existencia.material.codigo,
        nombre: existencia.material.nombre,
        color: existencia.color,
        unidadBase: existencia.material.unidadBase,
        etiqueta: `${existencia.material.codigo} · ${existencia.material.nombre} · ${existencia.color} (${existencia.material.unidadBase})`,
      }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es-MX'));
  }

  lotesDe(materialId: number, color?: string): OpcionLote[] {
    return this.inventario
      .lotes()
      .filter(
        (lote) =>
          lote.materialId === materialId &&
          lote.estado === 'DISPONIBLE' &&
          lote.cantidadDisponible > 0 &&
          (color === undefined || color === '' || lote.color === color),
      )
      .sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada))
      .map((lote) => ({
        id: lote.id,
        folio: lote.folio,
        color: lote.color,
        costoUnitario: lote.costoUnitario,
        disponible: lote.cantidadDisponible,
        etiqueta: `${lote.folio} · ${lote.color} · ${lote.fechaEntrada} · ${lote.cantidadDisponible} disponibles`,
      }));
  }

  opcionesVariantes(): OpcionVariante[] {
    return this.productos
      .filasVariantes()
      .filter((fila) => fila.variante.activa)
      .map((fila) => ({
        varianteId: fila.variante.id,
        sku: fila.variante.sku,
        nombreProducto: fila.productoNombre,
        talla: this.productos.nombreTalla(fila.variante.talla),
        color: this.productos.nombreColor(fila.variante.color),
        etiqueta: `${fila.variante.sku} · ${fila.productoNombre} · ${this.productos.nombreTalla(fila.variante.talla)} / ${this.productos.nombreColor(fila.variante.color)}`,
      }))
      .sort((a, b) => a.sku.localeCompare(b.sku, 'es-MX'));
  }

  ordenesDisponibles(): { id: number; folio: string }[] {
    return this.produccion
      .ordenes()
      .map((orden) => ({ id: orden.id, folio: orden.folio }))
      .sort((a, b) => b.folio.localeCompare(a.folio, 'es-MX'));
  }

  /** Costo estimado solo para la vista; el servidor calcula el costo real al registrar. */
  costoEstimado(
    origen: OrigenMerma,
    materialId: number | null,
    loteId: number | null,
    sku: string,
    cantidad: number | null,
  ): number {
    if (!this.esAdministrador() || cantidad === null || !Number.isFinite(cantidad) || cantidad <= 0) {
      return 0;
    }
    if (origen === 'MATERIAL') {
      const lote = loteId === null ? undefined : this.inventario.lotes().find((item) => item.id === loteId);
      if (lote) {
        return redondear2(lote.costoUnitario * cantidad);
      }
      const material = materialId === null ? undefined : this.inventario.obtenerMaterial(materialId);
      return material ? redondear2(material.costoEstandarBase * cantidad) : 0;
    }
    const fila = this.productos.filasVariantes().find((item) => item.variante.sku === sku.trim());
    const costo = fila ? (this.productos.obtenerProducto(fila.productoId)?.costoEstandar ?? 0) : 0;
    return redondear2(costo * cantidad);
  }

  registrar(datos: DatosNuevaMerma): Observable<ResultadoRegistro> {
    const controlCantidad = new FormControl<number | null>(datos.cantidad);
    if (decimalPositivo(controlCantidad) !== null) {
      return of({
        ok: false,
        mensaje: 'La cantidad debe ser mayor que cero y tener hasta 4 decimales.',
      });
    }
    if (datos.origen === 'PRODUCTO' && !Number.isInteger(datos.cantidad)) {
      return of({ ok: false, mensaje: 'Las prendas se registran en unidades enteras.' });
    }

    const causa = this.causasPara(datos.origen).find((item) => item.id === datos.causaId);
    if (!causa) {
      return of({
        ok: false,
        mensaje: this.listaCausas().length === 0
          ? 'El catálogo de causas no está disponible para este perfil; solicita permiso de Administrador.'
          : 'Selecciona una causa vigente que aplique al origen elegido.',
      });
    }

    let material: Material | undefined;
    let lote: LoteMaterial | undefined;
    let variante: FilaVariante | undefined;
    let ordenProduccionId: number | null = null;

    if (datos.origen === 'MATERIAL') {
      if (datos.materialId === null || datos.loteId === null) {
        return of({ ok: false, mensaje: 'Para materiales indica el material, el color y el lote.' });
      }
      material = this.inventario.obtenerMaterial(datos.materialId);
      lote = this.inventario.lotes().find((item) => item.id === datos.loteId);
      if (!material || !lote || lote.materialId !== datos.materialId) {
        return of({ ok: false, mensaje: 'El lote seleccionado no corresponde al material indicado.' });
      }
    } else {
      variante = this.productos
        .filasVariantes()
        .find((item) => item.variante.sku === datos.sku.trim());
      if (!variante) {
        return of({ ok: false, mensaje: 'Selecciona un SKU válido generado por M10.' });
      }
    }

    if (datos.ordenFolio.trim() !== '') {
      const orden = this.produccion.ordenes().find((item) => item.folio === datos.ordenFolio.trim());
      if (!orden) {
        return of({ ok: false, mensaje: 'La orden de producción indicada ya no está disponible.' });
      }
      ordenProduccionId = orden.id;
    }

    const descripcion = datos.descripcion.trim();
    const evidencia = datos.evidenciaNombre?.trim();
    const cuerpo = {
      origen: datos.origen,
      inventario_material_id: material?.id ?? null,
      lote_id: lote?.id ?? null,
      variante_id: variante?.variante.id ?? null,
      orden_produccion_id: ordenProduccionId,
      etapa: datos.etapa,
      causa_id: causa.id,
      cantidad: redondear4(datos.cantidad),
      descripcion:
        evidencia === undefined || evidencia === ''
          ? descripcion || null
          : `${descripcion || 'Merma registrada'} · Evidencia referida: ${evidencia}`,
    };

    return this.api.post<MermaApi>('/mermas', cuerpo).pipe(
      map((respuesta) => {
        const registro = this.adaptarMerma(respuesta, this.esAdministrador());
        this.lista.update((actuales) => [registro, ...actuales.filter((item) => item.id !== registro.id)]);
        const mensaje = `${registro.folio} registrado. La existencia se descontó y el movimiento MERMA quedó registrado en el inventario correspondiente.`;
        return { ok: true as const, folio: registro.folio, mensaje };
      }),
      tap(() => this.recargarIndicadores()),
      catchError((error: unknown) =>
        of({ ok: false as const, mensaje: mensajeError(error, 'No fue posible registrar la merma.') }),
      ),
    );
  }

  /** Corrección permitida solo al Administrador: crea un reverso, nunca edita el original. */
  reversar(id: number, motivo: string): Observable<ResultadoAccion> {
    if (!this.esAdministrador()) {
      return of({ ok: false, mensaje: 'Corregir una merma requiere perfil Administrador.' });
    }
    if (motivo.trim().length < 3) {
      return of({ ok: false, mensaje: 'Indica el motivo de la corrección.' });
    }
    const original = this.lista().find((merma) => merma.id === id);
    if (!original) {
      return of({ ok: false, mensaje: 'No se encontró la merma.' });
    }
    if (this.esReversada(id) || original.esReversion) {
      return of({ ok: false, mensaje: 'Esta merma ya fue corregida con un reverso.' });
    }

    return this.api
      .post<{ merma: MermaApi; reverso: MermaApi }>(`/mermas/${id}/reversar`, {
        motivo: motivo.trim(),
      })
      .pipe(
        map((respuesta) => {
          const reverso = this.adaptarMerma(respuesta.reverso, true);
          this.lista.update((actuales) => [
            reverso,
            ...actuales.filter((item) => item.id !== reverso.id),
          ]);
          this.reversados.update((actuales) => new Set([...actuales, id]));
          return {
            ok: true,
            mensaje: `${reverso.folio} registrado como inverso de ${original.folio}. El original se conserva sin cambios.`,
          };
        }),
        tap(() => this.recargarIndicadores()),
        catchError((error: unknown) =>
          of({ ok: false, mensaje: mensajeError(error, 'No fue posible reversar la merma.') }),
        ),
      );
  }

  private recargarIndicadores(): void {
    if (!this.esAdministrador()) {
      return;
    }
    this.api
      .get<IndicadoresApi>('/mermas/indicadores')
      .pipe(catchError(() => of(null)))
      .subscribe((respuesta) => this.indicadoresApi.set(respuesta));
  }

  indicadores(): IndicadoresMerma {
    const datos = this.indicadoresApi();
    if (!datos) {
      return this.indicadoresVacios();
    }

    const periodo = hoyISO().slice(0, 7);
    const detalle = datos.detalle ?? [];
    const metaPct = numero(datos.meta_pct);
    const productoPct = numero(datos.merma_producto_pct);
    const materialPct = numero(datos.merma_material_pct);
    const cantidadProducto = redondear4(numero(datos.merma_producto));
    const cantidadMaterial = redondear4(numero(datos.merma_material));
    const referenciaProducto = numero(datos.unidades_producidas);
    const referenciaMaterial = numero(datos.material_consumido);
    const costo = numero(datos.costo_perdido);

    const porEtapa: FilaIndicador[] = ETAPAS_MERMA.map((etapa) => {
      const filas = detalle.filter((fila) => fila.etapa === etapa);
      const cantidadPiezas = redondear4(
        filas.reduce((total, fila) => total + (fila.producto ? numero(fila.cantidad) : 0), 0),
      );
      const cantidadM2 = redondear4(
        filas.reduce((total, fila) => total + (fila.material ? numero(fila.cantidad) : 0), 0),
      );
      const referencia = cantidadPiezas > 0 ? referenciaProducto : referenciaMaterial;
      const porcentaje =
        referencia > 0
          ? redondear2((numero(datos.por_etapa[etapa]?.cantidad ?? 0) / referencia) * 100)
          : 0;
      return {
        clave: etapa,
        etiqueta: ETIQUETAS_ETAPA[etapa],
        cantidad: cantidadPiezas,
        cantidadMaterial: cantidadM2,
        costoPerdido: numero(datos.por_etapa[etapa]?.costo_perdido),
        referencia,
        porcentaje,
        base: 'meta' as const,
        superaMeta: porcentaje > metaPct,
        unidad: cantidadPiezas > 0 ? 'piezas' : 'unidad base',
      };
    }).filter((fila) => fila.cantidad !== 0 || fila.cantidadMaterial !== 0);

    const causas = new Map<string, string>();
    this.listaCausas().forEach((causa) => causas.set(causa.nombre, causa.nombre));
    datos.top_causas.forEach((causa) => causas.set(causa.causa, causa.causa));

    const porCausa: FilaIndicador[] = [...new Set(detalle.map((fila) => fila.causa))]
      .map((nombre) => {
        const filas = detalle.filter((fila) => fila.causa === nombre);
        const cantidad = redondear4(
          filas.reduce((total, fila) => total + numero(fila.cantidad), 0),
        );
        return {
          clave: nombre,
          etiqueta: causas.get(nombre) ?? nombre,
          cantidad,
          cantidadMaterial: 0,
          costoPerdido: redondear2(
            filas.reduce((total, fila) => total + numero(fila.costo_perdido), 0),
          ),
          referencia: detalle.length,
          porcentaje: detalle.length > 0 ? redondear2((filas.length / detalle.length) * 100) : 0,
          base: 'participacion' as const,
          superaMeta: false,
          unidad: 'registros',
        };
      })
      .sort((a, b) => b.porcentaje - a.porcentaje);

    const porProducto = this.agruparDetalle(
      detalle.filter((fila) => fila.producto !== null),
      'producto',
      referenciaProducto,
      'piezas',
    );
    const porMaterial = this.agruparDetalle(
      detalle.filter((fila) => fila.material !== null),
      'material',
      referenciaMaterial,
      'unidad base',
    );

    const causasTop5: FilaIndicador[] = datos.top_causas.map((causa) => {
      const filas = detalle.filter((fila) => fila.causa === causa.causa);
      return {
        clave: causa.causa,
        etiqueta: causas.get(causa.causa) ?? causa.causa,
        cantidad: numero(causa.cantidad),
        cantidadMaterial: 0,
        costoPerdido: redondear2(
          filas.reduce((total, fila) => total + numero(fila.costo_perdido), 0),
        ),
        referencia: filas.length,
        porcentaje:
          detalle.length > 0 ? redondear2((filas.length / detalle.length) * 100) : 0,
        base: 'participacion' as const,
        superaMeta: false,
        unidad: 'registros',
      };
    });

    const evolucion: FilaEvolucion[] = mesesDelPeriodo(periodo, 6).map((mes) => {
      const filas = detalle.filter((fila) => fila.fecha.startsWith(mes));
      const fecha = new Date(`${mes}-01T12:00:00`);
      return {
        mes,
        etiqueta: new Intl.DateTimeFormat('es-MX', { month: 'short' })
          .format(fecha)
          .replace('.', ''),
        cantidadProducto: redondear4(
          filas.reduce(
            (total, fila) => total + (fila.producto ? numero(fila.cantidad) : 0),
            0,
          ),
        ),
        cantidadMaterial: redondear4(
          filas.reduce(
            (total, fila) => total + (fila.material ? numero(fila.cantidad) : 0),
            0,
          ),
        ),
        costoPerdido: redondear2(
          filas.reduce((total, fila) => total + numero(fila.costo_perdido), 0),
        ),
      };
    });

    const costoPeriodo = redondear2(
      detalle
        .filter((fila) => fila.fecha.startsWith(periodo))
        .reduce((total, fila) => total + numero(fila.costo_perdido), 0),
    );

    const alertas: AlertaMerma[] = [];
    if (productoPct > metaPct || materialPct > metaPct) {
      alertas.push({
        id: 'general',
        ambito: 'general',
        etiqueta: 'MERMA_ALTA · merma acumulada',
        detalle: `Producto ${productoPct}% y materiales ${materialPct}% contra una meta menor a ${metaPct}%.`,
        porcentaje: Math.max(productoPct, materialPct),
      });
    }
    porEtapa.filter((fila) => fila.superaMeta).forEach((fila) => {
      alertas.push({
        id: `etapa-${fila.clave}`,
        ambito: 'etapa',
        etiqueta: `MERMA_ALTA · etapa ${fila.etiqueta}`,
        detalle: `${fila.cantidad + fila.cantidadMaterial} en merma sobre ${fila.referencia} de referencia (${fila.porcentaje}%).`,
        porcentaje: fila.porcentaje,
      });
    });
    porProducto.filter((fila) => fila.superaMeta).forEach((fila) => {
      alertas.push({
        id: `producto-${fila.clave}`,
        ambito: 'producto',
        etiqueta: `MERMA_ALTA · ${fila.clave}`,
        detalle: `${fila.cantidad} piezas en merma sobre ${fila.referencia} producidas (${fila.porcentaje}%).`,
        porcentaje: fila.porcentaje,
      });
    });

    return {
      metaPct,
      periodo,
      mermaProductoPct: productoPct,
      mermaMaterialPct: materialPct,
      referenciaProducto,
      referenciaMaterial,
      cantidadProducto,
      cantidadMaterial,
      costoPerdido: costo,
      costoPerdidoMes: costoPeriodo,
      totalRegistros: this.total(),
      porEtapa,
      porCausa,
      porProducto,
      porMaterial,
      causasTop5,
      evolucion,
      alertas,
    };
  }

  private agruparDetalle(
    filas: DetalleIndicadorApi[],
    campo: 'producto' | 'material',
    referencia: number,
    unidad: string,
  ): FilaIndicador[] {
    const meta = numero(this.indicadoresApi()?.meta_pct);
    const claves = [...new Set(filas.map((fila) => fila[campo] as string))];
    return claves
      .map((clave) => {
        const delGrupo = filas.filter((fila) => fila[campo] === clave);
        const cantidad = redondear4(
          delGrupo.reduce((total, fila) => total + numero(fila.cantidad), 0),
        );
        const porcentaje = referencia > 0 ? redondear2((cantidad / referencia) * 100) : 0;
        return {
          clave,
          etiqueta: clave,
          cantidad,
          cantidadMaterial: 0,
          costoPerdido: redondear2(
            delGrupo.reduce((total, fila) => total + numero(fila.costo_perdido), 0),
          ),
          referencia,
          porcentaje,
          base: 'meta' as const,
          superaMeta: porcentaje > meta,
          unidad,
        };
      })
      .sort((a, b) => b.cantidad - a.cantidad);
  }

  private indicadoresVacios(): IndicadoresMerma {
    return {
      metaPct: META_MERMA_PCT,
      periodo: hoyISO().slice(0, 7),
      mermaProductoPct: 0,
      mermaMaterialPct: 0,
      referenciaProducto: 0,
      referenciaMaterial: 0,
      cantidadProducto: 0,
      cantidadMaterial: 0,
      costoPerdido: 0,
      costoPerdidoMes: 0,
      totalRegistros: 0,
      porEtapa: [],
      porCausa: [],
      porProducto: [],
      porMaterial: [],
      causasTop5: [],
      evolucion: [],
      alertas: [],
    };
  }
}
