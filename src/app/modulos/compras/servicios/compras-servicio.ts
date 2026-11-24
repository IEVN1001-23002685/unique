import { Injectable, computed, inject, signal } from '@angular/core';
import type { MaterialProveedor } from '../../proveedores/modelos/proveedor';
import { ProveedoresServicio } from '../../proveedores/servicios/proveedores-servicio';
import {
  COTIZACIONES_SIMULADAS,
  MATERIALES_COMPRA,
  ORDENES_SIMULADAS,
  RECEPCIONES_SIMULADAS,
  REQUISICIONES_SIMULADAS,
} from '../datos-simulados/compras';
import type {
  Cotizacion,
  DatosRecepcion,
  LineaCotizacion,
  LineaOrdenCompra,
  LineaRecepcion,
  LoteDemostracion,
  MermaDemostracion,
  OrdenCompra,
  Recepcion,
  ResultadoRecepcion,
  Requisicion,
} from '../modelos/compra';

export function redondear4(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10000) / 10000;
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
  const resultado = new Date(`${fecha}T12:00:00`);
  resultado.setDate(resultado.getDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

/**
 * Estado en memoria de M14. La interfaz pública está pensada para sustituirse
 * por HttpClient contra /requisiciones, /cotizaciones, /ordenes-compra y
 * /recepciones (§9). Nada de lo que ocurre aquí persiste en servidor: los
 * lotes y mermas que se muestran son solo una vista previa para la interfaz.
 */
@Injectable({ providedIn: 'root' })
export class ComprasServicio {
  private readonly proveedores = inject(ProveedoresServicio);

  private readonly listaRequisiciones = signal<Requisicion[]>(
    structuredClone(REQUISICIONES_SIMULADAS),
  );
  private readonly listaCotizaciones = signal<Cotizacion[]>(
    structuredClone(COTIZACIONES_SIMULADAS),
  );
  private readonly listaOrdenes = signal<OrdenCompra[]>(structuredClone(ORDENES_SIMULADAS));
  private readonly listaRecepciones = signal<Recepcion[]>(structuredClone(RECEPCIONES_SIMULADAS));
  private correlativoLotes = 0;

  readonly requisiciones = this.listaRequisiciones.asReadonly();
  readonly cotizaciones = this.listaCotizaciones.asReadonly();
  readonly ordenes = this.listaOrdenes.asReadonly();
  readonly recepciones = this.listaRecepciones.asReadonly();
  readonly materiales = MATERIALES_COMPRA;
  readonly proveedoresDisponibles = computed(() =>
    this.proveedores.proveedores().filter((proveedor) => proveedor.estatus !== 'INACTIVO'),
  );

  obtenerMaterial(id: number) {
    return this.materiales.find((material) => material.id === id);
  }

  proveedorNombre(id: number): string {
    return this.proveedores.obtenerPorId(id)?.nombreComercial ?? 'Proveedor no disponible';
  }

  condicionesProveedor(id: number): string {
    return this.proveedores.obtenerPorId(id)?.condicionesPago ?? 'Contado';
  }

  /**
   * Cobertura leída de M13; M14 no copia ni modifica sus reglas.
   * El identificador del proveedor se deriva del padrón porque la línea de
   * proveedor_material no lo expone en el modelo de M13.
   */
  coberturaMaterial(materialId: number): (MaterialProveedor & { proveedorId: number })[] {
    const opciones: (MaterialProveedor & { proveedorId: number })[] = [];
    for (const proveedor of this.proveedores.proveedores()) {
      if (proveedor.estatus === 'INACTIVO') {
        continue;
      }
      for (const material of proveedor.materiales) {
        if (material.activo && material.materialId === materialId) {
          opciones.push({ ...material, proveedorId: proveedor.id });
        }
      }
    }
    return opciones;
  }

  /** Cantidad en presentación comercial: redondeo hacia arriba y mínimo. */
  cantidadPresentaciones(materialId: number, faltanteBase: number): number {
    const material = this.obtenerMaterial(materialId);
    if (!material || !(faltanteBase > 0)) {
      return 0;
    }
    const necesario = Math.ceil(faltanteBase / material.factorPresentacion);
    return Math.max(material.minimoCompra, necesario);
  }

  basePresentaciones(materialId: number, presentaciones: number): number {
    const material = this.obtenerMaterial(materialId);
    return material ? redondear4(presentaciones * material.factorPresentacion) : 0;
  }

  obtenerRequisicion(id: number): Requisicion | undefined {
    return this.requisiciones().find((requisicion) => requisicion.id === id);
  }

  guardarRequisicion(datos: Requisicion): Requisicion {
    const requisicion = structuredClone(datos);
    requisicion.lineas = requisicion.lineas.map((linea, indice) => ({
      ...linea,
      id: linea.id || requisicion.id * 100 + indice + 1,
      cantidadCompraSugerida: Math.max(1, Math.floor(linea.cantidadCompraSugerida)),
    }));

    if (requisicion.id === 0) {
      requisicion.id = this.siguienteId(this.requisiciones());
      requisicion.folio = this.siguienteFolio('REQ', this.requisiciones());
      requisicion.fecha = hoyISO();
      requisicion.estado = 'PENDIENTE';
      this.listaRequisiciones.update((actuales) => [...actuales, requisicion]);
      return requisicion;
    }

    this.listaRequisiciones.update((actuales) =>
      actuales.map((actual) => (actual.id === requisicion.id ? requisicion : actual)),
    );
    return requisicion;
  }

  cancelarRequisicion(id: number): void {
    this.listaRequisiciones.update((actuales) =>
      actuales.map((actual) =>
        actual.id === id ? { ...actual, estado: 'CANCELADA' as const } : actual,
      ),
    );
  }

  /** Comparador: al menos dos proveedores cuando el material tiene alterno. */
  generarCotizaciones(requisicionId: number): { cantidad: number; conAlterno: boolean } | null {
    const requisicion = this.obtenerRequisicion(requisicionId);
    if (!requisicion || requisicion.lineas.length === 0 || requisicion.estado === 'CANCELADA') {
      return null;
    }

    const porProveedor = new Map<number, LineaCotizacion[]>();
    let conAlterno = false;
    let idLinea = 1;

    for (const lineaReq of requisicion.lineas) {
      const opciones = this.coberturaMaterial(lineaReq.materialId);
      conAlterno ||= opciones.length > 1;

      const seleccionadas = [
        ...opciones.filter((opcion) => opcion.esPrincipal).slice(0, 1),
        ...opciones.filter((opcion) => !opcion.esPrincipal).slice(0, 1),
      ];
      if (seleccionadas.length === 0) {
        seleccionadas.push(...opciones.slice(0, 1));
      }

      for (const opcion of seleccionadas) {
        const cantidad = Math.max(lineaReq.cantidadCompraSugerida, opcion.minimoCompra);
        const lineas = porProveedor.get(opcion.proveedorId) ?? [];
        lineas.push({
          id: idLinea++,
          requisicionLineaId: lineaReq.id,
          cantidadCompra: cantidad,
          precioUnitarioCompra: opcion.precioCompra,
          subtotal: redondear4(cantidad * opcion.precioCompra),
        });
        porProveedor.set(opcion.proveedorId, lineas);
      }
    }

    if (porProveedor.size === 0) {
      return null;
    }

    const fecha = hoyISO();
    let correlativo = this.siguienteId(this.cotizaciones());
    const nuevas: Cotizacion[] = [];

    for (const [proveedorId, lineas] of porProveedor) {
      const plazos = this.coberturaMaterial(requisicion.lineas[0].materialId)
        .filter((opcion) => opcion.proveedorId === proveedorId)
        .map((opcion) => opcion.plazoDias);
      nuevas.push({
        id: correlativo,
        folio: `COT-${new Date().getFullYear()}-${String(correlativo).padStart(4, '0')}`,
        requisicionId,
        proveedorId,
        fecha,
        vigenciaHasta: '2027-12-31',
        plazoDias: plazos.length > 0 ? Math.min(...plazos) : 7,
        estado: 'PENDIENTE',
        total: redondear4(lineas.reduce((suma, linea) => suma + linea.subtotal, 0)),
        notas: 'Cotización generada para la demostración; pendiente de Flask.',
        lineas,
      });
      correlativo += 1;
    }

    this.listaCotizaciones.update((actuales) => [
      ...actuales.filter((cotizacion) => cotizacion.requisicionId !== requisicionId),
      ...nuevas,
    ]);
    this.listaRequisiciones.update((actuales) =>
      actuales.map((actual) =>
        actual.id === requisicionId ? { ...actual, estado: 'EN_COTIZACION' as const } : actual,
      ),
    );

    return { cantidad: nuevas.length, conAlterno };
  }

  elegirCotizacion(cotizacionId: number): OrdenCompra | null {
    const cotizacion = this.cotizaciones().find((item) => item.id === cotizacionId);
    if (!cotizacion) {
      return null;
    }
    const requisicion = this.obtenerRequisicion(cotizacion.requisicionId);
    if (!requisicion) {
      return null;
    }

    const lineas: LineaOrdenCompra[] = cotizacion.lineas.map((linea, indice) => {
      const lineaReq = requisicion.lineas.find((item) => item.id === linea.requisicionLineaId);
      const materialId = lineaReq?.materialId ?? 0;
      return {
        id: cotizacion.id * 100 + indice + 1,
        materialId,
        cantidadCompra: linea.cantidadCompra,
        cantidadBasePedida: this.basePresentaciones(materialId, linea.cantidadCompra),
        precioUnitarioCompra: linea.precioUnitarioCompra,
        subtotal: linea.subtotal,
        cantidadBaseAceptada: 0,
      };
    });

    const orden = this.crearOrden({
      proveedorId: cotizacion.proveedorId,
      requisicionId: requisicion.id,
      cotizacionId: cotizacion.id,
      lineas,
      fechaPrometida: sumarDias(hoyISO(), cotizacion.plazoDias),
      notas: `Generada desde ${cotizacion.folio}. Precio pactado conservado.`,
    });

    this.listaCotizaciones.update((actuales) =>
      actuales.map((actual) =>
        actual.requisicionId !== cotizacion.requisicionId
          ? actual
          : {
              ...actual,
              estado: actual.id === cotizacion.id ? ('ELEGIDA' as const) : ('DESCARTADA' as const),
            },
      ),
    );
    this.marcarCompraEmitida(requisicion.id);
    return orden;
  }

  /** Compra urgente: orden directa al proveedor principal. */
  emitirOrdenDirecta(requisicionId: number): OrdenCompra | null {
    const requisicion = this.obtenerRequisicion(requisicionId);
    if (!requisicion || requisicion.estado === 'CANCELADA') {
      return null;
    }

    const lineas: LineaOrdenCompra[] = [];
    let proveedorId = 0;

    for (const [indice, lineaReq] of requisicion.lineas.entries()) {
      const opciones = this.coberturaMaterial(lineaReq.materialId);
      const opcion = opciones.find((item) => item.esPrincipal) ?? opciones[0] ?? undefined;
      if (!opcion) {
        continue;
      }
      proveedorId ||= opcion.proveedorId;
      const cantidad = Math.max(lineaReq.cantidadCompraSugerida, opcion.minimoCompra);
      lineas.push({
        id: requisicion.id * 100 + indice + 1,
        materialId: lineaReq.materialId,
        cantidadCompra: cantidad,
        cantidadBasePedida: this.basePresentaciones(lineaReq.materialId, cantidad),
        precioUnitarioCompra: opcion.precioCompra,
        subtotal: redondear4(cantidad * opcion.precioCompra),
        cantidadBaseAceptada: 0,
      });
    }

    if (lineas.length === 0 || proveedorId === 0) {
      return null;
    }

    const opciones = this.coberturaMaterial(lineas[0].materialId);
    const plazo = opciones.find((item) => item.proveedorId === proveedorId)?.plazoDias ?? 7;
    const orden = this.crearOrden({
      proveedorId,
      requisicionId: requisicion.id,
      cotizacionId: null,
      lineas,
      fechaPrometida: sumarDias(hoyISO(), plazo),
      notas: 'Orden directa al proveedor principal (compra urgente o sin alterno).',
    });
    this.marcarCompraEmitida(requisicion.id);
    return orden;
  }

  obtenerOrden(id: number): OrdenCompra | undefined {
    return this.ordenes().find((orden) => orden.id === id);
  }

  guardarOrden(orden: OrdenCompra): void {
    const copia = structuredClone(orden);
    copia.lineas = copia.lineas.map((linea) => ({
      ...linea,
      subtotal: redondear4(linea.cantidadCompra * linea.precioUnitarioCompra),
      cantidadBasePedida: this.basePresentaciones(linea.materialId, linea.cantidadCompra),
    }));
    copia.total = redondear4(copia.lineas.reduce((suma, linea) => suma + linea.subtotal, 0));
    this.listaOrdenes.update((actuales) =>
      actuales.map((actual) => (actual.id === copia.id ? copia : actual)),
    );
  }

  emitirOrden(id: number): void {
    this.listaOrdenes.update((actuales) =>
      actuales.map((actual) =>
        actual.id === id
          ? { ...actual, estado: 'EMITIDA' as const, fechaEmision: hoyISO() }
          : actual,
      ),
    );
  }

  cancelarOrden(id: number): void {
    this.listaOrdenes.update((actuales) =>
      actuales.map((actual) =>
        actual.id === id ? { ...actual, estado: 'CANCELADA' as const } : actual,
      ),
    );
  }

  eliminarOrden(id: number): 'eliminado' | 'no-permitido' {
    const orden = this.obtenerOrden(id);
    if (!orden || orden.estado !== 'BORRADOR') {
      return 'no-permitido';
    }
    this.listaOrdenes.update((actuales) => actuales.filter((actual) => actual.id !== id));
    return 'eliminado';
  }

  retrasada(orden: OrdenCompra): boolean {
    if (!orden.fechaPrometida || ['RECIBIDA', 'CANCELADA'].includes(orden.estado)) {
      return false;
    }
    return new Date(`${orden.fechaPrometida}T23:59:59`) < new Date();
  }

  registrarRecepcion(datos: DatosRecepcion): ResultadoRecepcion | null {
    const orden = this.obtenerOrden(datos.ordenCompraId);
    if (!orden || ['BORRADOR', 'CANCELADA', 'RECIBIDA'].includes(orden.estado)) {
      return null;
    }

    const anio = new Date().getFullYear();
    const consecutivo = this.siguienteId(this.recepciones());
    const recepcion: Recepcion = {
      id: consecutivo,
      folio: `REC-${anio}-${String(consecutivo).padStart(4, '0')}`,
      ordenCompraId: orden.id,
      fecha: hoyISO(),
      recibidaPor: datos.recibidaPor,
      documentoProveedor: datos.documentoProveedor.trim() || null,
      notas: datos.notas.trim() || null,
      lineas: datos.lineas.map((linea, indice) => ({ ...linea, id: consecutivo * 100 + indice })),
    };
    this.listaRecepciones.update((actuales) => [...actuales, recepcion]);

    const lotes: LoteDemostracion[] = [];
    const mermas: MermaDemostracion[] = [];

    const lineasActualizadas = orden.lineas.map((lineaOrden) => {
      const lineasRecibidas = recepcion.lineas.filter(
        (linea) => linea.ordenCompraLineaId === lineaOrden.id,
      );
      const aceptada = redondear4(
        lineasRecibidas.reduce((suma, linea) => suma + linea.cantidadBaseAceptada, 0),
      );
      const rechazada = redondear4(
        lineasRecibidas.reduce((suma, linea) => suma + linea.cantidadBaseRechazada, 0),
      );
      const material = this.obtenerMaterial(lineaOrden.materialId);
      const unidadBase = material?.unidadBase ?? 'pieza';

      if (aceptada > 0 && lineaOrden.cantidadCompra > 0) {
        this.correlativoLotes += 1;
        lotes.push({
          folio: `LOTE-${anio}-${String(this.correlativoLotes).padStart(4, '0')}`,
          materialId: lineaOrden.materialId,
          cantidadBase: aceptada,
          unidadBase,
          medidas: this.describirMedidas(lineasRecibidas),
          costoReal:
            lineaOrden.cantidadBasePedida > 0
              ? redondear4(
                  lineaOrden.precioUnitarioCompra * (aceptada / lineaOrden.cantidadBasePedida),
                )
              : 0,
          proveedorId: orden.proveedorId,
        });
      }
      if (rechazada > 0) {
        mermas.push({
          materialId: lineaOrden.materialId,
          cantidadBase: rechazada,
          unidadBase,
          causa: 'RECHAZO_RECEPCION',
          etapa: 'RECEPCION',
        });
      }

      return {
        ...lineaOrden,
        cantidadBaseAceptada: redondear4(lineaOrden.cantidadBaseAceptada + aceptada),
      };
    });

    const completa = lineasActualizadas.every(
      (linea) => linea.cantidadBaseAceptada >= linea.cantidadBasePedida - 0.0001,
    );
    const estadoOrden = completa || datos.cerrarConFaltante ? 'RECIBIDA' : 'PARCIAL';

    this.listaOrdenes.update((actuales) =>
      actuales.map((actual) =>
        actual.id === orden.id
          ? { ...actual, lineas: lineasActualizadas, estado: estadoOrden }
          : actual,
      ),
    );

    if (orden.requisicionId && completa) {
      this.listaRequisiciones.update((actuales) =>
        actuales.map((actual) =>
          actual.id === orden.requisicionId ? { ...actual, estado: 'ATENDIDA' as const } : actual,
        ),
      );
    }

    return { recepcion, estadoOrden, lotes, mermas };
  }

  private crearOrden(datos: {
    proveedorId: number;
    requisicionId: number | null;
    cotizacionId: number | null;
    lineas: LineaOrdenCompra[];
    fechaPrometida: string | null;
    notas: string;
  }): OrdenCompra {
    const id = this.siguienteId(this.ordenes());
    const orden: OrdenCompra = {
      id,
      folio: this.siguienteFolio('OC', this.ordenes()),
      proveedorId: datos.proveedorId,
      requisicionId: datos.requisicionId,
      cotizacionId: datos.cotizacionId,
      estado: 'BORRADOR',
      fechaEmision: null,
      fechaPrometida: datos.fechaPrometida,
      total: redondear4(datos.lineas.reduce((suma, linea) => suma + linea.subtotal, 0)),
      condicionesPago: this.condicionesProveedor(datos.proveedorId),
      notas: datos.notas,
      creadaPor: 'Administrador · demostración',
      lineas: datos.lineas.map((linea, indice) => ({ ...linea, id: id * 100 + indice + 1 })),
    };
    this.listaOrdenes.update((actuales) => [...actuales, orden]);
    return orden;
  }

  private marcarCompraEmitida(requisicionId: number): void {
    this.listaRequisiciones.update((actuales) =>
      actuales.map((actual) =>
        actual.id === requisicionId ? { ...actual, estado: 'COMPRA_EMITIDA' as const } : actual,
      ),
    );
  }

  private describirMedidas(lineas: LineaRecepcion[]): string {
    return lineas
      .map((linea) => {
        if (linea.anchoCm !== null && linea.largoM !== null) {
          return `${linea.anchoCm} cm × ${linea.largoM} m`;
        }
        return linea.pesoKg !== null ? `${linea.pesoKg} kg` : 'Sin medidas adicionales';
      })
      .join('; ');
  }

  private siguienteId<T extends { id: number }>(lista: T[]): number {
    return lista.reduce((maximo, item) => Math.max(maximo, item.id), 0) + 1;
  }

  private siguienteFolio<T extends { folio: string }>(prefijo: string, lista: T[]): string {
    const anio = new Date().getFullYear();
    const correlativo =
      lista.reduce((maximo, item) => {
        const coincidencia = item.folio.match(/-(\d{4})$/);
        return coincidencia ? Math.max(maximo, Number(coincidencia[1])) : maximo;
      }, 0) + 1;
    return `${prefijo}-${anio}-${String(correlativo).padStart(4, '0')}`;
  }
}
