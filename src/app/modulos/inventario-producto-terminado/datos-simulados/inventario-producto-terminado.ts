import type {
  AlertaInventarioProducto,
  FilaInventario,
  MovimientoProducto,
  SenalReposicion,
  TipoDocumentoMovimiento,
  TipoMovimientoProducto,
} from '../modelos/inventario-producto-terminado';

/**
 * DATOS DE DEMOSTRACIÓN de M12.
 * El SKU, el producto y la categoría llegan de la instantánea de M10. Las
 * existencias, reservas, movimientos y reglas de este archivo son ejemplos
 * tipados: M12 es el dueño real de esos valores cuando se integre Flask.
 * Las unidades en producción son una proyección de solo lectura de M16.
 */

/** Contrato simulado de `orden_produccion_linea` (M16), pendiente de integrar. */
export const UNIDADES_EN_PRODUCCION_SIMULADAS: Readonly<Record<string, number>> = {
  'SD-CH-BL': 12,
  'SD-MD-NG': 20,
  'SD-GD-GR': 8,
  'PL-MD-BL': 16,
  'PL-GD-GR': 10,
  'PN-CH-NG': 6,
  'GO-UN-BL': 4,
};

function fechaHaceDias(dias: number, hora = 9): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  fecha.setHours(hora, 0, 0, 0);
  return fecha.toISOString();
}

interface EntradaMovimientoSimulado {
  tipo: TipoMovimientoProducto;
  deltaExistencia: number;
  deltaReservado: number;
  documentoTipo: TipoDocumentoMovimiento;
  documentoId: string;
  motivo: string;
  diasAgo: number;
  hora: number;
  usuario: string;
}

/** Construye un historial coherente: el último movimiento explica la existencia actual. */
export function crearMovimientosSimulados(filas: readonly FilaInventario[]): MovimientoProducto[] {
  const movimientos: MovimientoProducto[] = [];
  let consecutivo = 1;

  const agregar = (fila: FilaInventario, entrada: EntradaMovimientoSimulado): void => {
    movimientos.push({
      id: consecutivo++,
      varianteId: fila.varianteId,
      sku: fila.sku,
      tipo: entrada.tipo,
      deltaExistencia: entrada.deltaExistencia,
      deltaReservado: entrada.deltaReservado,
      documentoTipo: entrada.documentoTipo,
      documentoId: entrada.documentoId,
      motivo: entrada.motivo,
      usuario: entrada.usuario,
      fecha: fechaHaceDias(entrada.diasAgo, entrada.hora),
    });
  };

  filas.forEach((fila, indice) => {
    const cantidadSalidas = indice % 4 === 0 ? 0 : (indice % 3) + 1;
    const salidas: number[] = [];
    for (let paso = 0; paso < cantidadSalidas; paso += 1) {
      salidas.push(Math.max(1, Math.ceil((fila.existencia + 6) / (cantidadSalidas + 2)) - paso));
    }
    const totalSalidas = salidas.reduce((suma, unidades) => suma + unidades, 0);
    const reingreso = indice % 7 === 0 ? 2 : 0;
    const ajusteInicial = indice % 9 === 0 ? -1 : 0;
    const producidas = fila.existencia + totalSalidas - reingreso - ajusteInicial;

    if (producidas > 0) {
      agregar(fila, {
        tipo: 'PRODUCCION',
        deltaExistencia: producidas,
        deltaReservado: 0,
        documentoTipo: 'ORDEN',
        documentoId: `OP-${String(210 + indice).padStart(4, '0')}`,
        motivo: 'Unidades aprobadas en revisión de calidad',
        diasAgo: 40 + (indice % 15),
        hora: 10,
        usuario: 'Producción M16 (demo)',
      });
    }

    salidas.forEach((unidades, paso) => {
      agregar(fila, {
        tipo: 'SALIDA_ENVIO',
        deltaExistencia: -unidades,
        deltaReservado: 0,
        documentoTipo: 'PEDIDO',
        documentoId: `PED-${String(1400 + indice * 3 + paso)}`,
        motivo: 'Salida para envío de pedido confirmado',
        diasAgo: 2 + paso * 8 + (indice % 5),
        hora: 11 + paso,
        usuario: 'Entregas M19 (demo)',
      });
    });

    if (reingreso > 0) {
      agregar(fila, {
        tipo: 'REINGRESO',
        deltaExistencia: reingreso,
        deltaReservado: 0,
        documentoTipo: 'DEVOLUCION',
        documentoId: `DEV-${String(310 + indice).padStart(4, '0')}`,
        motivo: 'Devolución aprobada tras inspección',
        diasAgo: 1 + (indice % 6),
        hora: 13,
        usuario: 'Cambios y devoluciones M07 (demo)',
      });
    }

    if (ajusteInicial !== 0) {
      agregar(fila, {
        tipo: 'AJUSTE',
        deltaExistencia: ajusteInicial,
        deltaReservado: 0,
        documentoTipo: 'AJUSTE',
        documentoId: `AJ-${String(80 + indice).padStart(4, '0')}`,
        motivo: 'Conteo físico inicial',
        diasAgo: 3 + (indice % 4),
        hora: 15,
        usuario: 'Operativo (demo)',
      });
    }

    if (fila.reservado > 0) {
      agregar(fila, {
        tipo: 'RESERVA',
        deltaExistencia: 0,
        deltaReservado: fila.reservado,
        documentoTipo: 'PEDIDO',
        documentoId: `PED-${String(1800 + indice)}`,
        motivo: 'Reserva al pagar pedido con existencia',
        diasAgo: 1 + (indice % 3),
        hora: 16,
        usuario: 'Pago M05 (demo)',
      });
    }
  });

  return movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function crearAlertasSimuladas(
  filas: readonly FilaInventario[],
): AlertaInventarioProducto[] {
  return filas
    .filter((fila) => fila.existencia - fila.reservado <= fila.stockMinimo)
    .slice(0, 3)
    .map((fila, indice) => ({
      id: indice + 1,
      fecha: fechaHaceDias(indice, 8 + indice),
      clave: 'PT_STOCK_MINIMO',
      sku: fila.sku,
      mensaje: `Disponible ${fila.existencia - fila.reservado} en el mínimo ${fila.stockMinimo}. Reposición sugerida: ${fila.cantidadReposicion} unidades.`,
      severidad: 'PREVENTIVA',
    }));
}

/** Contrato simulado de la señal que Flask convertiría en orden de producción. */
export function crearSenalesSimuladas(filas: readonly FilaInventario[]): SenalReposicion[] {
  return filas
    .filter((fila) => fila.existencia - fila.reservado <= fila.stockMinimo)
    .slice(0, 3)
    .map((fila, indice) => ({
      id: indice + 1,
      fecha: fechaHaceDias(indice, 7 + indice),
      sku: fila.sku,
      cantidad: fila.cantidadReposicion,
      origen: 'STOCK_MINIMO',
      estado: 'PENDIENTE_M16',
    }));
}
