import { Injectable, computed, inject, signal } from '@angular/core';
import { PedidosServicio } from '../../pedidos/servicios/pedidos-servicio';
import type { Pedido } from '../../pedidos/modelos/pedido';
import {
  DETALLES_PREPARACION,
  INCIDENCIAS_SIMULADAS,
  REGLAS_EMPAQUE_SIMULADAS,
  direccionPara,
} from '../datos-simulados/preparacion';
import type {
  ConsumoEmpaque,
  DatosIncidencia,
  EstadoPreparacion,
  Incidencia,
  PasoPreparacion,
  Preparacion,
  ReglaEmpaque,
  ResultadoOperacion,
} from '../modelos/preparacion';

const dos = (valor: number): string => String(valor).padStart(2, '0');

function fechaAhoraIso(): string {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:00`;
}

/**
 * Estado en memoria de M18 · Preparación. La interfaz pública está pensada para
 * sustituirse por HttpClient contra:
 *   GET /preparacion/cola · POST /preparacion/{pedido_id}/tomar
 *   PATCH /preparacion/{id}/lineas · POST /preparacion/{id}/incidencia
 *   POST /preparacion/{id}/empacar · GET /preparacion/{id}/etiqueta
 *
 * M09 es dueño del estado del pedido y M15 de los materiales: aquí solo se
 * consultan mediante contratos. Ninguna acción persiste en servidor; los
 * cambios de estado de pedido, el consumo real de empaque y la merma real se
 * señalan como pendientes de Flask en los mensajes de la interfaz.
 */
@Injectable({
  providedIn: 'root',
})
export class PreparacionServicio {
  private readonly pedidos = inject(PedidosServicio);
  private readonly lista = signal<Preparacion[]>(this.crearIniciales());
  private readonly incidenciasLista = signal<Incidencia[]>(
    INCIDENCIAS_SIMULADAS.map((incidencia) => ({ ...incidencia })),
  );
  private consecutivoIncidencia =
    this.incidenciasLista().reduce((maximo, item) => Math.max(maximo, item.id), 0) + 1;

  readonly preparaciones = this.lista.asReadonly();
  readonly incidencias = this.incidenciasLista.asReadonly();
  readonly reglasEmpaque: ReglaEmpaque[] = REGLAS_EMPAQUE_SIMULADAS.filter((regla) => regla.activa);

  /** Pedidos CONFIRMADO que aún no tienen hoja, ordenados por prioridad y fecha prometida. */
  readonly cola = computed<Pedido[]>(() =>
    this.pedidos
      .pedidos()
      .filter(
        (pedido) =>
          pedido.estado === 'CONFIRMADO' &&
          !this.lista().some((preparacion) => preparacion.pedidoFolio === pedido.folio),
      )
      .sort((a, b) => {
        if (a.prioridad !== b.prioridad) {
          return a.prioridad === 'ALTA' ? -1 : 1;
        }
        return (a.fechaPromesa ?? '9999').localeCompare(b.fechaPromesa ?? '9999');
      }),
  );

  readonly enCurso = computed<Preparacion[]>(() =>
    this.lista()
      .filter((preparacion) => preparacion.estado !== 'LISTA')
      .sort((a, b) => b.iniciadaEn.localeCompare(a.iniciadaEn)),
  );

  readonly terminadas = computed<Preparacion[]>(() =>
    this.lista()
      .filter((preparacion) => preparacion.estado === 'LISTA')
      .sort((a, b) => (b.terminadaEn ?? '').localeCompare(a.terminadaEn ?? '')),
  );

  readonly indicadores = computed(() => ({
    porTomar: this.cola().length,
    enCurso: this.enCurso().length,
    listas: this.terminadas().length,
    incidenciasAbiertas: this.incidencias().filter((incidencia) => incidencia.estado === 'ABIERTA')
      .length,
  }));

  obtener(folioPreparacion: string): Preparacion | undefined {
    return this.lista().find((preparacion) => preparacion.folio === folioPreparacion);
  }

  incidenciasDe(folioPreparacion: string): Incidencia[] {
    return this.incidencias()
      .filter((incidencia) => incidencia.preparacionFolio === folioPreparacion)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  pasoDe(estado: EstadoPreparacion): PasoPreparacion {
    switch (estado) {
      case 'POR_SURTIR':
      case 'EN_PICKING':
        return 'PICKING';
      case 'EN_VERIFICACION':
        return 'VERIFICACION';
      case 'EN_EMPAQUE':
        return 'EMPAQUE';
      case 'LISTA':
        return 'LISTA';
    }
  }

  todoSurtido(preparacion: Preparacion): boolean {
    return preparacion.lineas.every((linea) => linea.cantidadSurtida >= linea.cantidadRequerida);
  }

  todoVerificado(preparacion: Preparacion): boolean {
    return preparacion.lineas.every(
      (linea) => linea.skuVerificado && linea.disenoVerificado && linea.etiquetasVerificadas,
    );
  }

  tomarPedido(pedidoFolio: string): ResultadoOperacion {
    const pedido = this.pedidos
      .pedidos()
      .find((item) => item.folio === pedidoFolio && item.estado === 'CONFIRMADO');
    if (!pedido) {
      return {
        ok: false,
        mensaje: 'El pedido ya no está en la cola o dejó de estar CONFIRMADO.',
      };
    }
    if (this.lista().some((preparacion) => preparacion.pedidoFolio === pedidoFolio)) {
      return { ok: false, mensaje: 'Este pedido ya tiene una hoja de preparación.' };
    }

    const folio = this.folioDe(pedidoFolio);
    const hoja: Preparacion = {
      id: pedido.id,
      folio,
      pedidoFolio: pedido.folio,
      ventaFolio: pedido.ventaFolio,
      cliente: pedido.cliente,
      prioridad: pedido.prioridad,
      fechaPromesa: pedido.fechaPromesa,
      estado: 'EN_PICKING',
      tomadaPor: 'Operativo (demo)',
      iniciadaEn: fechaAhoraIso(),
      terminadaEn: null,
      notas: '',
      direccion: direccionPara(pedido.folio, pedido.cliente),
      lineas: pedido.lineas.map((linea, indice) => ({
        id: indice + 1,
        sku: linea.sku,
        nombreProducto: linea.nombreProducto,
        talla: linea.talla,
        color: linea.color,
        cantidadRequerida: linea.cantidad,
        cantidadSurtida: 0,
        skuVerificado: false,
        disenoVerificado: false,
        etiquetasVerificadas: false,
      })),
    };

    this.lista.update((actuales) => [...actuales, hoja]);
    return {
      ok: true,
      folio,
      mensaje: `Hoja ${folio} creada. El paso a EN_PREPARACION en M09 queda pendiente de Flask.`,
    };
  }

  /** Captura o escaneo de SKU. Un SKU ajeno al pedido se rechaza (§7). */
  registrarSurtido(folioPreparacion: string, skuCapturado: string): ResultadoOperacion {
    const preparacion = this.obtener(folioPreparacion);
    if (!preparacion) {
      return { ok: false, mensaje: 'No encontramos la hoja de preparación.' };
    }
    if (preparacion.estado !== 'EN_PICKING') {
      return { ok: false, mensaje: 'La etapa de picking ya terminó en esta hoja.' };
    }

    const sku = skuCapturado.trim().toUpperCase();
    if (sku === '') {
      return { ok: false, mensaje: 'Captura o escanea un SKU antes de surtir.' };
    }
    const linea = preparacion.lineas.find((item) => item.sku === sku);
    if (!linea) {
      return {
        ok: false,
        mensaje: `El SKU ${sku} no está en el pedido ${preparacion.pedidoFolio}. Escaneo rechazado.`,
      };
    }
    if (linea.cantidadSurtida >= linea.cantidadRequerida) {
      return {
        ok: false,
        mensaje: `${sku} ya está surtido completo (${linea.cantidadRequerida} unidades).`,
      };
    }

    this.actualizarLineas(folioPreparacion, (lineas) =>
      lineas.map((item) =>
        item.id === linea.id ? { ...item, cantidadSurtida: item.cantidadSurtida + 1 } : item,
      ),
    );

    const nueva = linea.cantidadSurtida + 1;
    return {
      ok: true,
      mensaje: `${sku}: ${nueva} de ${linea.cantidadRequerida} unidades surtidas.`,
    };
  }

  verificarLinea(
    folioPreparacion: string,
    lineaId: number,
    campo: 'sku' | 'diseno' | 'etiquetas',
  ): ResultadoOperacion {
    const preparacion = this.obtener(folioPreparacion);
    if (!preparacion || preparacion.estado !== 'EN_VERIFICACION') {
      return { ok: false, mensaje: 'La verificación no está disponible en esta etapa.' };
    }
    const linea = preparacion.lineas.find((item) => item.id === lineaId);
    if (!linea) {
      return { ok: false, mensaje: 'No encontramos la línea indicada.' };
    }

    this.actualizarLineas(folioPreparacion, (lineas) =>
      lineas.map((item) => {
        if (item.id !== lineaId) {
          return item;
        }
        if (campo === 'sku') {
          return { ...item, skuVerificado: !item.skuVerificado };
        }
        if (campo === 'diseno') {
          return { ...item, disenoVerificado: !item.disenoVerificado };
        }
        return { ...item, etiquetasVerificadas: !item.etiquetasVerificadas };
      }),
    );
    return { ok: true, mensaje: `Verificación de ${campo} actualizada para ${linea.sku}.` };
  }

  pasarAVerificacion(folioPreparacion: string): ResultadoOperacion {
    const preparacion = this.obtener(folioPreparacion);
    if (!preparacion || preparacion.estado !== 'EN_PICKING') {
      return { ok: false, mensaje: 'La hoja no está en etapa de picking.' };
    }
    if (!this.todoSurtido(preparacion)) {
      return {
        ok: false,
        mensaje: 'Faltan unidades por surtir. No se puede iniciar la verificación.',
      };
    }
    this.cambiarEstado(folioPreparacion, 'EN_VERIFICACION');
    return {
      ok: true,
      mensaje: 'Verificación iniciada. Confirma SKU, diseño/bordado y etiquetas por línea.',
    };
  }

  pasarAEmpaque(folioPreparacion: string): ResultadoOperacion {
    const preparacion = this.obtener(folioPreparacion);
    if (!preparacion || preparacion.estado !== 'EN_VERIFICACION') {
      return { ok: false, mensaje: 'La hoja no está en etapa de verificación.' };
    }
    if (!this.todoVerificado(preparacion)) {
      return {
        ok: false,
        mensaje:
          'No se puede empacar: todas las líneas deben tener SKU, diseño y etiquetas verificados.',
      };
    }
    this.cambiarEstado(folioPreparacion, 'EN_EMPAQUE');
    return {
      ok: true,
      mensaje: 'Lista de empaque generada. El consumo real de materiales requiere Flask (M15).',
    };
  }

  marcarListo(folioPreparacion: string): ResultadoOperacion {
    const preparacion = this.obtener(folioPreparacion);
    if (!preparacion) {
      return { ok: false, mensaje: 'No encontramos la hoja de preparación.' };
    }
    if (preparacion.estado !== 'EN_EMPAQUE') {
      return { ok: false, mensaje: 'Primero se debe completar el empaque.' };
    }
    if (!this.todoVerificado(preparacion) || !this.todoSurtido(preparacion)) {
      return { ok: false, mensaje: 'La hoja tiene líneas incompletas; no se puede marcar lista.' };
    }

    this.lista.update((actuales) =>
      actuales.map((item) =>
        item.folio === folioPreparacion
          ? { ...item, estado: 'LISTA', terminadaEn: fechaAhoraIso() }
          : item,
      ),
    );
    return {
      ok: true,
      mensaje:
        'Pedido marcado LISTO_ENVIO en la demo; aparecería en Entregas → Por asignar (M19) al integrar Flask.',
    };
  }

  consumoEmpaque(folioPreparacion: string): ConsumoEmpaque[] {
    const preparacion = this.obtener(folioPreparacion);
    if (!preparacion) {
      return [];
    }
    const prendas = preparacion.lineas.reduce((suma, linea) => suma + linea.cantidadRequerida, 0);
    return this.reglasEmpaque.map((regla) => ({
      materialId: regla.materialId,
      nombre: regla.nombre,
      base: regla.base,
      cantidad: regla.base === 'POR_PRENDA' ? regla.cantidad * prendas : regla.cantidad,
      unidad: 'pza',
    }));
  }

  registrarIncidencia(folioPreparacion: string, datos: DatosIncidencia): ResultadoOperacion {
    const preparacion = this.obtener(folioPreparacion);
    if (!preparacion) {
      return { ok: false, mensaje: 'No encontramos la hoja de preparación.' };
    }
    const descripcion = datos.descripcion.trim();
    const sku = datos.sku.trim().toUpperCase();
    if (sku === '' || !preparacion.lineas.some((linea) => linea.sku === sku)) {
      return { ok: false, mensaje: 'Selecciona un SKU válido del pedido.' };
    }
    if (descripcion.length < 6) {
      return { ok: false, mensaje: 'Describe la incidencia con al menos 6 caracteres.' };
    }
    if (!Number.isInteger(datos.cantidad) || datos.cantidad < 1) {
      return { ok: false, mensaje: 'La cantidad debe ser un entero mayor a cero.' };
    }

    const id = this.consecutivoIncidencia++;
    const incidencia: Incidencia = {
      id,
      folio: `INC-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`,
      preparacionFolio: preparacion.folio,
      pedidoFolio: preparacion.pedidoFolio,
      sku,
      tipo: datos.tipo,
      descripcion,
      cantidad: datos.cantidad,
      fecha: fechaAhoraIso(),
      usuario: 'Operativo (demo)',
      estado: 'ABIERTA',
      resolucion: null,
    };
    this.incidenciasLista.update((actuales) => [incidencia, ...actuales]);
    return {
      ok: true,
      folio: incidencia.folio,
      mensaje: `Incidencia ${incidencia.folio} registrada en la demo, pendiente de resolución.`,
    };
  }

  resolverIncidencia(id: number, resolucion: string, conReposicion: boolean): ResultadoOperacion {
    const incidencia = this.incidenciasLista().find((item) => item.id === id);
    if (!incidencia || incidencia.estado !== 'ABIERTA') {
      return { ok: false, mensaje: 'La incidencia ya no está abierta.' };
    }
    const texto = resolucion.trim();
    if (texto.length < 4) {
      return { ok: false, mensaje: 'Escribe cómo se resolvió la incidencia.' };
    }

    const sinReposicion = incidencia.tipo === 'CALIDAD' && !conReposicion;
    const estado = sinReposicion ? 'PENDIENTE_PRODUCCION' : 'RESUELTA';
    const mensaje = sinReposicion
      ? 'Sin otra unidad disponible: la línea queda pendiente y el pedido regresaría a EN_PRODUCCION (M09/M16, pendiente de Flask). La merma real también requiere integración.'
      : incidencia.tipo === 'CALIDAD'
        ? 'Unidad defectuosa enviada a merma (ALMACEN) y repuesta del inventario en la demo. Los movimientos reales requieren Flask (M17/M15).'
        : 'Incidencia resuelta en la demo. No se persistió ningún movimiento.';

    this.incidenciasLista.update((actuales) =>
      actuales.map((item) => (item.id === id ? { ...item, estado, resolucion: texto } : item)),
    );
    return { ok: true, mensaje };
  }

  private crearIniciales(): Preparacion[] {
    return this.pedidos
      .pedidos()
      .filter((pedido) => pedido.estado === 'EN_PREPARACION' || pedido.estado === 'LISTO_ENVIO')
      .map((pedido) => {
        const detalle = DETALLES_PREPARACION[pedido.folio];
        const terminada = pedido.estado === 'LISTO_ENVIO';
        const surtidas = detalle?.surtidas ?? {};
        const verificado = terminada || detalle?.verificado === true;

        return {
          id: pedido.id,
          folio: pedido.preparacionFolio ?? this.folioDe(pedido.folio),
          pedidoFolio: pedido.folio,
          ventaFolio: pedido.ventaFolio,
          cliente: pedido.cliente,
          prioridad: pedido.prioridad,
          fechaPromesa: pedido.fechaPromesa,
          estado: terminada ? 'LISTA' : 'EN_PICKING',
          tomadaPor: detalle?.tomadaPor ?? 'Operativo (demo)',
          iniciadaEn: pedido.estadoDesde,
          terminadaEn: terminada ? pedido.estadoDesde : null,
          notas: detalle?.nota ?? '',
          direccion: direccionPara(pedido.folio, pedido.cliente),
          lineas: pedido.lineas.map((linea, indice) => {
            const cantidadSurtida = terminada
              ? linea.cantidad
              : Math.min(linea.cantidad, surtidas[linea.sku] ?? 0);
            const completa = cantidadSurtida >= linea.cantidad;
            return {
              id: indice + 1,
              sku: linea.sku,
              nombreProducto: linea.nombreProducto,
              talla: linea.talla,
              color: linea.color,
              cantidadRequerida: linea.cantidad,
              cantidadSurtida,
              skuVerificado: verificado && completa,
              disenoVerificado: verificado && completa,
              etiquetasVerificadas: verificado && completa,
            };
          }),
        };
      });
  }

  private folioDe(pedidoFolio: string): string {
    return `PREP-${pedidoFolio.split('-').at(-1) ?? '0000'}`;
  }

  private actualizarLineas(
    folioPreparacion: string,
    transformar: (lineas: Preparacion['lineas']) => Preparacion['lineas'],
  ): void {
    this.lista.update((actuales) =>
      actuales.map((item) =>
        item.folio === folioPreparacion ? { ...item, lineas: transformar(item.lineas) } : item,
      ),
    );
  }

  private cambiarEstado(folioPreparacion: string, estado: EstadoPreparacion): void {
    this.lista.update((actuales) =>
      actuales.map((item) => (item.folio === folioPreparacion ? { ...item, estado } : item)),
    );
  }
}
