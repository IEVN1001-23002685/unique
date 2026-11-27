import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, concatMap, forkJoin, from, map, of, tap, catchError } from 'rxjs';
import { ApiService, ValorParametro } from '../../../core/api/api.service';
import { mensajeError } from '../../../core/api/errores';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { PerfilSesionServicio } from '../../../nucleo/servicios/perfil-sesion-servicio';
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
  /** Opcional hasta confirmar el contrato: Flask puede enviar días o ventas diarias. */
  dias_cobertura?: string | number | null;
  ventas_diarias_30?: string | number | null;
  semaforo?: string;
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
  /** Fecha del movimiento AJUSTE devuelta por Flask; no se inventa en el cliente. */
  fecha?: string;
}

function listarTodo<T>(
  api: ApiService,
  ruta: string,
  params: Record<string, ValorParametro> = {},
): Observable<T[]> {
  const porPagina = 100;
  const maxPaginas = 100;
  const pedir = (pagina: number, previos: T[]): Observable<T[]> =>
    api
      .get<Pagina<T>>(ruta, { params: { ...params, pagina, por_pagina: porPagina } })
      .pipe(
        concatMap((respuesta) => {
          const recibidos = respuesta.items ?? [];
          const items = [...previos, ...recibidos];
          // Corte defensivo: si Flask ignora la paginación, no se entra en un bucle.
          if (
            recibidos.length === 0 ||
            items.length >= (respuesta.total ?? 0) ||
            pagina >= maxPaginas
          ) {
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
  private readonly auth = inject(AuthStateService);
  private readonly perfilSesion = inject(PerfilSesionServicio);

  private readonly filasLista = signal<FilaInventario[]>([]);
  private readonly movimientosLista = signal<MovimientoProducto[]>([]);
  private readonly alertasLista = signal<AlertaInventarioProducto[]>([]);
  private readonly senalesLista = signal<SenalReposicion[]>([]);
  private readonly errorCargaInterno = signal('');
  private readonly errorDetalleInterno = signal('');

  readonly filas = this.filasLista.asReadonly();
  readonly movimientos = this.movimientosLista.asReadonly();
  readonly alertas = this.alertasLista.asReadonly();
  readonly senales = this.senalesLista.asReadonly();
  /** Fallos de API visibles: una lista vacía no se confunde con un error de carga. */
  readonly errorCarga = this.errorCargaInterno.asReadonly();
  readonly errorDetalle = this.errorDetalleInterno.asReadonly();
  readonly categorias = computed(() =>
    this.catalogo.categorias().filter((categoria) => categoria.activa),
  );

  /**
   * Manda el rol real de la sesión; las reglas de reposición son exclusivas del
   * Administrador (§3 y §9). Flask comprueba la autoridad definitiva.
   */
  readonly puedeEditarReglas = computed(() =>
    this.auth.puede(['ADMIN']),
  );

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

  /**
   * Carga inventario, kardex y los catálogos de M10 necesarios para mostrar
   * SKU, categoría, talla y color. Ningún dato se inventa en el cliente.
   */
  recargar(): Observable<void> {
    this.errorCargaInterno.set('');
    this.errorDetalleInterno.set('');
    return forkJoin({
      inventario: listarTodo<FilaInventarioApi>(this.api, '/inventario/producto'),
      movimientos: listarTodo<MovimientoApi>(this.api, '/inventario/producto/movimientos'),
      catalogo: this.catalogo.recargar(),
    }).pipe(
      tap(({ inventario, movimientos }) => {
        const variantes = this.catalogo.filasVariantes();
        this.filasLista.set(
          inventario.map((fila) => {
            const variante = variantes.find((item) => item.variante.sku === fila.sku);
            const ventas = Number(fila.ventas_diarias_30 ?? 0);
            const dias = fila.dias_cobertura;
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
              ventasDiarias30: Number.isFinite(ventas) ? ventas : 0,
              diasCoberturaApi: dias === null || dias === undefined ? null : Number(dias),
              semaforoApi:
                fila.semaforo === 'ROJO' || fila.semaforo === 'AMBAR' || fila.semaforo === 'VERDE'
                  ? fila.semaforo
                  : undefined,
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
        const falloCatalogo = this.catalogo.errorCarga() || this.catalogo.errorDetalle();
        if (falloCatalogo) {
          this.errorDetalleInterno.set(
            `El inventario se cargó, pero faltaron catálogos de M10: ${falloCatalogo}`,
          );
        }
      }),
      catchError((error: unknown) => {
        this.errorCargaInterno.set(
          mensajeError(
            error,
            'No fue posible cargar existencias o movimientos desde Flask.',
          ),
        );
        this.filasLista.set([]);
        this.movimientosLista.set([]);
        this.alertasLista.set([]);
        this.senalesLista.set([]);
        return of(undefined);
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
    if (datos.cantidadContada < fila.reservado) {
      return of({
        ok: false,
        mensaje: `La cantidad contada no puede ser menor al reservado (${fila.reservado}); el disponible no puede ser negativo.`,
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
                ? `Flask informó la orden de reposición ${respuesta.orden_produccion_folio}.`
                : 'Flask no informó orden de reposición para este ajuste.'
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
      catchError((error: unknown) =>
        of({
          ok: false,
          mensaje: `No fue posible guardar todas las reglas. Algunas pudieron aplicarse; vuelve a consultar. ${mensajeError(error)}`,
        }),
      ),
    );
  }

  /**
   * Solo proyecta lo que Flask devolvió: los identificadores son los de la
   * respuesta, nunca un consecutivo inventado en el cliente.
   */
  private registrarEfectoLocal(respuesta: AjusteApi): void {
    const alertaId = respuesta.alerta_id;
    if (alertaId !== null && alertaId !== undefined) {
      this.alertasLista.update((lista) => [
        {
          id: alertaId,
          fecha: respuesta.fecha ?? '',
          clave: 'PT_STOCK_MINIMO',
          sku: respuesta.sku,
          mensaje: `Flask informó disponible ${respuesta.disponible ?? '—'} y semáforo ${respuesta.semaforo ?? '—'} tras el ajuste.`,
          severidad: 'PREVENTIVA',
        },
        ...lista.filter((alerta) => alerta.id !== alertaId),
      ]);
    }
    const ordenId = respuesta.orden_produccion_id;
    if (ordenId !== null && ordenId !== undefined) {
      this.senalesLista.update((lista) => [
        ...lista.filter((senal) => senal.sku !== respuesta.sku),
        {
          id: ordenId,
          fecha: respuesta.fecha ?? '',
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
    const semaforo = fila.semaforoApi ?? this.semaforoPorDisponible(disponible, fila.stockMinimo);
    const desdeApi = fila.diasCoberturaApi;
    const diasCobertura =
      desdeApi !== null && desdeApi !== undefined && Number.isFinite(desdeApi)
        ? desdeApi
        : fila.ventasDiarias30 > 0
          ? Math.round((disponible / fila.ventasDiarias30) * 10) / 10
          : null;
    return { ...fila, disponible, semaforo, diasCobertura };
  }

  /** Regla del §7: ROJO en 0, ÁMBAR entre 1 y el mínimo, VERDE por encima. */
  private semaforoPorDisponible(
    disponible: number,
    minimo: number,
  ): FilaExistencia['semaforo'] {
    if (disponible === 0) {
      return 'ROJO';
    }
    return disponible <= minimo ? 'AMBAR' : 'VERDE';
  }
}
