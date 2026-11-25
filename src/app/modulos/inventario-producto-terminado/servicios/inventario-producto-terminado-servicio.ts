import { Injectable, computed, inject, signal } from '@angular/core';
import { ProductosServicio } from '../../productos/servicios/productos-servicio';
import {
  UNIDADES_EN_PRODUCCION_SIMULADAS,
  crearAlertasSimuladas,
  crearMovimientosSimulados,
  crearSenalesSimuladas,
} from '../datos-simulados/inventario-producto-terminado';
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

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Estado de M12 en memoria. Sustituir por HttpClient cuando Flask esté disponible.
 * M10 aporta SKU, categoría y snapshot de existencias; M12 mantiene su propio
 * estado de stock y movimientos. M16, M19 y M07 se consumen como contratos de
 * solo lectura hasta que existan sus módulos.
 */
@Injectable({
  providedIn: 'root',
})
export class InventarioProductoServicio {
  private readonly catalogo = inject(ProductosServicio);
  private readonly inicial = this.crearEstadoInicial();

  private readonly filasLista = signal<FilaInventario[]>(this.inicial.filas);
  private readonly movimientosLista = signal<MovimientoProducto[]>(this.inicial.movimientos);
  private readonly alertasLista = signal<AlertaInventarioProducto[]>(
    crearAlertasSimuladas(this.inicial.filas),
  );
  private readonly senalesLista = signal<SenalReposicion[]>(
    crearSenalesSimuladas(this.inicial.filas),
  );

  private consecutivoMovimiento = this.inicial.movimientos.length + 1;
  private consecutivoAlerta = this.alertasLista().length + 1;
  private consecutivoSenal = this.senalesLista().length + 1;

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

  nombreCategoria(id: number): string {
    return this.catalogo.nombreCategoria(id);
  }

  nombreColor(codigo: FilaInventario['color']): string {
    return this.catalogo.nombreColor(codigo);
  }

  nombreTalla(codigo: FilaInventario['talla']): string {
    return this.catalogo.nombreTalla(codigo);
  }

  /** Conteo físico: genera un movimiento AJUSTE en memoria, nunca edita la tabla directamente. */
  registrarAjuste(datos: DatosAjuste): ResultadoAjuste {
    const fila = this.filasLista().find((item) => item.varianteId === datos.varianteId);
    if (!fila) {
      return { ok: false, mensaje: 'Selecciona un SKU válido para registrar el conteo.' };
    }
    if (!Number.isInteger(datos.cantidadContada) || datos.cantidadContada < 0) {
      return { ok: false, mensaje: 'La cantidad contada debe ser un entero mayor o igual a cero.' };
    }
    if (datos.motivo.trim().length < 4) {
      return { ok: false, mensaje: 'El motivo del ajuste es obligatorio (mínimo 4 caracteres).' };
    }
    if (datos.cantidadContada < fila.reservado) {
      return {
        ok: false,
        mensaje: `La cantidad contada no puede ser menor al reservado (${fila.reservado} unidades): el disponible no puede ser negativo.`,
      };
    }

    const diferencia = datos.cantidadContada - fila.existencia;
    const ahora = new Date().toISOString();
    const movimiento: MovimientoProducto = {
      id: this.consecutivoMovimiento++,
      varianteId: fila.varianteId,
      sku: fila.sku,
      tipo: 'AJUSTE',
      deltaExistencia: diferencia,
      deltaReservado: 0,
      documentoTipo: 'AJUSTE',
      documentoId: `AJ-${String(this.consecutivoMovimiento - 1).padStart(4, '0')}`,
      motivo: datos.motivo.trim(),
      usuario: 'Operativo (demo)',
      fecha: ahora,
    };

    const actualizada: FilaInventario = { ...fila, existencia: datos.cantidadContada };
    this.movimientosLista.update((lista) => [movimiento, ...lista]);
    this.filasLista.update((lista) =>
      lista.map((item) => (item.varianteId === fila.varianteId ? actualizada : item)),
    );

    if (diferencia !== 0) {
      this.alertasLista.update((lista) => [
        {
          id: this.consecutivoAlerta++,
          fecha: ahora,
          clave: 'AJUSTE_DIFERENCIA',
          sku: fila.sku,
          mensaje: `Conteo ${datos.cantidadContada} contra ${fila.existencia} del sistema: diferencia de ${diferencia > 0 ? '+' : ''}${diferencia} unidades. Motivo: ${datos.motivo.trim()}.`,
          severidad: 'INFORMATIVA',
        },
        ...lista,
      ]);
    }

    const senal = this.evaluarReposicion(actualizada);
    const detalle = this.conDetalle(actualizada);
    const mensaje = [
      `Movimiento AJUSTE registrado en memoria para ${fila.sku}.`,
      diferencia === 0
        ? 'Sin diferencia: solo se dejó constancia del conteo.'
        : `Diferencia ${diferencia > 0 ? '+' : ''}${diferencia} unidades; alerta informativa abierta.`,
      `Disponible final: ${detalle.disponible} (${detalle.semaforo}).`,
      senal
        ? `Señal de reposición por ${senal.cantidad} unidades pendiente de crear/sumar orden en M16.`
        : 'Ninguna operación persistió en Flask.',
    ].join(' ');

    return { ok: true, mensaje, ...(senal ? { senal } : {}) };
  }

  /** Actualiza stock mínimo y cantidad de reposición. No dispara órdenes por sí sola. */
  guardarReglas(cambios: ReglaReposicion[]): ResultadoReglas {
    const actuales = this.filasLista();
    const porId = new Map(actuales.map((fila) => [fila.varianteId, fila]));
    if (
      cambios.length === 0 ||
      new Set(cambios.map((cambio) => cambio.varianteId)).size !== cambios.length
    ) {
      return { ok: false, mensaje: 'No hay reglas válidas para guardar.' };
    }

    for (const cambio of cambios) {
      if (!porId.has(cambio.varianteId)) {
        return { ok: false, mensaje: 'Una de las reglas corresponde a un SKU que ya no existe.' };
      }
      if (!Number.isInteger(cambio.stockMinimo) || cambio.stockMinimo < 0) {
        return { ok: false, mensaje: 'El stock mínimo debe ser un entero mayor o igual a cero.' };
      }
      if (!Number.isInteger(cambio.cantidadReposicion) || cambio.cantidadReposicion < 1) {
        return { ok: false, mensaje: 'La cantidad de reposición debe ser un entero mayor a cero.' };
      }
    }

    const cambiosPorId = new Map(cambios.map((cambio) => [cambio.varianteId, cambio]));
    this.filasLista.update((lista) =>
      lista.map((fila) => {
        const cambio = cambiosPorId.get(fila.varianteId);
        return cambio
          ? {
              ...fila,
              stockMinimo: cambio.stockMinimo,
              cantidadReposicion: cambio.cantidadReposicion,
            }
          : fila;
      }),
    );

    return {
      ok: true,
      mensaje:
        'Reglas actualizadas en memoria. Flask aplicará PATCH por variante; editar el mínimo no crea órdenes por sí mismo.',
    };
  }

  private crearEstadoInicial(): { filas: FilaInventario[]; movimientos: MovimientoProducto[] } {
    const filas: FilaInventario[] = this.catalogo.filasVariantes().map((fila) => {
      const producto = this.catalogo.obtenerProducto(fila.productoId);
      return {
        varianteId: fila.variante.id,
        sku: fila.variante.sku,
        productoId: fila.productoId,
        productoNombre: fila.productoNombre,
        categoriaId: producto?.categoriaId ?? 0,
        categoriaNombre: fila.categoria,
        talla: fila.variante.talla,
        color: fila.variante.color,
        existencia: fila.variante.existencia,
        reservado: fila.variante.reservado,
        stockMinimo: fila.variante.stockMinimo,
        cantidadReposicion: fila.variante.cantidadReposicion,
        enProduccion: UNIDADES_EN_PRODUCCION_SIMULADAS[fila.variante.sku] ?? 0,
        ventasDiarias30: 0,
      };
    });

    const movimientos = crearMovimientosSimulados(filas);
    return {
      filas: filas.map((fila) => ({
        ...fila,
        ventasDiarias30: this.ventasDiariasDe(fila.sku, movimientos),
      })),
      movimientos,
    };
  }

  private ventasDiariasDe(sku: string, movimientos: readonly MovimientoProducto[]): number {
    const limite = Date.now() - 30 * MILISEGUNDOS_POR_DIA;
    const total = movimientos
      .filter(
        (movimiento) =>
          movimiento.sku === sku &&
          movimiento.tipo === 'SALIDA_ENVIO' &&
          new Date(movimiento.fecha).getTime() >= limite,
      )
      .reduce((suma, movimiento) => suma + Math.abs(movimiento.deltaExistencia), 0);
    return Math.round((total / 30) * 100) / 100;
  }

  private conDetalle(fila: FilaInventario): FilaExistencia {
    const disponible = Math.max(0, fila.existencia - fila.reservado);
    const semaforo = disponible === 0 ? 'ROJO' : disponible <= fila.stockMinimo ? 'AMBAR' : 'VERDE';
    const diasCobertura =
      fila.ventasDiarias30 > 0 ? Math.round((disponible / fila.ventasDiarias30) * 10) / 10 : null;
    return { ...fila, disponible, semaforo, diasCobertura };
  }

  /**
   * Traduce la regla de negocio a una señal local: Flask debe crear o sumar la
   * orden de producción con origen STOCK_MINIMO y abrir la alerta real.
   */
  private evaluarReposicion(fila: FilaInventario): SenalReposicion | null {
    const detalle = this.conDetalle(fila);
    if (detalle.disponible > fila.stockMinimo || detalle.disponible < 0) {
      return null;
    }

    const cantidad = Math.max(1, fila.cantidadReposicion);
    const ahora = new Date().toISOString();
    const existente = this.senalesLista().find(
      (senal) => senal.sku === fila.sku && senal.estado === 'PENDIENTE_M16',
    );

    if (existente) {
      let resultado: SenalReposicion = existente;
      this.senalesLista.update((lista) =>
        lista.map((senal) => {
          if (senal.id !== existente.id) {
            return senal;
          }
          resultado = { ...senal, cantidad: senal.cantidad + cantidad, fecha: ahora };
          return resultado;
        }),
      );
      this.agregarAlertaReposicion(fila, detalle, cantidad, ahora, 'Se sumó a la señal pendiente.');
      return resultado;
    }

    const senal: SenalReposicion = {
      id: this.consecutivoSenal++,
      fecha: ahora,
      sku: fila.sku,
      cantidad,
      origen: 'STOCK_MINIMO',
      estado: 'PENDIENTE_M16',
    };
    this.senalesLista.update((lista) => [...lista, senal]);
    this.agregarAlertaReposicion(fila, detalle, cantidad, ahora, 'Señal nueva pendiente de M16.');
    return senal;
  }

  private agregarAlertaReposicion(
    fila: FilaInventario,
    detalle: FilaExistencia,
    cantidad: number,
    fecha: string,
    detalleAdicional: string,
  ): void {
    this.alertasLista.update((lista) => [
      {
        id: this.consecutivoAlerta++,
        fecha,
        clave: 'PT_STOCK_MINIMO',
        sku: fila.sku,
        mensaje: `${detalleAdicional} Disponible ${detalle.disponible} ≤ mínimo ${fila.stockMinimo}. Reposición ${cantidad} unidades (origen STOCK_MINIMO).`,
        severidad: 'PREVENTIVA',
      },
      ...lista,
    ]);
  }
}
