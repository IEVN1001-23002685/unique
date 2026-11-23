import { Injectable, computed, inject, signal } from '@angular/core';
import type { FilaVariante } from '../../productos/modelos/producto-maestro';
import { ProductosServicio } from '../../productos/servicios/productos-servicio';
import type { PendienteProduccion } from '../../pedidos/modelos/pedido';
import { PedidosServicio } from '../../pedidos/servicios/pedidos-servicio';
import { ComprasServicio } from '../../compras/servicios/compras-servicio';
import { InventarioServicio } from '../../inventario/servicios/inventario-servicio';
import {
  ORDENES_SIMULADAS,
  colorDeSku,
  explosionarMateriales,
  hoyISO,
  nombreProductoDeSku,
  redondear4,
} from '../datos-simulados/produccion';
import type {
  CoberturaCompra,
  DatosNuevaOrden,
  EstadoMaterial,
  FilaPlanSugerido,
  FiltroTablero,
  LineaDictamen,
  LineaNuevaOrden,
  LineaOrden,
  MaterialOrden,
  MaterialOrdenVista,
  OpcionVariante,
  OrdenProduccion,
  OrdenVista,
  ResultadoAccion,
  ResultadoCrearOrden,
  ResultadoReserva,
  RevisionCalidad,
  TonoSemaforo,
} from '../modelos/produccion';
import {
  ETIQUETAS_ESTADO,
  ETIQUETAS_ORIGEN,
  ETIQUETAS_TONO,
} from '../modelos/produccion';

export { hoyISO, redondear4 };

const ESTADOS_CERRADOS: OrdenProduccion['estado'][] = ['CERRADA', 'CANCELADA'];
const TOLERANCIA = 0.0001;

/**
 * Estado en memoria de M16. La interfaz pública está pensada para sustituirse
 * por HttpClient contra GET /produccion/ordenes y /{id}, POST /ordenes,
 * /reservar, /solicitar-compra, /iniciar, /revision, /dictamen, /cancelar y
 * GET /plan-sugerido (§9 y §10). Nada persiste en servidor: reservar no escribe
 * M15, solicitar no crea la requisición en M14 y dictaminar no alta unidades en
 * M12 ni una merma en M17. Esas fronteras se muestran como limitación en la UI.
 */
@Injectable({ providedIn: 'root' })
export class ProduccionServicio {
  private readonly inventario = inject(InventarioServicio);
  private readonly compras = inject(ComprasServicio);
  private readonly pedidos = inject(PedidosServicio);
  private readonly productos = inject(ProductosServicio);

  private readonly lista = signal<OrdenProduccion[]>(structuredClone(ORDENES_SIMULADAS));
  private readonly listaRevisiones = signal<RevisionCalidad[]>([]);
  private correlativoOrdenes = 142;
  private correlativoRevisiones = 0;

  readonly ordenes = this.lista.asReadonly();
  readonly revisiones = this.listaRevisiones.asReadonly();

  /** Proyecciones derivadas: semáforo, faltantes y métricas se recalculan solos. */
  readonly vistas = computed<OrdenVista[]>(() => this.lista().map((orden) => this.proyectar(orden)));

  private proyectar(orden: OrdenProduccion): OrdenVista {
    const hoy = hoyISO();
    const materiales = orden.materiales.map((material) => this.proyectarMaterial(material));
    const completos = materiales.filter((material) => material.estadoMaterial === 'COMPLETO').length;
    const faltantes = materiales.filter((material) => material.faltante > TOLERANCIA);
    const vencida =
      orden.fechaRequerida !== null &&
      orden.fechaRequerida < hoy &&
      !ESTADOS_CERRADOS.includes(orden.estado);
    const ocRetrasada = faltantes.some((material) => material.cobertura === 'RETRASADA');
    const sinCobertura = faltantes.some((material) => material.cobertura === 'NINGUNA');

    let semaforo: TonoSemaforo = 'VERDE';
    let motivoSemaforo = 'Todos los materiales están reservados y la orden va en tiempo.';
    if (orden.estado === 'CANCELADA') {
      semaforo = 'ROJO';
      motivoSemaforo = 'La orden fue cancelada; no debe reanudarse sin una orden nueva.';
    } else if (vencida) {
      semaforo = 'ROJO';
      motivoSemaforo = 'Venció la fecha requerida sin que la orden se cerrara.';
    } else if (ocRetrasada) {
      semaforo = 'ROJO';
      motivoSemaforo = 'Falta material y la orden de compra que lo cubre está retrasada.';
    } else if (sinCobertura) {
      semaforo = 'ROJO';
      motivoSemaforo = 'Falta material sin requisición ni orden de compra vigente.';
    } else if (faltantes.length > 0) {
      semaforo = 'AMBAR';
      motivoSemaforo = 'Falta material, pero existe una requisición u orden de compra vigente.';
    }

    const unidadesPlaneadas = orden.lineas.reduce(
      (suma, linea) => suma + linea.cantidadPlaneada,
      0,
    );
    const unidadesAprobadas = orden.lineas.reduce(
      (suma, linea) => suma + linea.cantidadAprobada,
      0,
    );
    const unidadesMerma = orden.lineas.reduce((suma, linea) => suma + linea.cantidadMerma, 0);

    return {
      ...orden,
      materiales,
      materialesCompletos: completos,
      vencida,
      semaforo,
      motivoSemaforo,
      unidadesPlaneadas,
      unidadesAprobadas,
      unidadesMerma,
      cumplimientoPct:
        unidadesPlaneadas > 0 ? redondear4((unidadesAprobadas / unidadesPlaneadas) * 100) : 0,
      mermaRealPct:
        unidadesAprobadas + unidadesMerma > 0
          ? redondear4((unidadesMerma / (unidadesAprobadas + unidadesMerma)) * 100)
          : 0,
    };
  }

  private proyectarMaterial(material: MaterialOrden): MaterialOrdenVista {
    const existencia = this.inventario
      .vistas()
      .find((item) => item.materialId === material.materialId && item.color === material.color);
    const disponibleM15 = existencia?.disponible ?? 0;
    const faltante = redondear4(
      Math.max(0, material.cantidadRequerida - material.cantidadReservada),
    );

    let estadoMaterial: EstadoMaterial = 'FALTANTE';
    if (faltante <= TOLERANCIA) {
      estadoMaterial = 'COMPLETO';
    } else if (material.cantidadReservada > TOLERANCIA) {
      estadoMaterial = 'PARCIAL';
    }

    const cobertura = faltante > TOLERANCIA ? this.coberturaDeCompra(material) : 'NINGUNA';
    const etiquetaCobertura: Record<CoberturaCompra, string> = {
      REQUISICION: 'Requisición vigente',
      ORDEN_COMPRA: 'Orden de compra vigente',
      RETRASADA: 'Orden de compra retrasada',
      NINGUNA: faltante > TOLERANCIA ? 'Sin cobertura de compra' : 'No requerida',
    };
    const semaforo: TonoSemaforo =
      estadoMaterial === 'COMPLETO'
        ? 'VERDE'
        : cobertura === 'NINGUNA' || cobertura === 'RETRASADA'
          ? 'ROJO'
          : 'AMBAR';

    return {
      ...material,
      disponibleM15: redondear4(disponibleM15),
      faltante,
      estadoMaterial,
      semaforo,
      cobertura,
      etiquetaCobertura: etiquetaCobertura[cobertura],
    };
  }

  /** Consulta de solo lectura a M14: la orden retrasada tiene prioridad sobre la requisición. */
  private coberturaDeCompra(material: MaterialOrden): CoberturaCompra {
    const hoy = hoyISO();
    const requisicion = this.compras.requisiciones().some(
      (item) =>
        !['ATENDIDA', 'CANCELADA'].includes(item.estado) &&
        item.lineas.some(
          (linea) =>
            linea.materialId === material.materialId &&
            (linea.color === null || linea.color === material.color),
        ),
    );
    const ordenes = this.compras.ordenes().filter(
      (item) =>
        ['EMITIDA', 'PARCIAL'].includes(item.estado) &&
        item.lineas.some((linea) => linea.materialId === material.materialId),
    );
    const retrasada = ordenes.some(
      (item) => item.fechaPrometida !== null && item.fechaPrometida < hoy,
    );

    if (retrasada) {
      return 'RETRASADA';
    }
    if (ordenes.length > 0) {
      return 'ORDEN_COMPRA';
    }
    return requisicion ? 'REQUISICION' : 'NINGUNA';
  }

  private disponibleEnM15(materialId: number, color: string): number {
    const existencia = this.inventario
      .vistas()
      .find((item) => item.materialId === materialId && item.color === color);
    return existencia?.disponible ?? 0;
  }

  vistaPorId(id: number): OrdenVista | undefined {
    return this.vistas().find((orden) => orden.id === id);
  }

  filtrar(tab: FiltroTablero, texto: string): OrdenVista[] {
    const busqueda = texto.trim().toLocaleLowerCase('es-MX');
    return this.vistas().filter((orden) => {
      switch (tab) {
        case 'ROJAS':
          if (orden.semaforo !== 'ROJO') {
            return false;
          }
          break;
        case 'AMBAR':
          if (orden.semaforo !== 'AMBAR') {
            return false;
          }
          break;
        case 'VERDES':
          if (orden.semaforo !== 'VERDE') {
            return false;
          }
          break;
        case 'EN_PROCESO':
          if (orden.estado !== 'EN_PROCESO') {
            return false;
          }
          break;
        case 'EN_REVISION':
          if (orden.estado !== 'EN_REVISION') {
            return false;
          }
          break;
        case 'CERRADAS':
          if (orden.estado !== 'CERRADA') {
            return false;
          }
          break;
        case 'TODAS':
          break;
      }

      if (busqueda === '') {
        return true;
      }
      return [
        orden.folio,
        ETIQUETAS_ORIGEN[orden.origen],
        ETIQUETAS_ESTADO[orden.estado],
        ETIQUETAS_TONO[orden.semaforo],
        ...orden.lineas.map((linea) => linea.sku),
      ]
        .join(' ')
        .toLocaleLowerCase('es-MX')
        .includes(busqueda);
    });
  }

  indicadores() {
    const vistas = this.vistas();
    const vigentes = vistas.filter((orden) => !ESTADOS_CERRADOS.includes(orden.estado));
    const consideradas = vistas.filter((orden) => orden.estado !== 'CANCELADA');
    const planeadas = consideradas.reduce((suma, orden) => suma + orden.unidadesPlaneadas, 0);
    const aprobadas = consideradas.reduce((suma, orden) => suma + orden.unidadesAprobadas, 0);
    const mermas = consideradas.reduce((suma, orden) => suma + orden.unidadesMerma, 0);

    return {
      abiertas: vigentes.length,
      rojas: vigentes.filter((orden) => orden.semaforo === 'ROJO').length,
      cumplimientoPct: planeadas > 0 ? redondear4((aprobadas / planeadas) * 100) : 0,
      mermaRealPct: aprobadas + mermas > 0 ? redondear4((mermas / (aprobadas + mermas)) * 100) : 0,
    };
  }

  /** Unión de variantes activas de M10 con SKU con demanda en M09. */
  variantesDisponibles(): OpcionVariante[] {
    const opciones = new Map<string, OpcionVariante>();

    for (const fila of this.productos.filasVariantes()) {
      if (!fila.variante.activa) {
        continue;
      }
      opciones.set(fila.variante.sku, {
        varianteId: fila.variante.id,
        sku: fila.variante.sku,
        nombreProducto: fila.productoNombre,
        talla: this.productos.nombreTalla(fila.variante.talla),
        color: this.productos.nombreColor(fila.variante.color),
        origen: 'M10',
      });
    }

    let varianteTemporal = -1;
    for (const pendiente of this.pedidos.pendientesProduccion()) {
      if (opciones.has(pendiente.sku)) {
        continue;
      }
      opciones.set(pendiente.sku, {
        varianteId: varianteTemporal--,
        sku: pendiente.sku,
        nombreProducto: pendiente.nombreProducto,
        talla: pendiente.talla,
        color: pendiente.color,
        origen: 'M09',
      });
    }

    return [...opciones.values()].sort((a, b) => a.sku.localeCompare(b.sku, 'es-MX'));
  }

  pedidosDeOrden(orden: OrdenVista): PendienteProduccion[] {
    const skus = new Set(orden.lineas.map((linea) => linea.sku));
    return this.pedidos.pendientesProduccion().filter((pendiente) => skus.has(pendiente.sku));
  }

  explosionEstimada(sku: string, unidades: number): MaterialOrden[] {
    if (!Number.isInteger(unidades) || unidades <= 0) {
      return [];
    }
    return explosionarMateriales(sku, unidades);
  }

  crearOrden(
    datos: DatosNuevaOrden,
    origen: OrdenProduccion['origen'] = 'MANUAL',
  ): ResultadoCrearOrden {
    const lineasValidas = datos.lineas.filter(
      (linea) =>
        Number.isInteger(linea.cantidad) &&
        linea.cantidad > 0 &&
        linea.sku.trim() !== '',
    );
    if (lineasValidas.length === 0) {
      return { ok: false, mensaje: 'Agrega al menos una variante con cantidad entera mayor a cero.' };
    }

    const sumadas: string[] = [];
    const nuevas: LineaNuevaOrden[] = [];
    for (const linea of lineasValidas) {
      const abierta = this.vistas().find(
        (orden) =>
          !ESTADOS_CERRADOS.includes(orden.estado) &&
          orden.lineas.some((item) => item.sku === linea.sku),
      );
      if (abierta) {
        this.sumarDemanda(abierta.id, linea);
        sumadas.push(abierta.folio);
      } else {
        nuevas.push(linea);
      }
    }

    if (nuevas.length === 0) {
      const lista = [...new Set(sumadas)].join(', ');
      return {
        ok: true,
        mensaje: `La demanda se sumó a la orden abierta ${lista}. No se creó una orden duplicada.`,
        sumadaA: [...new Set(sumadas)][0],
      };
    }

    const id = this.lista().reduce((maximo, item) => Math.max(maximo, item.id), 0) + 1;
    const folio = `OP-${new Date().getFullYear()}-${String(++this.correlativoOrdenes).padStart(4, '0')}`;
    const lineas: LineaOrden[] = nuevas.map((linea, indice) => ({
      id: id * 100 + indice + 1,
      sku: linea.sku,
      nombreProducto: linea.nombreProducto || nombreProductoDeSku(linea.sku),
      talla: linea.sku.split('-')[1] ?? 'UN',
      color: colorDeSku(linea.sku),
      cantidadPlaneada: linea.cantidad,
      cantidadAprobada: 0,
      cantidadMerma: 0,
      cantidadReproceso: 0,
    }));
    const materiales = nuevas
      .flatMap((linea) => explosionarMateriales(linea.sku, linea.cantidad, 'todos'))
      .map((material, indice): MaterialOrden => ({ ...material, id: id * 100 + indice + 1 }));

    const orden: OrdenProduccion = {
      id,
      folio,
      origen,
      estado: 'PLANEADA',
      fechaRequerida: datos.fechaRequerida && datos.fechaRequerida !== '' ? datos.fechaRequerida : null,
      iniciadaEn: null,
      cerradaEn: null,
      creadaPor: 'Operativo · demostración',
      notas: datos.notas.trim() === '' ? null : datos.notas.trim(),
      lineas,
      materiales,
    };
    this.lista.update((actuales) => [...actuales, orden]);

    const avisoDuplicado =
      sumadas.length > 0
        ? ` El resto se sumó a ${[...new Set(sumadas)].join(', ')} para evitar duplicados.`
        : '';
    return {
      ok: true,
      mensaje: `Orden ${folio} creada en estado PLANEADA.${avisoDuplicado}`,
      folio,
    };
  }

  /** Suma la nueva demanda a una orden abierta del mismo SKU (regla de M16). */
  private sumarDemanda(ordenId: number, linea: LineaNuevaOrden): void {
    const extras = explosionarMateriales(linea.sku, linea.cantidad, 'todos');
    this.lista.update((actuales) =>
      actuales.map((orden) => {
        if (orden.id !== ordenId) {
          return orden;
        }
        const existente = orden.lineas.find((item) => item.sku === linea.sku);
        const lineas = existente
          ? orden.lineas.map((item) =>
              item.sku === linea.sku
                ? { ...item, cantidadPlaneada: item.cantidadPlaneada + linea.cantidad }
                : item,
            )
          : [
              ...orden.lineas,
              {
                id: orden.lineas.reduce((maximo, item) => Math.max(maximo, item.id), 0) + 1,
                sku: linea.sku,
                nombreProducto: linea.nombreProducto || nombreProductoDeSku(linea.sku),
                talla: linea.sku.split('-')[1] ?? 'UN',
                color: colorDeSku(linea.sku),
                cantidadPlaneada: linea.cantidad,
                cantidadAprobada: 0,
                cantidadMerma: 0,
                cantidadReproceso: 0,
              },
            ];

        const materiales = [...orden.materiales];
        for (const extra of extras) {
          const actual = materiales.find(
            (item) => item.materialId === extra.materialId && item.color === extra.color,
          );
          if (actual) {
            const indice = materiales.indexOf(actual);
            materiales[indice] = {
              ...actual,
              cantidadRequerida: redondear4(
                actual.cantidadRequerida + extra.cantidadRequerida,
              ),
            };
          } else {
            materiales.push({
              ...extra,
              id: materiales.reduce((maximo, item) => Math.max(maximo, item.id), 0) + 1,
            });
          }
        }

        return { ...orden, lineas, materiales };
      }),
    );
  }

  reservar(id: number): ResultadoReserva {
    const orden = this.lista().find((item) => item.id === id);
    if (!orden) {
      return { ok: false, mensaje: 'No se encontró la orden.', materialesReservados: 0, materialesCompletos: 0 };
    }
    if (!['PLANEADA', 'LISTA'].includes(orden.estado)) {
      return {
        ok: false,
        mensaje: 'Solo se pueden reservar materiales en órdenes PLANEADA o LISTA.',
        materialesReservados: 0,
        materialesCompletos: 0,
      };
    }

    let reservados = 0;
    this.lista.update((actuales) =>
      actuales.map((item) => {
        if (item.id !== id) {
          return item;
        }
        const materiales = item.materiales.map((material) => {
          const pendiente = redondear4(material.cantidadRequerida - material.cantidadReservada);
          if (pendiente <= TOLERANCIA) {
            return material;
          }
          const disponible = this.disponibleEnM15(material.materialId, material.color);
          const tomar = redondear4(Math.min(pendiente, Math.max(0, disponible)));
          if (tomar <= TOLERANCIA) {
            return material;
          }
          reservados += 1;
          return {
            ...material,
            cantidadReservada: redondear4(material.cantidadReservada + tomar),
          };
        });
        const completa = materiales.every(
          (material) => material.cantidadRequerida - material.cantidadReservada <= TOLERANCIA,
        );
        return {
          ...item,
          materiales,
          estado: completa ? ('LISTA' as const) : item.estado,
        };
      }),
    );

    const vista = this.vistaPorId(id);
    const completos = vista?.materialesCompletos ?? 0;
    const total = vista?.materiales.length ?? 0;
    if (reservados === 0) {
      return {
        ok: false,
        mensaje: 'No hay disponible en M15 para reservar; revisa la cobertura de compra.',
        materialesReservados: 0,
        materialesCompletos: completos,
      };
    }
    return {
      ok: true,
      mensaje:
        completos === total
          ? `Materiales completos (${completos}/${total}). La orden pasó a LISTA.`
          : `Se reservaron ${reservados} materiales; faltan ${total - completos} por cubrir.`,
      materialesReservados: reservados,
      materialesCompletos: completos,
    };
  }

  solicitarCompra(id: number) {
    const vista = this.vistaPorId(id);
    if (!vista) {
      return [];
    }
    return vista.materiales
      .filter((material) => material.faltante > TOLERANCIA)
      .map((material) => ({
        materialId: material.materialId,
        nombreMaterial: material.nombreMaterial,
        color: material.color,
        unidadBase: material.unidadBase,
        faltante: material.faltante,
        tieneRequisicion: material.cobertura === 'REQUISICION',
        tieneOrdenCompra: material.cobertura === 'ORDEN_COMPRA',
        ordenRetrasada: material.cobertura === 'RETRASADA',
      }));
  }

  iniciar(id: number): ResultadoAccion {
    const vista = this.vistaPorId(id);
    if (!vista) {
      return { ok: false, mensaje: 'No se encontró la orden.' };
    }
    if (vista.estado !== 'LISTA') {
      return { ok: false, mensaje: 'La orden debe estar en LISTA para iniciar producción.' };
    }

    const cambio = vista.materiales.find(
      (material) =>
        this.disponibleEnM15(material.materialId, material.color) + material.cantidadReservada + TOLERANCIA <
        material.cantidadRequerida,
    );
    if (cambio) {
      return {
        ok: false,
        mensaje: `Las existencias de ${cambio.nombreMaterial} cambiaron desde la reserva. No se consumió nada; reserva de nuevo.`,
      };
    }

    this.lista.update((actuales) =>
      actuales.map((orden) =>
        orden.id === id
          ? {
              ...orden,
              estado: 'EN_PROCESO' as const,
              iniciadaEn: hoyISO(),
              materiales: orden.materiales.map((material) => ({
                ...material,
                cantidadConsumida: material.cantidadReservada,
              })),
            }
          : orden,
      ),
    );
    return {
      ok: true,
      mensaje:
        'Producción iniciada. El consumo PEPS con costo real de lote y la reversión atómica quedan pendientes de Flask.',
    };
  }

  enviarRevision(id: number): ResultadoAccion {
    const vista = this.vistaPorId(id);
    if (!vista) {
      return { ok: false, mensaje: 'No se encontró la orden.' };
    }
    if (vista.estado !== 'EN_PROCESO') {
      return { ok: false, mensaje: 'Solo se puede enviar a revisión una orden EN_PROCESO.' };
    }
    this.lista.update((actuales) =>
      actuales.map((orden) =>
        orden.id === id ? { ...orden, estado: 'EN_REVISION' as const } : orden,
      ),
    );
    return { ok: true, mensaje: `Orden ${vista.folio} enviada a revisión de calidad.` };
  }

  dictaminar(id: number, lineas: LineaDictamen[]): ResultadoAccion {
    const orden = this.lista().find((item) => item.id === id);
    if (!orden || orden.estado !== 'EN_REVISION') {
      return { ok: false, mensaje: 'La orden no está disponible para dictamen.' };
    }
    if (lineas.length !== orden.lineas.length) {
      return { ok: false, mensaje: 'Falta dictaminar una o más líneas.' };
    }

    const porLinea = new Map(lineas.map((linea) => [linea.lineaId, linea]));
    for (const lineaOrden of orden.lineas) {
      const dictamen = porLinea.get(lineaOrden.id);
      // El reproceso vuelve a revisión: sigue pendiente hasta aprobarse o mermarse.
      const pendiente =
        lineaOrden.cantidadPlaneada -
        lineaOrden.cantidadAprobada -
        lineaOrden.cantidadMerma;
      if (!dictamen) {
        return { ok: false, mensaje: `Falta el dictamen de ${lineaOrden.sku}.` };
      }
      if (
        !dictamen.medidasOk ||
        !dictamen.costurasOk ||
        !dictamen.bordadoOk ||
        !dictamen.etiquetasOk
      ) {
        return {
          ok: false,
          mensaje: `Completa la lista de verificación de ${lineaOrden.sku} antes de dictaminar.`,
        };
      }
      const total =
        dictamen.cantidadAprobada + dictamen.cantidadMerma + dictamen.cantidadReproceso;
      if (dictamen.cantidadRevisada > pendiente + TOLERANCIA || total > dictamen.cantidadRevisada + TOLERANCIA) {
        return {
          ok: false,
          mensaje: `Las cantidades de ${lineaOrden.sku} no pueden superar lo revisado ni lo pendiente.`,
        };
      }
      if (dictamen.cantidadMerma > 0 && dictamen.causaMerma.trim() === '') {
        return { ok: false, mensaje: `Indica la causa de la merma en ${lineaOrden.sku}.` };
      }
    }

    let aprobadas = 0;
    let mermas = 0;
    let reprocesos = 0;
    this.lista.update((actuales) =>
      actuales.map((item) => {
        if (item.id !== id) {
          return item;
        }
        const lineasActualizadas = item.lineas.map((linea) => {
          const dictamen = porLinea.get(linea.id);
          if (!dictamen) {
            return linea;
          }
          aprobadas += dictamen.cantidadAprobada;
          mermas += dictamen.cantidadMerma;
          reprocesos += dictamen.cantidadReproceso;
          return {
            ...linea,
            cantidadAprobada: linea.cantidadAprobada + dictamen.cantidadAprobada,
            cantidadMerma: linea.cantidadMerma + dictamen.cantidadMerma,
            // Se reemplaza: el reproceso anterior ya fue revisado en este ciclo.
            cantidadReproceso: dictamen.cantidadReproceso,
          };
        });
        const planeadas = lineasActualizadas.reduce(
          (suma, linea) => suma + linea.cantidadPlaneada,
          0,
        );
        const aprobadasFinales = lineasActualizadas.reduce(
          (suma, linea) => suma + linea.cantidadAprobada,
          0,
        );
        const mermasFinales = lineasActualizadas.reduce(
          (suma, linea) => suma + linea.cantidadMerma,
          0,
        );
        const estado: OrdenProduccion['estado'] =
          reprocesos > 0
            ? 'EN_PROCESO'
            : aprobadasFinales + mermasFinales >= planeadas - TOLERANCIA
              ? 'CERRADA'
              : 'EN_REVISION';
        return {
          ...item,
          lineas: lineasActualizadas,
          estado,
          cerradaEn: estado === 'CERRADA' ? hoyISO() : item.cerradaEn,
        };
      }),
    );

    const revision: RevisionCalidad = {
      id: this.listaRevisiones().length + 1,
      folio: `REV-${new Date().getFullYear()}-${String(++this.correlativoRevisiones).padStart(4, '0')}`,
      ordenId: id,
      ordenFolio: orden.folio,
      fecha: hoyISO(),
      revisadaPor: 'Operativo · demostración',
      lineas: structuredClone(lineas),
    };
    this.listaRevisiones.update((actuales) => [revision, ...actuales]);

    const notaMerma =
      mermas > 0
        ? ` ${mermas} unidad(es) en merma: M17 registraría la causa y la etapa cuando exista Flask.`
        : '';
    const notaReproceso = reprocesos > 0 ? ' El reproceso devolvió la orden a EN_PROCESO.' : '';
    return {
      ok: true,
      mensaje: `Dictamen guardado: ${aprobadas} aprobadas.${notaReproceso}${notaMerma} El alta en M12 y su asignación FIFO a pedidos quedan pendientes de Flask.`,
    };
  }

  cancelar(id: number): ResultadoAccion {
    const vista = this.vistaPorId(id);
    if (!vista) {
      return { ok: false, mensaje: 'No se encontró la orden.' };
    }
    if (!['PLANEADA', 'LISTA'].includes(vista.estado)) {
      return {
        ok: false,
        mensaje: 'Solo se puede cancelar una orden en PLANEADA o LISTA.',
      };
    }
    this.lista.update((actuales) =>
      actuales.map((orden) =>
        orden.id === id ? { ...orden, estado: 'CANCELADA' as const } : orden,
      ),
    );
    return {
      ok: true,
      mensaje: `Orden ${vista.folio} cancelada. La liberación de reservas en M15 corresponde a Flask.`,
    };
  }

  /** Plan sugerido: mayor entre demanda no cubierta y reposición si está en el mínimo. */
  planSugerido(): FilaPlanSugerido[] {
    const skus = new Set<string>();
    for (const opcion of this.variantesDisponibles()) {
      skus.add(opcion.sku);
    }
    const pendientes = this.pedidos.pendientesProduccion();
    for (const pendiente of pendientes) {
      skus.add(pendiente.sku);
    }

    const opcionesPorSku = new Map(this.variantesDisponibles().map((item) => [item.sku, item]));
    const filasPorVariante = new Map<string, FilaVariante>(
      this.productos.filasVariantes().map((fila) => [fila.variante.sku, fila]),
    );
    const abiertas = this.vistas().filter((orden) => !ESTADOS_CERRADOS.includes(orden.estado));

    const filas: FilaPlanSugerido[] = [...skus].map((sku) => {
      const opcion = opcionesPorSku.get(sku);
      const variante = filasPorVariante.get(sku)?.variante;
      const demanda = pendientes.find((pendiente) => pendiente.sku === sku);
      const disponible = Math.max(0, (variante?.existencia ?? 0) - (variante?.reservado ?? 0));
      const minimo = variante?.stockMinimo ?? 0;
      const cantidadReposicion = disponible <= minimo ? (variante?.cantidadReposicion ?? 0) : 0;
      const produccionEnCurso = abiertas
        .flatMap((orden) => orden.lineas)
        .filter((linea) => linea.sku === sku)
        .reduce(
          (suma, linea) =>
            suma +
            Math.max(0, linea.cantidadPlaneada - linea.cantidadAprobada - linea.cantidadMerma),
          0,
        );
      const pendienteNoCubierto = redondear4(
        Math.max(0, (demanda?.demanda ?? 0) - produccionEnCurso - disponible),
      );
      const ordenAbierta = abiertas.find((orden) =>
        orden.lineas.some((linea) => linea.sku === sku),
      );

      return {
        sku,
        nombreProducto: opcion?.nombreProducto ?? demanda?.nombreProducto ?? nombreProductoDeSku(sku),
        talla: opcion?.talla ?? demanda?.talla ?? 'UN',
        color: opcion?.color ?? demanda?.color ?? colorDeSku(sku),
        disponible: redondear4(disponible),
        minimo,
        pendientePedidos: demanda?.demanda ?? 0,
        pedidos: demanda?.pedidos ?? [],
        produccionEnCurso,
        pendienteNoCubierto,
        cantidadReposicion,
        cantidadSugerida: Math.max(pendienteNoCubierto, cantidadReposicion),
        ordenAbiertaFolio: ordenAbierta?.folio ?? null,
      };
    });

    return filas.sort(
      (a, b) => b.cantidadSugerida - a.cantidadSugerida || a.sku.localeCompare(b.sku, 'es-MX'),
    );
  }
}
