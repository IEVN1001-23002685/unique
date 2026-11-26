import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, concatMap, forkJoin, from, map, of, tap } from 'rxjs';
import { ApiService, ValorParametro } from '../../../core/api/api.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import type { EvaluacionProveedor, MaterialProveedor, Proveedor } from '../modelos/proveedor';

export type ResultadoEliminacion = 'eliminado' | 'desactivado' | 'no-encontrado';

interface Pagina<T> {
  items: T[];
  total: number;
}

interface ProveedorApi {
  id: number;
  razon_social: string;
  nombre_comercial: string;
  rfc: string | null;
  contacto: string;
  telefono: string;
  correo: string;
  direccion: string;
  condiciones_pago: string;
  estatus: string;
  notas: string | null;
  eliminado_en: string | null;
}

interface MaterialProveedorApi {
  id: number;
  proveedor_id: number;
  material_id: number;
  material_codigo: string | null;
  material_nombre: string | null;
  unidad_compra: string | null;
  precio_compra: string;
  minimo_compra: string;
  plazo_dias: number;
  es_principal: boolean;
  vigencia_hasta: string | null;
  activo: boolean;
}

interface EvaluacionApi {
  proveedor_id: number;
  ordenes_recibidas: number;
  entregas_a_tiempo: number;
  porcentaje_a_tiempo: string;
  cantidad_medida: string;
  cantidad_aceptada: string;
  porcentaje_aceptacion: string;
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

/** M13 contra la API: el padrón y su catálogo los persiste Flask. */
@Injectable({ providedIn: 'root' })
export class ProveedoresServicio {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStateService);

  private readonly lista = signal<Proveedor[]>([]);
  private readonly evaluaciones = signal<EvaluacionProveedor[]>([]);

  readonly proveedores = this.lista.asReadonly();
  readonly evaluacionesRegistradas = this.evaluaciones.asReadonly();
  readonly cargado = signal(false);

  /** Líneas activas de proveedores activos/en revisión, agrupadas por material. */
  readonly cobertura = computed<Map<number, MaterialProveedor[]>>(() => {
    const agrupado = new Map<number, MaterialProveedor[]>();
    for (const proveedor of this.lista()) {
      if (proveedor.estatus === 'INACTIVO') {
        continue;
      }
      for (const material of proveedor.materiales) {
        if (!material.activo) {
          continue;
        }
        const lineas = agrupado.get(material.materialId) ?? [];
        lineas.push(material);
        agrupado.set(material.materialId, lineas);
      }
    }
    return agrupado;
  });

  constructor() {
    effect(() => {
      if (this.auth.usuario()?.rol === 'ADMIN') {
        this.recargar().subscribe();
      }
    });
  }

  recargar(): Observable<void> {
    // M13 es de Administrador: un Operativo no debe recibir 403 al abrir M14/M15.
    if (!this.auth.puede(['ADMIN'])) {
      this.lista.set([]);
      this.evaluaciones.set([]);
      this.cargado.set(true);
      return of(undefined);
    }
    return this.api
      .get<{ items: ProveedorApi[] }>('/proveedores', {
        params: { incluir_inactivos: true, por_pagina: 100 },
      })
      .pipe(
        concatMap((respuesta) =>
          forkJoin({
            proveedores: of(respuesta.items ?? []),
            evaluacion: this.api.get<{ items: EvaluacionApi[] }>('/proveedores/evaluacion'),
            materiales: respuesta.items.length === 0
              ? of([] as MaterialProveedorApi[][])
              : forkJoin(
                  respuesta.items.map((proveedor) =>
                    listarTodo<MaterialProveedorApi>(
                      this.api,
                      `/proveedores/${proveedor.id}/materiales`,
                    ),
                  ),
                ),
          }),
        ),
        tap(({ proveedores, evaluacion, materiales }) => {
          const evaluaciones = (evaluacion.items ?? []).map((fila) => this.adaptarEvaluacion(fila));
          this.evaluaciones.set(evaluaciones);
          this.lista.set(
            proveedores.map((fila, indice) => ({
              id: fila.id,
              razonSocial: fila.razon_social,
              nombreComercial: fila.nombre_comercial,
              rfc: fila.rfc,
              contacto: fila.contacto,
              telefono: fila.telefono,
              correo: fila.correo,
              direccion: fila.direccion,
              condicionesPago: fila.condiciones_pago,
              estatus: fila.estatus as Proveedor['estatus'],
              notas: fila.notas,
              tieneOrdenesCompra:
                (evaluaciones.find((item) => item.proveedorId === fila.id)?.ordenesRecibidas ?? 0) >
                0,
              materiales: (materiales[indice] ?? []).map((material) =>
                this.adaptarMaterial(material),
              ),
            })),
          );
        }),
        tap(() => this.cargado.set(true)),
        map(() => undefined),
      );
  }

  obtenerPorId(id: number): Proveedor | undefined {
    return this.lista().find((proveedor) => proveedor.id === id);
  }

  obtenerEvaluacion(id: number): EvaluacionProveedor | undefined {
    return this.evaluaciones().find((evaluacion) => evaluacion.proveedorId === id);
  }

  guardarProveedor(datos: Proveedor): Observable<Proveedor> {
    const cuerpo = {
      razon_social: datos.razonSocial,
      nombre_comercial: datos.nombreComercial,
      rfc: datos.rfc,
      contacto: datos.contacto,
      telefono: datos.telefono,
      correo: datos.correo,
      direccion: datos.direccion,
      condiciones_pago: datos.condicionesPago,
      estatus: datos.estatus === 'INACTIVO' ? 'ACTIVO' : datos.estatus,
      notas: datos.notas,
    };
    const peticion =
      datos.id === 0
        ? this.api.post<ProveedorApi>('/proveedores', cuerpo)
        : this.api.patch<ProveedorApi>(`/proveedores/${datos.id}`, cuerpo);
    return peticion.pipe(
      concatMap((respuesta) => this.recargar().pipe(map(() => respuesta))),
      map((respuesta) => this.obtenerPorId(respuesta.id) as Proveedor),
    );
  }

  /**
   * DELETE es la única operación disponible: Flask decide borrado físico o
   * desactivación lógica según el historial real de órdenes, cotizaciones y lotes.
   */
  eliminarProveedor(id: number): Observable<ResultadoEliminacion> {
    const proveedor = this.obtenerPorId(id);
    if (!proveedor) {
      return of('no-encontrado' as ResultadoEliminacion);
    }
    const modo: ResultadoEliminacion = proveedor.tieneOrdenesCompra
      ? 'desactivado'
      : 'eliminado';
    return this.api.delete(`/proveedores/${id}`).pipe(
      concatMap(() => this.recargar()),
      map(() => modo),
    );
  }

  /** El contrato no tiene reemplazo masivo: aplica altas, cambios y bajas por separado. */
  reemplazarMateriales(proveedorId: number, materiales: MaterialProveedor[]): Observable<void> {
    const anteriores = this.obtenerPorId(proveedorId)?.materiales ?? [];
    const porMaterial = new Map(anteriores.map((linea) => [linea.materialId, linea]));
    const bajas = anteriores.filter(
      (linea) => !materiales.some((nueva) => nueva.materialId === linea.materialId),
    );
    return from(bajas)
      .pipe(
        concatMap((linea) =>
          this.api.delete(`/proveedores/${proveedorId}/materiales/${linea.materialId}`),
        ),
      )
      .pipe(
        concatMap(() =>
          from(materiales).pipe(
            concatMap((linea) => {
              const cuerpo = {
                material_id: linea.materialId,
                precio_compra: Number(linea.precioCompra),
                minimo_compra: Number(linea.minimoCompra),
                plazo_dias: Number(linea.plazoDias),
                es_principal: linea.esPrincipal,
                vigencia_hasta: linea.vigenciaHasta,
                activo: linea.activo,
              };
              const previa = porMaterial.get(linea.materialId);
              return previa
                ? this.api.patch(
                    `/proveedores/${proveedorId}/materiales/${linea.materialId}`,
                    cuerpo,
                  )
                : this.api.post(`/proveedores/${proveedorId}/materiales`, cuerpo);
            }),
          ),
        ),
        concatMap(() => this.recargar()),
        map(() => undefined),
      );
  }

  private adaptarMaterial(fila: MaterialProveedorApi): MaterialProveedor {
    const codigo = fila.material_codigo ?? '';
    return {
      id: fila.id,
      materialId: fila.material_id,
      material: fila.material_nombre ?? codigo,
      categoria: this.categoriaDe(codigo),
      critico: codigo.startsWith('TEL') || codigo.startsWith('HIL'),
      precioCompra: Number(fila.precio_compra),
      unidadCompra: fila.unidad_compra ?? 'pieza',
      minimoCompra: Number(fila.minimo_compra),
      plazoDias: Number(fila.plazo_dias),
      esPrincipal: fila.es_principal,
      vigenciaHasta: fila.vigencia_hasta,
      activo: fila.activo,
    };
  }

  private categoriaDe(codigo: string): MaterialProveedor['categoria'] {
    if (codigo.startsWith('TEL')) {
      return 'Tela';
    }
    if (codigo.startsWith('HIL')) {
      return 'Hilo';
    }
    if (codigo.startsWith('EST')) {
      return 'Estabilizador';
    }
    if (codigo.startsWith('AVI')) {
      return 'Avío';
    }
    if (codigo.startsWith('ETQ')) {
      return 'Etiqueta';
    }
    return 'Empaque';
  }

  private adaptarEvaluacion(fila: EvaluacionApi): EvaluacionProveedor {
    return {
      proveedorId: fila.proveedor_id,
      ordenesRecibidas: Number(fila.ordenes_recibidas),
      ordenesATiempo: Number(fila.entregas_a_tiempo),
      entregasATiempoPct: Number(fila.porcentaje_a_tiempo),
      cantidadRecibida: Number(fila.cantidad_medida),
      cantidadAceptada: Number(fila.cantidad_aceptada),
      aceptacionPct: Number(fila.porcentaje_aceptacion),
    };
  }
}
