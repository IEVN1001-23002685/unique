import { Injectable, computed, inject, signal } from '@angular/core';
import { ComprasServicio } from '../../compras/servicios/compras-servicio';
import { ProveedoresServicio } from '../../proveedores/servicios/proveedores-servicio';
import {
  COLORES_CON_MATERIAL,
  type CambioPolitica,
  type DatosAjuste,
  type Existencia,
  type ExistenciaVista,
  type FiltrosKardex,
  type LoteMaterial,
  type Material,
  type MermaDemostracion,
  type MovimientoMaterial,
  type ResultadoAjuste,
  type TonoSemaforo,
} from '../modelos/inventario';
import {
  EXISTENCIAS_SIMULADAS,
  LOTES_SIMULADOS,
  MATERIALES_INVENTARIO,
  MOVIMIENTOS_SIMULADOS,
} from '../datos-simulados/inventario';

export function redondear4(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10000) / 10000;
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function haceDias(dias: number): string {
  const fecha = new Date(`${hoyISO()}T12:00:00`);
  fecha.setDate(fecha.getDate() - dias);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Estado en memoria de M15. La interfaz pública está pensada para sustituirse
 * por HttpClient contra GET /inventario/material, /inventario/material/lotes,
 * /inventario/material/movimientos, POST /inventario/material/ajuste,
 * /materiales y PATCH /inventario/material/{id}/politica (§9 y §10). Nada
 * persiste en servidor: los ajustes y las mermas son solo una vista previa.
 */
@Injectable({ providedIn: 'root' })
export class InventarioServicio {
  private readonly proveedores = inject(ProveedoresServicio);
  private readonly compras = inject(ComprasServicio);

  private readonly listaMateriales = signal<Material[]>(structuredClone(MATERIALES_INVENTARIO));
  private readonly listaExistencias = signal<Existencia[]>(structuredClone(EXISTENCIAS_SIMULADAS));
  private readonly listaLotes = signal<LoteMaterial[]>(structuredClone(LOTES_SIMULADOS));
  private readonly listaMovimientos = signal<MovimientoMaterial[]>(
    structuredClone(MOVIMIENTOS_SIMULADOS),
  );

  readonly materiales = this.listaMateriales.asReadonly();
  readonly existencias = this.listaExistencias.asReadonly();
  readonly lotes = this.listaLotes.asReadonly();
  readonly movimientos = this.listaMovimientos.asReadonly();

  /** v_inventario_material calculada en cliente, únicamente para la interfaz. */
  readonly vistas = computed<ExistenciaVista[]>(() =>
    this.listaExistencias()
      .filter((existencia) => existencia.activo)
      .map((existencia) => this.proyectar(existencia)),
  );

  readonly lotesOrdenados = computed(() =>
    [...this.listaLotes()].sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada)),
  );

  private proyectar(existencia: Existencia): ExistenciaVista {
    const material = this.obtenerMaterial(existencia.materialId);
    if (!material) {
      throw new Error(`Existencia ${existencia.id} sin material válido`);
    }

    const disponible = redondear4(existencia.fisico - existencia.reservado);
    const posicion = redondear4(disponible + existencia.enCompra);
    const consumoHistorico = this.consumoDiarioHistorico(existencia);
    const consumoDiario = consumoHistorico ?? existencia.consumoDiarioManual;
    const puntoReorden = redondear4(consumoDiario * material.plazoDias + existencia.stockSeguridad);
    const coberturaDias =
      consumoDiario > 0 ? redondear4(disponible / consumoDiario) : null;
    const requisicionAbierta = this.tieneRequisicionAbierta(existencia);

    let semaforo: TonoSemaforo = 'VERDE';
    let motivoSemaforo = 'Cobertura suficiente y sin faltantes detectados.';
    if (disponible <= existencia.stockMinimo) {
      semaforo = 'ROJO';
      motivoSemaforo = 'Disponible en o por debajo del stock mínimo.';
    } else if (!existencia.cubreOrdenConfirmada) {
      semaforo = 'ROJO';
      motivoSemaforo = 'No cubre una orden confirmada de producción.';
    } else if (disponible <= puntoReorden) {
      semaforo = 'AMBAR';
      motivoSemaforo = 'Disponible en o por debajo del punto de reorden.';
    }

    return {
      ...existencia,
      material,
      disponible,
      posicion,
      consumoDiario: redondear4(consumoDiario),
      puntoReorden,
      coberturaDias,
      semaforo,
      motivoSemaforo,
      requisicionAbierta,
      requiereAtencion: posicion <= puntoReorden && !requisicionAbierta,
    };
  }

  /** True cuando hay movimientos CONSUMO en los últimos 30 días. */
  tieneHistoricoConsumo(materialId: number, color: string): boolean {
    const corte = haceDias(30);
    return this.listaMovimientos().some(
      (movimiento) =>
        movimiento.tipo === 'CONSUMO' &&
        movimiento.materialId === materialId &&
        movimiento.color === color &&
        movimiento.fecha >= corte,
    );
  }

  /** Promedio de CONSUMO de 30 días; sin historial se usa el valor manual. */
  private consumoDiarioHistorico(existencia: Existencia): number | null {
    const corte = haceDias(30);
    const consumos = this.listaMovimientos().filter(
      (movimiento) =>
        movimiento.tipo === 'CONSUMO' &&
        movimiento.materialId === existencia.materialId &&
        movimiento.color === existencia.color &&
        movimiento.fecha >= corte,
    );
    if (consumos.length === 0) {
      return null;
    }
    const total = consumos.reduce((suma, movimiento) => suma + Math.abs(movimiento.cantidadBase), 0);
    return redondear4(total / 30);
  }

  /** Consulta de solo lectura a M14: M15 no escribe requisiciones. */
  private tieneRequisicionAbierta(existencia: Existencia): boolean {
    return this.compras.requisiciones().some(
      (requisicion) =>
        !['ATENDIDA', 'CANCELADA'].includes(requisicion.estado) &&
        requisicion.lineas.some(
          (linea) =>
            linea.materialId === existencia.materialId && linea.color === existencia.color,
        ),
    );
  }

  obtenerMaterial(id: number): Material | undefined {
    return this.listaMateriales().find((material) => material.id === id);
  }

  nombreMaterial(id: number): string {
    return this.obtenerMaterial(id)?.nombre ?? 'Material no disponible';
  }

  nombreProveedor(id: number): string {
    return this.proveedores.obtenerPorId(id)?.nombreComercial ?? 'Proveedor no disponible';
  }

  existeCodigo(codigo: string, exceptoId = 0): boolean {
    const normalizado = codigo.trim().toUpperCase();
    return this.listaMateriales().some(
      (material) => material.id !== exceptoId && material.codigo.toUpperCase() === normalizado,
    );
  }

  obtenerExistencia(id: number): Existencia | undefined {
    return this.listaExistencias().find((existencia) => existencia.id === id);
  }

  vistaPorId(id: number): ExistenciaVista | undefined {
    return this.vistas().find((vista) => vista.id === id);
  }

  lotesDe(materialId: number, color?: string): LoteMaterial[] {
    return this.lotesOrdenadosPorFecha().filter(
      (lote) =>
        lote.materialId === materialId && (color === undefined || color === '' || lote.color === color),
    );
  }

  private lotesOrdenadosPorFecha(): LoteMaterial[] {
    return [...this.listaLotes()].sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada));
  }

  /** PEPS: el primer lote disponible por fecha de entrada. */
  esPrimerLotePEPS(lote: LoteMaterial): boolean {
    const primero = this.lotesDe(lote.materialId, lote.color).find(
      (candidato) => candidato.cantidadDisponible > 0,
    );
    return primero?.id === lote.id;
  }

  coloresDe(materialId: number): string[] {
    const material = this.obtenerMaterial(materialId);
    if (!material) {
      return [];
    }
    return this.listaExistencias()
      .filter((existencia) => existencia.materialId === materialId && existencia.activo)
      .map((existencia) => existencia.color);
  }

  movimientosFiltrados(filtros: FiltrosKardex): MovimientoMaterial[] {
    return this.listaMovimientos()
      .filter((movimiento) => {
        if (filtros.materialId > 0 && movimiento.materialId !== filtros.materialId) {
          return false;
        }
        if (filtros.color !== '' && movimiento.color !== filtros.color) {
          return false;
        }
        if (filtros.loteFolio !== '' && movimiento.loteFolio !== filtros.loteFolio) {
          return false;
        }
        if (filtros.tipo !== 'TODOS' && movimiento.tipo !== filtros.tipo) {
          return false;
        }
        if (filtros.desde !== '' && movimiento.fecha < filtros.desde) {
          return false;
        }
        if (filtros.hasta !== '' && movimiento.fecha > filtros.hasta) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  }

  guardarMaterial(material: Material): Material {
    const copia: Material = { ...material, codigo: material.codigo.trim().toUpperCase() };
    if (copia.id === 0) {
      copia.id = this.listaMateriales().reduce((maximo, item) => Math.max(maximo, item.id), 0) + 1;
      this.listaMateriales.update((actuales) => [...actuales, copia]);
      this.crearExistenciasPara(copia);
      return copia;
    }
    this.listaMateriales.update((actuales) =>
      actuales.map((actual) => (actual.id === copia.id ? copia : actual)),
    );
    return copia;
  }

  private crearExistenciasPara(material: Material): void {
    const colores = material.porColor ? COLORES_CON_MATERIAL : ['NA'];
    const base = this.listaExistencias().reduce((maximo, item) => Math.max(maximo, item.id), 0);
    const nuevas: Existencia[] = colores.map((color, indice) => ({
      id: base + indice + 1,
      materialId: material.id,
      color,
      fisico: 0,
      reservado: 0,
      enCompra: 0,
      stockMinimo: 0,
      stockSeguridad: 0,
      consumoDiarioManual: 0,
      cubreOrdenConfirmada: true,
      activo: true,
    }));
    this.listaExistencias.update((actuales) => [...actuales, ...nuevas]);
  }

  /** Sin lotes se elimina del catálogo; con lotes o recetas se desactiva. */
  eliminarMaterial(id: number): 'eliminado' | 'desactivado' | 'no-encontrado' {
    const material = this.obtenerMaterial(id);
    if (!material) {
      return 'no-encontrado';
    }
    const conLotes = this.listaLotes().some((lote) => lote.materialId === id);
    // Las recetas pertenecen a M11: Flask debe confirmar que no hay referencias.
    if (conLotes) {
      this.listaMateriales.update((actuales) =>
        actuales.map((actual) => (actual.id === id ? { ...actual, activo: false } : actual)),
      );
      this.listaExistencias.update((actuales) =>
        actuales.map((actual) =>
          actual.materialId === id ? { ...actual, activo: false } : actual,
        ),
      );
      return 'desactivado';
    }
    this.listaMateriales.update((actuales) => actuales.filter((actual) => actual.id !== id));
    this.listaExistencias.update((actuales) =>
      actuales.filter((actual) => actual.materialId !== id),
    );
    return 'eliminado';
  }

  guardarPoliticas(cambios: CambioPolitica[]): void {
    const porId = new Map(cambios.map((cambio) => [cambio.existenciaId, cambio]));
    this.listaExistencias.update((actuales) =>
      actuales.map((existencia) => {
        const cambio = porId.get(existencia.id);
        return cambio
          ? {
              ...existencia,
              stockMinimo: redondear4(cambio.stockMinimo),
              stockSeguridad: redondear4(cambio.stockSeguridad),
              consumoDiarioManual: redondear4(cambio.consumoDiarioManual),
            }
          : existencia;
      }),
    );
  }

  registrarAjuste(datos: DatosAjuste): ResultadoAjuste | null {
    const existencia = this.obtenerExistencia(datos.existenciaId);
    if (!existencia || !Number.isFinite(datos.cantidadContada) || datos.cantidadContada < 0) {
      return null;
    }

    const diferencia = redondear4(datos.cantidadContada - existencia.fisico);
    let loteAfectado: string | null = null;

    if (diferencia < 0) {
      loteAfectado = this.aplicarPEPS(existencia, Math.abs(diferencia));
    }

    this.listaExistencias.update((actuales) =>
      actuales.map((actual) =>
        actual.id === existencia.id ? { ...actual, fisico: redondear4(datos.cantidadContada) } : actual,
      ),
    );

    const material = this.obtenerMaterial(existencia.materialId);
    const movimiento: MovimientoMaterial = {
      id: this.listaMovimientos().reduce((maximo, item) => Math.max(maximo, item.id), 0) + 1,
      fecha: hoyISO(),
      materialId: existencia.materialId,
      color: existencia.color,
      loteFolio: loteAfectado,
      tipo: datos.enviarAMerma && diferencia < 0 ? 'MERMA' : diferencia > 0 ? 'SOBRANTE' : 'AJUSTE',
      cantidadBase: diferencia,
      costoUnitario: material?.costoEstandarBase ?? 0,
      documento: this.siguienteDocumento('AJU'),
      motivo: datos.motivo.trim(),
      usuario: 'Operativo · demostración',
    };
    this.listaMovimientos.update((actuales) => [...actuales, movimiento]);

    const merma: MermaDemostracion | null =
      datos.enviarAMerma && diferencia < 0
        ? {
            materialId: existencia.materialId,
            color: existencia.color,
            cantidadBase: Math.abs(diferencia),
            unidadBase: material?.unidadBase ?? 'pieza',
            causa: datos.motivo.trim(),
            etapa: 'ALMACEN',
          }
        : null;

    return { movimiento, diferencia, loteAfectado, merma };
  }

  /** Descuento por PEPS sobre lotes: primero el más antiguo con disponible. */
  private aplicarPEPS(existencia: Existencia, cantidad: number): string | null {
    let pendiente = cantidad;
    let primero: string | null = null;

    this.listaLotes.update((actuales) =>
      actuales.map((lote) => {
        if (
          pendiente <= 0 ||
          lote.materialId !== existencia.materialId ||
          lote.color !== existencia.color ||
          lote.cantidadDisponible <= 0
        ) {
          return lote;
        }
        const tomar = Math.min(lote.cantidadDisponible, pendiente);
        pendiente = redondear4(pendiente - tomar);
        if (primero === null) {
          primero = lote.folio;
        }
        const disponible = redondear4(lote.cantidadDisponible - tomar);
        return {
          ...lote,
          cantidadDisponible: disponible,
          estado: disponible === 0 ? ('AGOTADO' as const) : ('DISPONIBLE' as const),
        };
      }),
    );

    // Si el conteo supera lo que hay en lotes, Flask debe decidir la corrección.
    return primero;
  }

  private siguienteDocumento(prefijo: string): string {
    const anio = new Date().getFullYear();
    const consecutivo =
      this.listaMovimientos().reduce((maximo, movimiento) => {
        const coincidencia = movimiento.documento.match(/-(\d{4})$/);
        return coincidencia ? Math.max(maximo, Number(coincidencia[1])) : maximo;
      }, 0) + 1;
    return `${prefijo}-${anio}-${String(consecutivo).padStart(4, '0')}`;
  }
}
