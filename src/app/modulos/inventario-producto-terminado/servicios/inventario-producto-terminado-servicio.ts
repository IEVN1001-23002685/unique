import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, concatMap, forkJoin, from, map, of, tap } from 'rxjs';
import { ApiService, ValorParametro } from '../../../core/api/api.service';
import { ProductosServicio } from '../../productos/servicios/productos-servicio';
import type {
  AlertaInventarioProducto,
  DatosAjuste,
  FilaExistencia,
  FilaInventario,
  MovimientoProducto,
  ReglaReposicion,
  ResultadoAjuste,
  ResultadoReglas,
  ResumenInventario,
  SenalReposicion,
} from '../modelos/inventario-producto-terminado';

interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

interface FilaInventarioApi {
  variante_id: number;
  sku: string;
  producto: string;
  categoria: string;
  talla: string;
  color: string;
  existencia: number;
  reservado: number;
  disponible: number;
  stock_minimo: number;
  cantidad_reposicion: number;
  en_produccion: number;
  dias_cobertura: string | null;
  semaforo: string;
}

interface MovimientoApi {
  id: number;
  variante_id: number;
  sku: string;
  tipo: string;
  delta_existencia: number;
  delta_reservado: number;
  documento_tipo: string;
  documento_id: string;
  motivo: string;
  usuario_id: number | null;
  fecha: string;
}

interface AjusteApi {
  variante_id: number;
  sku: string;
  existencia_anterior: number;
  cantidad_contada: number;
  diferencia: number;
  existencia_actual: number;
  disponible: number;
  semaforo: string;
  alerta_id: number | null;
  orden_produccion_id: number | null;
  orden_produccion_folio: string | null;
}

function listarTodo<T>(
  api: ApiService,
  ruta: string,
  params: Record<string, ValorParametro> = {},
): Observable<T[]> {
  const porPagina = 100;
  const pedir = (pagina: number, previos: T[]): Observable<T[]> =>
    api
      .get<Pagina<T>>(ruta, { params: { ...params, pagina, por_pagina: porPagina } })
      .pipe(
        concatMap((respuesta) => {
          const items = [...previos, ...(respuesta.items ?? [])];
          if (respuesta.items.length === 0 || items.length >= (respuesta.total ?? 0)) {
            return of(items);
          }
          return pedir(pagina + 1, items);
        }),
      );
  return pedir(1, []);
}

/** M12 contra la API: el inventario, el kardex y las reglas los persiste Flask. */
@Injectable({ providedIn: 'root' })
export class InventarioProductoServicio {
  private readonly api = inject(ApiService);
  private readonly catalogo = inject(ProductosServicio);

  private readonly filasLista = signal<FilaInventario[]>([]);
  private readonly movimientosLista = signal<MovimientoProducto[]>([]);
  private readonly alertasLista = signal<AlertaInventarioProducto[]>([]);
  private readonly senalesLista = signal<SenalReposicion[]>([]);
  private correlativoLocal = 1;

  readonly filas = this.filasLista.asReadonly();
  readonly movimientos = this.movimientosLista.asReadonly();
  readonly alertas = this.alertasLista.asReadonly();
  readonly senales = this.senalesLista.asReadonly();
  readonly categorias = this.catalogo.categorias().filter((categoria) => categoria.activa);

  readonly existencias = computed<FilaExistencia[]>(() =>
    this.filasLista().map((fila) => this.conDetalle(fila)),
  );

  readonly indicadores = computed<ResumenInventario>(() => {
    const filas = this.existencias();
    return {
      skus: filas.length,
      existencia: filas.reduce((suma, fila) => suma + fila.existencia, 0),
      reservado: filas.reduce((suma, fila) => suma + fila.reservado, 0),
      disponible: filas.reduce((suma, fila) => suma + fila.disponible, 0),
      enRiesgo: filas.filter((fila) => fila.semaforo !== 'VERDE').length,
      agotados: filas.filter((fila) => fila.semaforo === 'ROJO').length,
      senales: this.senalesLista().length,
    };
  });

  constructor() {
    this.recargar().subscribe();
  }

  /** Carga existencias y kardex desde `/inventario/producto`; no inventa datos locales. */
  recargar(): Observable<void> {
    return forkJoin({
      inventario: listarTodo<FilaInventarioApi>(this.api, '/inventario/producto'),
      movimientos: listarTodo<MovimientoApi>(this.api, '/inventario/producto/movimientos'),
    }).pipe(
      tap(({ inventario, movimientos }) => {
        const variantes = this.catalogo.filasVariantes();
        this.filasLista.set(
          inventario.map((fila) => {
            const variante = variantes.find((item) => item.variante.sku === fila.sku);
            return {
              varianteId: fila.variante_id,
              sku: fila.sku,
              productoId: variante?.productoId ?? 0,
              productoNombre: fila.producto || variante?.productoNombre || '—',
              categoriaId: variante
                ? this.catalogo.obtenerProducto(variante.productoId)?.categoriaId ?? 0
                : 0,
              categoriaNombre: fila.categoria ?? '',
              talla: fila.talla as FilaInventario['talla'],
              color: fila.color as FilaInventario['color'],
              existencia: Number(fila.existencia),
              reservado: Number(fila.reservado),
              stockMinimo: Number(fila.stock_minimo),
              cantidadReposicion: Number(fila.cantidad_reposicion),
              enProduccion: Number(fila.en_produccion ?? 0),
              ventasDiarias30: 0,
              diasCoberturaApi: fila.dias_cobertura === null ? null : Number(fila.dias_cobertura),
            };
          }),
        );
        this.movimientosLista.set(
          movimientos.map((movimiento) => ({
            id: movimiento.id,
            varianteId: movimiento.variante_id,
            sku: movimiento.sku,
            tipo: movimiento.tipo as MovimientoProducto['tipo'],
            deltaExistencia: Number(movimiento.delta_existencia),
            deltaReservado: Number(movimiento.delta_reservado),
            documentoTipo: movimiento.documento_tipo as MovimientoProducto['documentoTipo'],
            documentoId: String(movimiento.documento_id),
            motivo: movimiento.motivo ?? '',
            usuario: movimiento.usuario_id === null ? '—' : `Usuario ${movimiento.usuario_id}`,
            fecha: movimiento.fecha,
          })),
        );
      }),
      map(() => undefined),
    );
  }

  nombreCategoria(id: number): string {
    return this.catalogo.nombreCategoria(id);
  }

  nombreColor(codigo: FilaInventario['color']): string {
    return this.catalogo.nombreColor(codigo);
  }

  nombreTalla(codigo: FilaInventario['talla']): string {
    return this.catalogo.nombreTalla(codigo);
  }

  /** Conteo físico: POST /inventario/producto/ajuste escribe el movimiento AJUSTE en Flask. */
  registrarAjuste(datos: DatosAjuste): Observable<ResultadoAjuste> {
    const fila = this.filasLista().find((item) => item.varianteId === datos.varianteId);
    if (!fila) {
      return of({ ok: false, mensaje: 'Selecciona un SKU válido para registrar el conteo.' });
    }
    if (!Number.isInteger(datos.cantidadContada) || datos.cantidadContada < 0) {
      return of({
        ok: false,
        mensaje: 'La cantidad contada debe ser un entero mayor o igual a cero.',
      });
    }
    if (datos.motivo.trim().length < 4) {
      return of({
        ok: false,
        mensaje: 'El motivo del ajuste es obligatorio (mínimo 4 caracteres).',
      });
    }

    return this.api
      .post<AjusteApi>('/inventario/producto/ajuste', {
        variante_id: datos.varianteId,
        cantidad_contada: datos.cantidadContada,
        diferencia: datos.cantidadContada - fila.existencia,
        motivo: datos.motivo.trim(),
      })
      .pipe(
        tap((respuesta) => this.registrarEfectoLocal(respuesta)),
        concatMap((respuesta) => this.recargar().pipe(map(() => respuesta))),
        map((respuesta) => {
          const senal = this.senalesLista().find((item) => item.sku === respuesta.sku);
          return {
            ok: true,
            mensaje: `Ajuste registrado para ${fila.sku}. ${
              respuesta.orden_produccion_folio
                ? `Orden de reposición ${respuesta.orden_produccion_folio} creada o actualizada por Flask.`
                : 'Sin orden de reposición pendiente.'
            }`,
            ...(senal ? { senal } : {}),
          };
        }),
      );
  }

  /** Actualiza reglas con PATCH por variante; Flask es el dueño de stock y reposición. */
  guardarReglas(cambios: ReglaReposicion[]): Observable<ResultadoReglas> {
    const porId = new Map(this.filasLista().map((fila) => [fila.varianteId, fila]));
    if (
      cambios.length === 0 ||
      new Set(cambios.map((cambio) => cambio.varianteId)).size !== cambios.length
    ) {
      return of({ ok: false, mensaje: 'No hay reglas válidas para guardar.' });
    }
    for (const cambio of cambios) {
      if (!porId.has(cambio.varianteId)) {
        return of({
          ok: false,
          mensaje: 'Una de las reglas corresponde a un SKU que ya no existe.',
        });
      }
      if (!Number.isInteger(cambio.stockMinimo) || cambio.stockMinimo < 0) {
        return of({ ok: false, mensaje: 'El stock mínimo debe ser un entero mayor o igual a cero.' });
      }
      if (!Number.isInteger(cambio.cantidadReposicion) || cambio.cantidadReposicion < 1) {
        return of({
          ok: false,
          mensaje: 'La cantidad de reposición debe ser un entero mayor a cero.',
        });
      }
    }

    return from(cambios).pipe(
      concatMap((cambio) =>
        this.api.patch(`/inventario/producto/${cambio.varianteId}/reglas`, {
          stock_minimo: cambio.stockMinimo,
          cantidad_reposicion: cambio.cantidadReposicion,
        }),
      ),
      concatMap(() => this.recargar()),
      map(() => ({ ok: true, mensaje: 'Reglas actualizadas en Flask.' })),
    );
  }

  private registrarEfectoLocal(respuesta: AjusteApi): void {
    const alertaId = respuesta.alerta_id;
    if (alertaId !== null) {
      this.alertasLista.update((lista) => [
        {
          id: alertaId,
          fecha: new Date().toISOString(),
          clave: 'PT_STOCK_MINIMO',
          sku: respuesta.sku,
          mensaje: `Flask abrió la alerta PT_STOCK_MINIMO. Disponible ${respuesta.disponible}, semáforo ${respuesta.semaforo}.`,
          severidad: 'PREVENTIVA',
        },
        ...lista.filter((alerta) => alerta.id !== alertaId),
      ]);
    }
    if (respuesta.orden_produccion_id !== null) {
      this.senalesLista.update((lista) => [
        ...lista.filter((senal) => senal.sku !== respuesta.sku),
        {
          id: this.correlativoLocal++,
          fecha: new Date().toISOString(),
          sku: respuesta.sku,
          cantidad: Math.abs(respuesta.diferencia),
          origen: 'STOCK_MINIMO',
          estado: 'PENDIENTE_M16',
        },
      ]);
    }
  }

  private conDetalle(fila: FilaInventario): FilaExistencia {
    const disponible = Math.max(0, fila.existencia - fila.reservado);
    const semaforo =
      fila.diasCoberturaApi !== undefined && fila.diasCoberturaApi !== null
        ? (this.semaforoDeApi(fila, disponible) as FilaExistencia['semaforo'])
        : disponible === 0
          ? 'ROJO'
          : disponible <= fila.stockMinimo
            ? 'AMBAR'
            : 'VERDE';
    const diasCobertura =
      fila.diasCoberturaApi !== undefined
        ? fila.diasCoberturaApi
        : fila.ventasDiarias30 > 0
          ? Math.round((disponible / fila.ventasDiarias30) * 10) / 10
          : null;
    return { ...fila, disponible, semaforo, diasCobertura };
  }

  private semaforoDeApi(fila: FilaInventario, disponible: number): string {
    if (fila.diasCoberturaApi === null || disponible === 0) {
      return 'ROJO';
    }
    return disponible <= fila.stockMinimo ? 'AMBAR' : 'VERDE';
  }
}
