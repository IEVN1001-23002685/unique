import { Injectable, computed, inject, signal } from '@angular/core';
import { PedidosServicio } from '../../pedidos/servicios/pedidos-servicio';
import type { Pedido } from '../../pedidos/modelos/pedido';
import {
  ENTREGAS_SIMULADAS,
  REPARTIDORES_SIMULADOS,
  direccionPara,
} from '../datos-simulados/entregas';
import type {
  DatosAsignacion,
  DireccionEntrega,
  DatosEntregado,
  DatosFallida,
  DatosRepartidor,
  Entrega,
  ProductoRepartido,
  Repartidor,
  ResultadoOperacion,
} from '../modelos/entrega';

const dos = (valor: number): string => String(valor).padStart(2, '0');

function fechaAhoraIso(): string {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:00`;
}

function fechaHoy(): string {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/**
 * Estado en memoria de M19 · Entregas. La interfaz pública está pensada para
 * sustituirse por HttpClient contra:
 *   GET /entregas/por-asignar · POST /entregas · POST /entregas/{id}/salida
 *   POST /entregas/{id}/resultado · GET /entregas/hoja-reparto
 *   GET /entregas/productos-repartidos · GET/POST/PATCH/DELETE /repartidores
 *
 * M09 es dueño del estado del pedido y M12 de la existencia: aquí solo se
 * consultan mediante contratos. Las transiciones y los movimientos reales
 * (SALIDA_ENVIO, REINGRESO, reembolso) quedan señalados como pendientes de Flask.
 */
@Injectable({
  providedIn: 'root',
})
export class EntregasServicio {
  private readonly pedidos = inject(PedidosServicio);
  private readonly lista = signal<Entrega[]>(
    ENTREGAS_SIMULADAS.map((entrega) => ({
      ...entrega,
      direccion: { ...entrega.direccion },
      lineas: entrega.lineas.map((linea) => ({ ...linea })),
    })),
  );
  private readonly catalogo = signal<Repartidor[]>(
    REPARTIDORES_SIMULADOS.map((repartidor) => ({ ...repartidor })),
  );

  readonly entregas = this.lista.asReadonly();
  readonly repartidores = this.catalogo.asReadonly();

  readonly activos = computed<Repartidor[]>(() =>
    this.catalogo().filter((repartidor) => repartidor.activo && repartidor.eliminadoEn === null),
  );

  /** Pedidos LISTO_ENVIO sin entrega activa; se pueden ordenar por CP para agrupar rutas. */
  readonly porAsignar = computed<Pedido[]>(() =>
    this.pedidos
      .pedidos()
      .filter(
        (pedido) =>
          pedido.estado === 'LISTO_ENVIO' &&
          !this.lista().some(
            (entrega) =>
              entrega.pedidoFolio === pedido.folio &&
              (entrega.estado === 'PROGRAMADA' || entrega.estado === 'EN_RUTA'),
          ),
      )
      .sort((a, b) => {
        const cpA = this.direccionDe(a).cp;
        const cpB = this.direccionDe(b).cp;
        if (cpA !== cpB) {
          return cpA.localeCompare(cpB);
        }
        return (a.fechaPromesa ?? '9999').localeCompare(b.fechaPromesa ?? '9999');
      }),
  );

  readonly enRuta = computed<Entrega[]>(() =>
    this.lista().filter((entrega) => entrega.estado === 'EN_RUTA'),
  );

  readonly entregadas = computed<Entrega[]>(() =>
    this.lista().filter((entrega) => entrega.estado === 'ENTREGADA'),
  );

  /** Fallidas con dos o más intentos y sin decisión del Administrador (M21). */
  readonly alertasCriticas = computed<Entrega[]>(() =>
    this.lista().filter(
      (entrega) =>
        entrega.estado === 'FALLIDA' && this.tieneAlertaCritica(entrega) && entrega.decision === null,
    ),
  );

  readonly indicadores = computed(() => ({
    porAsignar: this.porAsignar().length,
    enRuta: this.enRuta().length,
    entregadas: this.entregadas().length,
    alertas: this.alertasCriticas().length,
  }));

  direccionDe(pedido: Pedido): DireccionEntrega {
    return direccionPara(pedido.folio, pedido.cliente);
  }

  repartidorDe(id: number): Repartidor | undefined {
    return this.catalogo().find((repartidor) => repartidor.id === id);
  }

  nombreRepartidor(id: number): string {
    return this.repartidorDe(id)?.nombre ?? 'Repartidor no disponible';
  }

  hojaDe(repartidorId: number, fechaProgramada: string): Entrega[] {
    return this.lista()
      .filter(
        (entrega) =>
          entrega.repartidorId === repartidorId &&
          entrega.fechaProgramada === fechaProgramada &&
          (entrega.estado === 'PROGRAMADA' || entrega.estado === 'EN_RUTA'),
      )
      .sort((a, b) => a.direccion.cp.localeCompare(b.direccion.cp));
  }

  tieneAlertaCritica(entrega: Entrega): boolean {
    return (
      entrega.estado === 'FALLIDA' &&
      this.lista().filter(
        (item) => item.pedidoFolio === entrega.pedidoFolio && item.estado === 'FALLIDA',
      ).length >= 2
    );
  }

  fallidosDe(pedidoFolio: string): number {
    return this.lista().filter(
      (entrega) => entrega.pedidoFolio === pedidoFolio && entrega.estado === 'FALLIDA',
    ).length;
  }

  piezas(entrega: Entrega): number {
    return entrega.lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  }

  articulos(pedido: Pedido): number {
    return pedido.lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  }

  fechaHoy(): string {
    return fechaHoy();
  }

  asignar(datos: DatosAsignacion): ResultadoOperacion {
    const pedido = this.pedidos.obtenerPedido(datos.pedidoFolio);
    if (!pedido || pedido.estado !== 'LISTO_ENVIO') {
      return { ok: false, mensaje: 'El pedido ya no está LISTO_ENVIO o no existe.' };
    }
    const repartidor = this.repartidorDe(datos.repartidorId);
    if (!repartidor || !repartidor.activo || repartidor.eliminadoEn !== null) {
      return { ok: false, mensaje: 'Selecciona un repartidor activo.' };
    }
    if (!this.fechaValida(datos.fechaProgramada)) {
      return { ok: false, mensaje: 'La fecha programada debe ser igual o posterior a hoy.' };
    }
    if (
      this.lista().some(
        (entrega) =>
          entrega.pedidoFolio === pedido.folio &&
          (entrega.estado === 'PROGRAMADA' || entrega.estado === 'EN_RUTA'),
      )
    ) {
      return {
        ok: false,
        mensaje: 'El pedido ya tiene una entrega programada o en ruta. No hay envíos parciales.',
      };
    }

    const folio = this.siguienteFolio();
    const entrega: Entrega = {
      id: this.siguienteId(),
      folio,
      pedidoFolio: pedido.folio,
      ventaFolio: pedido.ventaFolio,
      cliente: pedido.cliente,
      prioridad: pedido.prioridad,
      direccion: this.direccionDe(pedido),
      repartidorId: repartidor.id,
      intento: this.fallidosDe(pedido.folio) + 1,
      estado: 'PROGRAMADA',
      fechaProgramada: datos.fechaProgramada,
      salidaEn: null,
      resultadoEn: null,
      receptor: null,
      motivoFallo: null,
      notas: datos.notas.trim() === '' ? null : datos.notas.trim(),
      decision: null,
      lineas: pedido.lineas.map((linea) => ({
        sku: linea.sku,
        nombreProducto: linea.nombreProducto,
        talla: linea.talla,
        color: linea.color,
        cantidad: linea.cantidad,
      })),
    };

    this.lista.update((actuales) => [entrega, ...actuales]);
    return {
      ok: true,
      folio,
      mensaje: `Entrega ${folio} programada con ${repartidor.nombre}. La guía se publica en M06 al integrar Flask.`,
    };
  }

  confirmarSalida(folio: string): ResultadoOperacion {
    const entrega = this.obtener(folio);
    if (!entrega || entrega.estado !== 'PROGRAMADA') {
      return { ok: false, mensaje: 'La entrega no está PROGRAMADA.' };
    }
    const duplicada = this.lista().some(
      (item) =>
        item.id !== entrega.id &&
        item.pedidoFolio === entrega.pedidoFolio &&
        item.estado === 'EN_RUTA',
    );
    if (duplicada) {
      return {
        ok: false,
        mensaje: 'Ese pedido ya tiene otra entrega EN_RUTA. Un repartidor no puede duplicarla.',
      };
    }

    this.actualizar(folio, (actual) => ({ ...actual, estado: 'EN_RUTA', salidaEn: fechaAhoraIso() }));
    return {
      ok: true,
      mensaje:
        'Salida confirmada en la demo. La baja SALIDA_ENVIO en M12 y el paso a EN_REPARTO en M09/M06 requieren Flask.',
    };
  }

  registrarEntregado(folio: string, datos: DatosEntregado): ResultadoOperacion {
    const entrega = this.obtener(folio);
    if (!entrega || entrega.estado !== 'EN_RUTA') {
      return { ok: false, mensaje: 'La entrega no está EN_RUTA.' };
    }
    const receptor = datos.receptor.trim();
    if (receptor.length < 3) {
      return { ok: false, mensaje: 'Captura el nombre de quien recibió el pedido.' };
    }

    this.actualizar(folio, (actual) => ({
      ...actual,
      estado: 'ENTREGADA',
      receptor,
      resultadoEn: fechaAhoraIso(),
      notas: datos.notas.trim() === '' ? actual.notas : datos.notas.trim(),
    }));
    return {
      ok: true,
      mensaje:
        'Entrega registrada en la demo. El paso a ENTREGADO en M09 y la ventana de devolución en M07 requieren Flask.',
    };
  }

  registrarFallida(folio: string, datos: DatosFallida): ResultadoOperacion {
    const entrega = this.obtener(folio);
    if (!entrega || entrega.estado !== 'EN_RUTA') {
      return { ok: false, mensaje: 'La entrega no está EN_RUTA.' };
    }

    this.actualizar(folio, (actual) => ({
      ...actual,
      estado: 'FALLIDA',
      motivoFallo: datos.motivoFallo,
      resultadoEn: fechaAhoraIso(),
      notas: datos.notas.trim() === '' ? actual.notas : datos.notas.trim(),
    }));

    const actualizada = this.obtener(folio);
    if (actualizada && this.tieneAlertaCritica(actualizada)) {
      return {
        ok: true,
        mensaje:
          'Segundo intento fallido: se abre una alerta crítica. El Administrador debe reprogramar o cancelar con reembolso; la decisión real corresponde a M21 y Flask.',
      };
    }
    return {
      ok: true,
      mensaje:
        'Intento fallido registrado. En producción se reingresaría la existencia conservando la reserva (M12), el pedido volvería a LISTO_ENVIO (M09) y se programaría otro intento; requiere Flask.',
    };
  }

  reprogramar(folio: string): ResultadoOperacion {
    const entrega = this.obtener(folio);
    if (
      !entrega ||
      entrega.estado !== 'FALLIDA' ||
      !this.tieneAlertaCritica(entrega) ||
      entrega.decision !== null
    ) {
      return { ok: false, mensaje: 'Esta incidencia no está pendiente de decisión.' };
    }

    const nuevoFolio = this.siguienteFolio();
    const nueva: Entrega = {
      ...entrega,
      id: this.siguienteId(),
      folio: nuevoFolio,
      intento: entrega.intento + 1,
      estado: 'PROGRAMADA',
      fechaProgramada: fechaHoy(),
      salidaEn: null,
      resultadoEn: null,
      receptor: null,
      motivoFallo: null,
      decision: null,
      direccion: { ...entrega.direccion },
      lineas: entrega.lineas.map((linea) => ({ ...linea })),
    };

    this.lista.update((actuales) => [
      nueva,
      ...actuales.map((item) =>
        item.id === entrega.id ? { ...item, decision: 'REPROGRAMADA' as const } : item,
      ),
    ]);
    return {
      ok: true,
      folio: nuevoFolio,
      mensaje: `Decisión del Administrador: reprogramada como ${nuevoFolio}. El reingreso y la alerta real requieren Flask (M12/M21).`,
    };
  }

  cancelarConReembolso(folio: string): ResultadoOperacion {
    const entrega = this.obtener(folio);
    if (
      !entrega ||
      entrega.estado !== 'FALLIDA' ||
      !this.tieneAlertaCritica(entrega) ||
      entrega.decision !== null
    ) {
      return { ok: false, mensaje: 'Esta incidencia no está pendiente de decisión.' };
    }

    this.actualizar(folio, (actual) => ({
      ...actual,
      estado: 'CANCELADA',
      decision: 'CANCELADA_REEMBOLSO',
    }));
    return {
      ok: true,
      mensaje:
        'Decisión del Administrador: cancelar con reembolso. La cancelación en M09 y el reembolso en M08 requieren Flask.',
    };
  }

  productosRepartidos(): ProductoRepartido[] {
    const agrupados = new Map<string, ProductoRepartido>();
    for (const entrega of this.lista()) {
      if (entrega.salidaEn === null || entrega.estado === 'FALLIDA' || entrega.estado === 'CANCELADA') {
        continue;
      }
      for (const linea of entrega.lineas) {
        const clave = `${linea.sku}|${entrega.fechaProgramada}|${entrega.repartidorId}`;
        const actual = agrupados.get(clave);
        if (actual) {
          actual.cantidad += linea.cantidad;
          if (!actual.pedidos.includes(entrega.pedidoFolio)) {
            actual.pedidos.push(entrega.pedidoFolio);
          }
          continue;
        }
        agrupados.set(clave, {
          sku: linea.sku,
          nombreProducto: linea.nombreProducto,
          talla: linea.talla,
          color: linea.color,
          cantidad: linea.cantidad,
          pedidos: [entrega.pedidoFolio],
          repartidorId: entrega.repartidorId,
          repartidor: this.nombreRepartidor(entrega.repartidorId),
          fechaProgramada: entrega.fechaProgramada,
        });
      }
    }
    return [...agrupados.values()].sort(
      (a, b) => b.fechaProgramada.localeCompare(a.fechaProgramada) || a.sku.localeCompare(b.sku),
    );
  }

  altaRepartidor(datos: DatosRepartidor): ResultadoOperacion {
    const validacion = this.validarRepartidor(datos);
    if (!validacion.ok) {
      return validacion;
    }
    const id = this.catalogo().reduce((maximo, item) => Math.max(maximo, item.id), 0) + 1;
    this.catalogo.update((actuales) => [
      ...actuales,
      {
        id,
        nombre: datos.nombre.trim(),
        telefono: datos.telefono.trim(),
        vehiculo: datos.vehiculo.trim() === '' ? null : datos.vehiculo.trim(),
        activo: true,
        eliminadoEn: null,
      },
    ]);
    return { ok: true, mensaje: `Repartidor ${datos.nombre.trim()} dado de alta en la demo.` };
  }

  editarRepartidor(id: number, datos: DatosRepartidor): ResultadoOperacion {
    const validacion = this.validarRepartidor(datos);
    if (!validacion.ok) {
      return validacion;
    }
    const existe = this.catalogo().some((item) => item.id === id && item.eliminadoEn === null);
    if (!existe) {
      return { ok: false, mensaje: 'No encontramos el repartidor indicado.' };
    }
    this.catalogo.update((actuales) =>
      actuales.map((item) =>
        item.id === id
          ? {
              ...item,
              nombre: datos.nombre.trim(),
              telefono: datos.telefono.trim(),
              vehiculo: datos.vehiculo.trim() === '' ? null : datos.vehiculo.trim(),
            }
          : item,
      ),
    );
    return { ok: true, mensaje: 'Datos del repartidor actualizados en la demo.' };
  }

  eliminarRepartidor(id: number): ResultadoOperacion {
    const repartidor = this.repartidorDe(id);
    if (!repartidor || repartidor.eliminadoEn !== null) {
      return { ok: false, mensaje: 'El repartidor ya no está disponible.' };
    }
    const conEntregas = this.lista().some((entrega) => entrega.repartidorId === id);
    this.catalogo.update((actuales) =>
      actuales.map((item) =>
        item.id === id
          ? { ...item, activo: false, eliminadoEn: conEntregas ? null : fechaAhoraIso() }
          : item,
      ),
    );
    return {
      ok: true,
      mensaje: conEntregas
        ? 'Repartidor desactivado: conserva su historial de entregas. La baja real requiere Flask.'
        : 'Repartidor dado de baja en la demo. La baja real requiere Flask.',
    };
  }

  obtener(folio: string): Entrega | undefined {
    return this.lista().find((entrega) => entrega.folio === folio);
  }

  private fechaValida(fecha: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha >= fechaHoy();
  }

  private validarRepartidor(datos: DatosRepartidor): ResultadoOperacion {
    if (datos.nombre.trim().length < 3) {
      return { ok: false, mensaje: 'El nombre debe tener al menos 3 caracteres.' };
    }
    const digitos = datos.telefono.replace(/\D/g, '');
    if (digitos.length !== 10) {
      return { ok: false, mensaje: 'Captura un teléfono de 10 dígitos.' };
    }
    return { ok: true, mensaje: '' };
  }

  private siguienteId(): number {
    return this.lista().reduce((maximo, entrega) => Math.max(maximo, entrega.id), 0) + 1;
  }

  private siguienteFolio(): string {
    const numero = this.lista().reduce((maximo, entrega) => {
      const parte = entrega.folio.split('-').at(-1) ?? '0';
      return Math.max(maximo, Number(parte) || 0);
    }, 0) + 1;
    return `EN-${new Date().getFullYear()}-${String(numero).padStart(6, '0')}`;
  }

  private actualizar(folio: string, transformar: (entrega: Entrega) => Entrega): void {
    this.lista.update((actuales) =>
      actuales.map((entrega) => (entrega.folio === folio ? transformar(entrega) : entrega)),
    );
  }
}
