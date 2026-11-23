import { Injectable, computed, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import type { LoteMaterial, Material } from '../../inventario/modelos/inventario';
import type { FilaVariante } from '../../productos/modelos/producto-maestro';
import { InventarioServicio } from '../../inventario/servicios/inventario-servicio';
import { ProductosServicio } from '../../productos/servicios/productos-servicio';
import { ProduccionServicio } from '../../produccion/servicios/produccion-servicio';
import { decimalPositivo } from '../../../compartido/validadores/validadores-negocio';
import {
  CAUSAS_SIMULADAS,
  MERMAS_SIMULADAS,
  REFERENCIAS_DEMO,
  hoyISO,
} from '../datos-simulados/mermas';
import type {
  AlertaMerma,
  CausaMerma,
  DatosNuevaMerma,
  FilaEvolucion,
  FilaIndicador,
  FiltrosZona,
  IndicadoresMerma,
  Merma,
  MermaVista,
  OpcionLote,
  OpcionMaterial,
  OpcionVariante,
  OrigenMerma,
  ResultadoAccion,
  ResultadoRegistro,
} from '../modelos/merma';
import {
  ETAPAS_MERMA,
  ETIQUETAS_ETAPA,
  ETIQUETAS_PROCEDENCIA,
  META_MERMA_PCT,
} from '../modelos/merma';

export { hoyISO };

export function redondear4(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10000) / 10000;
}

function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function suma(registros: Merma[], selector: (merma: Merma) => number): number {
  return registros.reduce((total, merma) => total + selector(merma), 0);
}

function mesesDelPeriodo(periodo: string, cantidad: number): string[] {
  const [anioTexto, mesTexto] = periodo.split('-');
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  const resultado: string[] = [];
  for (let indice = cantidad - 1; indice >= 0; indice -= 1) {
    const fecha = new Date(anio, mes - 1 - indice, 1);
    resultado.push(
      `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`,
    );
  }
  return resultado;
}

/**
 * Estado en memoria de M17. La interfaz pública está pensada para sustituirse
 * por HttpClient contra GET /mermas, POST /mermas, POST /mermas/{id}/reversar
 * y GET /mermas/indicadores (§9 y §10). Nada persiste en servidor: registrar
 * no descuenta existencias reales ni crea movimientos MERMA en M15/M12, no
 * genera la alerta MERMA_ALTA en M21 y no entrega cifras a M20. Esas fronteras
 * se señalan como pendientes en la interfaz.
 */
@Injectable({ providedIn: 'root' })
export class MermasServicio {
  private readonly inventario = inject(InventarioServicio);
  private readonly productos = inject(ProductosServicio);
  private readonly produccion = inject(ProduccionServicio);

  private readonly lista = signal<Merma[]>(structuredClone(MERMAS_SIMULADAS));
  private readonly listaCausas = signal<CausaMerma[]>(structuredClone(CAUSAS_SIMULADAS));
  private correlativo = 46;

  readonly mermas = this.lista.asReadonly();
  readonly causas = this.listaCausas.asReadonly();

  /** Vista ordenada con etiquetas y estado de reverso derivado (nunca se edita el original). */
  readonly vistas = computed<MermaVista[]>(() => {
    const reversadas = new Set(
      this.lista()
        .filter((merma) => merma.reversionDeId !== null)
        .map((merma) => merma.reversionDeId as number),
    );
    return [...this.lista()]
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)
      .map((merma) => ({
        ...merma,
        etiquetaItem: this.etiquetaItem(merma),
        etiquetaProcedencia: ETIQUETAS_PROCEDENCIA[merma.procedencia],
        reversada: reversadas.has(merma.id),
      }));
  });

  private etiquetaItem(merma: Merma): string {
    if (merma.origen === 'MATERIAL') {
      return `${merma.materialNombre ?? 'Material'} · ${merma.color ?? 'NA'} · ${merma.loteFolio ?? 'sin lote'}`;
    }
    return `${merma.sku ?? 'SKU'} · ${merma.nombreProducto ?? ''} · ${merma.talla ?? 'UN'}/${merma.color ?? 'NA'}`;
  }

  porId(id: number): MermaVista | undefined {
    return this.vistas().find((merma) => merma.id === id);
  }

  esReversada(id: number): boolean {
    return this.lista().some((merma) => merma.reversionDeId === id);
  }

  filtrar(filtros: FiltrosZona): MermaVista[] {
    const texto = filtros.texto.trim().toLocaleLowerCase('es-MX');
    const producto = filtros.producto.trim().toLocaleLowerCase('es-MX');

    return this.vistas().filter((merma) => {
      if (filtros.periodo !== 'TODOS' && !merma.fecha.startsWith(filtros.periodo)) {
        return false;
      }
      if (filtros.etapa !== 'TODAS' && merma.etapa !== filtros.etapa) {
        return false;
      }
      if (filtros.causaId !== 'TODAS' && merma.causaId !== filtros.causaId) {
        return false;
      }
      if (filtros.origen !== 'TODOS' && merma.origen !== filtros.origen) {
        return false;
      }
      if (
        producto !== '' &&
        `${merma.sku ?? ''} ${merma.nombreProducto ?? ''} ${merma.materialCodigo ?? ''} ${merma.materialNombre ?? ''}`
          .toLocaleLowerCase('es-MX')
          .includes(producto) === false
      ) {
        return false;
      }
      if (texto === '') {
        return true;
      }
      return [
        merma.folio,
        merma.etiquetaItem,
        ETIQUETAS_ETAPA[merma.etapa],
        merma.causaNombre,
        merma.ordenFolio ?? '',
        merma.descripcion ?? '',
        merma.etiquetaProcedencia,
      ]
        .join(' ')
        .toLocaleLowerCase('es-MX')
        .includes(texto);
    });
  }

  causasPara(origen: OrigenMerma): CausaMerma[] {
    return this.listaCausas().filter(
      (causa) => causa.activa && (causa.aplicaA === 'AMBOS' || causa.aplicaA === origen),
    );
  }

  opcionesMateriales(): OpcionMaterial[] {
    return this.inventario
      .vistas()
      .filter((existencia) => existencia.activo)
      .map((existencia) => ({
        materialId: existencia.materialId,
        codigo: existencia.material.codigo,
        nombre: existencia.material.nombre,
        color: existencia.color,
        unidadBase: existencia.material.unidadBase,
        etiqueta: `${existencia.material.codigo} · ${existencia.material.nombre} · ${existencia.color} (${existencia.material.unidadBase})`,
      }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es-MX'));
  }

  lotesDe(materialId: number, color?: string): OpcionLote[] {
    return this.inventario
      .lotes()
      .filter(
        (lote) =>
          lote.materialId === materialId &&
          lote.estado === 'DISPONIBLE' &&
          lote.cantidadDisponible > 0 &&
          (color === undefined || color === '' || lote.color === color),
      )
      .sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada))
      .map((lote) => ({
        id: lote.id,
        folio: lote.folio,
        color: lote.color,
        costoUnitario: lote.costoUnitario,
        disponible: lote.cantidadDisponible,
        etiqueta: `${lote.folio} · ${lote.color} · ${lote.fechaEntrada} · ${lote.cantidadDisponible} disponibles`,
      }));
  }

  opcionesVariantes(): OpcionVariante[] {
    return this.productos
      .filasVariantes()
      .filter((fila) => fila.variante.activa)
      .map((fila) => ({
        varianteId: fila.variante.id,
        sku: fila.variante.sku,
        nombreProducto: fila.productoNombre,
        talla: this.productos.nombreTalla(fila.variante.talla),
        color: this.productos.nombreColor(fila.variante.color),
        etiqueta: `${fila.variante.sku} · ${fila.productoNombre} · ${this.productos.nombreTalla(fila.variante.talla)} / ${this.productos.nombreColor(fila.variante.color)}`,
      }))
      .sort((a, b) => a.sku.localeCompare(b.sku, 'es-MX'));
  }

  ordenesDisponibles(): { id: number; folio: string }[] {
    return this.produccion
      .ordenes()
      .map((orden) => ({ id: orden.id, folio: orden.folio }))
      .sort((a, b) => b.folio.localeCompare(a.folio, 'es-MX'));
  }

  /** Costo perdido calculado solo: costo del lote (material) o estándar (prenda). */
  costoEstimado(
    origen: OrigenMerma,
    materialId: number | null,
    loteId: number | null,
    sku: string,
    cantidad: number | null,
  ): number {
    if (cantidad === null || !Number.isFinite(cantidad) || cantidad <= 0) {
      return 0;
    }
    if (origen === 'MATERIAL') {
      const lote = loteId === null ? undefined : this.inventario.lotes().find((item) => item.id === loteId);
      if (lote) {
        return redondear2(lote.costoUnitario * cantidad);
      }
      const material = materialId === null ? undefined : this.inventario.obtenerMaterial(materialId);
      return material ? redondear2(material.costoEstandarBase * cantidad) : 0;
    }
    const fila = this.productos.filasVariantes().find((item) => item.variante.sku === sku);
    const costo = fila ? (this.productos.obtenerProducto(fila.productoId)?.costoEstandar ?? 0) : 0;
    return redondear2(costo * cantidad);
  }

  registrar(datos: DatosNuevaMerma): ResultadoRegistro {
    const controlCantidad = new FormControl<number | null>(datos.cantidad);
    if (decimalPositivo(controlCantidad) !== null) {
      return { ok: false, mensaje: 'La cantidad debe ser mayor que cero y tener hasta 4 decimales.' };
    }
    if (datos.origen === 'PRODUCTO' && !Number.isInteger(datos.cantidad)) {
      return { ok: false, mensaje: 'Las prendas se registran en unidades enteras.' };
    }

    const causa = this.listaCausas().find((item) => item.id === datos.causaId);
    if (!causa || !causa.activa || !(causa.aplicaA === 'AMBOS' || causa.aplicaA === datos.origen)) {
      return { ok: false, mensaje: 'Selecciona una causa vigente que aplique al origen elegido.' };
    }

    let material: Material | undefined;
    let lote: LoteMaterial | undefined;
    let variante: FilaVariante | undefined;

    if (datos.origen === 'MATERIAL') {
      if (datos.materialId === null || datos.loteId === null) {
        return { ok: false, mensaje: 'Para materiales indica el material, el color y el lote.' };
      }
      material = this.inventario.obtenerMaterial(datos.materialId);
      lote = this.inventario.lotes().find((item) => item.id === datos.loteId);
      if (!material || !lote || lote.materialId !== datos.materialId) {
        return { ok: false, mensaje: 'El lote seleccionado no corresponde al material indicado.' };
      }
    } else {
      variante = this.productos
        .filasVariantes()
        .find((item) => item.variante.sku === datos.sku.trim());
      if (!variante) {
        return { ok: false, mensaje: 'Selecciona un SKU válido generado por M10.' };
      }
    }

    const folio = `MER-${new Date().getFullYear()}-${String(++this.correlativo).padStart(4, '0')}`;
    const registro: Merma = {
      id: this.lista().reduce((maximo, item) => Math.max(maximo, item.id), 0) + 1,
      folio,
      origen: datos.origen,
      procedencia: 'MANUAL',
      automatica: false,
      materialId: material?.id ?? null,
      materialCodigo: material?.codigo ?? null,
      materialNombre: material?.nombre ?? null,
      color: datos.origen === 'MATERIAL' ? (datos.color || lote?.color || 'NA') : (variante ? this.productos.nombreColor(variante.variante.color) : null),
      loteId: lote?.id ?? null,
      loteFolio: lote?.folio ?? null,
      unidadBase: material?.unidadBase ?? 'pieza',
      varianteId: variante?.variante.id ?? null,
      sku: variante?.variante.sku ?? null,
      nombreProducto: variante?.productoNombre ?? null,
      talla: variante ? this.productos.nombreTalla(variante.variante.talla) : null,
      cantidad: redondear4(datos.cantidad),
      costoPerdido: this.costoEstimado(
        datos.origen,
        datos.materialId,
        datos.loteId,
        datos.sku,
        datos.cantidad,
      ),
      etapa: datos.etapa,
      causaId: causa.id,
      causaNombre: causa.nombre,
      ordenFolio: datos.ordenFolio.trim() === '' ? null : datos.ordenFolio.trim(),
      descripcion: datos.descripcion.trim() === '' ? null : datos.descripcion.trim(),
      evidenciaNombre: datos.evidenciaNombre,
      registradaPor: 'Operativo · demostración',
      fecha: hoyISO(),
      esReversion: false,
      reversionDeId: null,
      motivoReversion: null,
    };
    this.lista.update((actuales) => [...actuales, registro]);

    return {
      ok: true,
      folio,
      mensaje: `${folio} registrado. El descuento de existencias y el movimiento MERMA quedan pendientes de Flask; el registro no podrá editarse.`,
    };
  }

  /** Corrección permitida solo al Administrador: crea un reverso, nunca edita el original. */
  reversar(id: number, motivo: string): ResultadoAccion {
    const original = this.lista().find((merma) => merma.id === id);
    if (!original) {
      return { ok: false, mensaje: 'No se encontró la merma.' };
    }
    if (this.esReversada(id)) {
      return { ok: false, mensaje: 'Esta merma ya fue corregida con un reverso.' };
    }
    if (motivo.trim() === '') {
      return { ok: false, mensaje: 'Indica el motivo de la corrección.' };
    }

    const folio = `MER-${new Date().getFullYear()}-${String(++this.correlativo).padStart(4, '0')}`;
    const reverso: Merma = {
      ...original,
      id: this.lista().reduce((maximo, item) => Math.max(maximo, item.id), 0) + 1,
      folio,
      procedencia: 'REVERSION',
      automatica: false,
      cantidad: redondear4(-original.cantidad),
      costoPerdido: redondear2(-original.costoPerdido),
      esReversion: true,
      reversionDeId: original.id,
      motivoReversion: motivo.trim(),
      descripcion: `Reverso de ${original.folio}. ${motivo.trim()}`,
      evidenciaNombre: null,
      registradaPor: 'Administrador · demostración',
      fecha: hoyISO(),
    };
    this.lista.update((actuales) => [...actuales, reverso]);
    return {
      ok: true,
      mensaje: `${folio} registrado como inverso de ${original.folio}. El original se conserva sin cambios.`,
    };
  }

  indicadores(): IndicadoresMerma {
    const periodo = REFERENCIAS_DEMO.periodo;
    const registros = this.lista();
    const delMes = registros.filter((merma) => merma.fecha.startsWith(periodo));
    const materialesM2 = new Set(REFERENCIAS_DEMO.materialesM2);

    const cantidadProducto = redondear4(
      suma(delMes, (merma) => (merma.origen === 'PRODUCTO' ? merma.cantidad : 0)),
    );
    const cantidadMaterialM2 = redondear4(
      suma(
        delMes,
        (merma) =>
          merma.origen === 'MATERIAL' && merma.materialId !== null && materialesM2.has(merma.materialId)
            ? merma.cantidad
            : 0,
      ),
    );
    const mermaProductoPct =
      REFERENCIAS_DEMO.unidadesProducidasMes > 0
        ? redondear2((cantidadProducto / REFERENCIAS_DEMO.unidadesProducidasMes) * 100)
        : 0;
    const mermaMaterialPct =
      REFERENCIAS_DEMO.consumoMaterialM2Mes > 0
        ? redondear2((cantidadMaterialM2 / REFERENCIAS_DEMO.consumoMaterialM2Mes) * 100)
        : 0;

    const porEtapa: FilaIndicador[] = ETAPAS_MERMA.map((etapa) => {
      const filas = delMes.filter((merma) => merma.etapa === etapa);
      const cantidad = redondear4(
        suma(filas, (merma) => (merma.origen === 'PRODUCTO' ? merma.cantidad : 0)),
      );
      const cantidadMaterial = redondear4(
        suma(filas, (merma) => (merma.origen === 'MATERIAL' ? merma.cantidad : 0)),
      );
      const referencia = REFERENCIAS_DEMO.unidadesPorEtapa[etapa] ?? 0;
      const porcentaje = referencia > 0 ? redondear2((cantidad / referencia) * 100) : 0;
      return {
        clave: etapa,
        etiqueta: ETIQUETAS_ETAPA[etapa],
        cantidad,
        cantidadMaterial,
        costoPerdido: redondear2(suma(filas, (merma) => merma.costoPerdido)),
        referencia,
        porcentaje,
        base: 'meta' as const,
        superaMeta: porcentaje > META_MERMA_PCT,
        unidad: 'piezas',
      };
    }).filter((fila) => fila.cantidad !== 0 || fila.cantidadMaterial !== 0);

    const porCausa: FilaIndicador[] = this.listaCausas()
      .map((causa) => {
        const filas = delMes.filter((merma) => merma.causaId === causa.id);
        const porcentaje =
          delMes.length > 0 ? redondear2((filas.length / delMes.length) * 100) : 0;
        return {
          clave: String(causa.id),
          etiqueta: causa.nombre,
          cantidad: redondear4(
            suma(filas, (merma) => (merma.origen === 'PRODUCTO' ? merma.cantidad : 0)),
          ),
          cantidadMaterial: redondear4(
            suma(filas, (merma) => (merma.origen === 'MATERIAL' ? merma.cantidad : 0)),
          ),
          costoPerdido: redondear2(suma(filas, (merma) => merma.costoPerdido)),
          referencia: delMes.length,
          porcentaje,
          base: 'participacion' as const,
          superaMeta: false,
          unidad: 'registros',
        };
      })
      .filter((fila) => fila.referencia > 0 && fila.porcentaje > 0)
      .sort((a, b) => b.porcentaje - a.porcentaje);

    const skus = new Set(
      delMes.filter((merma) => merma.origen === 'PRODUCTO' && merma.sku !== null).map((merma) => merma.sku as string),
    );
    const porProducto: FilaIndicador[] = [...skus]
      .map((sku) => {
        const filas = delMes.filter((merma) => merma.sku === sku);
        const referencia = REFERENCIAS_DEMO.unidadesProducidasPorSku[sku] ?? 0;
        const cantidad = redondear4(suma(filas, (merma) => merma.cantidad));
        const porcentaje = referencia > 0 ? redondear2((cantidad / referencia) * 100) : 0;
        return {
          clave: sku,
          etiqueta: `${sku} · ${filas[0]?.nombreProducto ?? ''}`,
          cantidad,
          cantidadMaterial: 0,
          costoPerdido: redondear2(suma(filas, (merma) => merma.costoPerdido)),
          referencia,
          porcentaje,
          base: 'meta' as const,
          superaMeta: porcentaje > META_MERMA_PCT,
          unidad: 'piezas',
        };
      })
      .sort((a, b) => b.porcentaje - a.porcentaje);

    const materiales = new Set(
      delMes.filter((merma) => merma.origen === 'MATERIAL' && merma.materialId !== null).map((merma) => merma.materialId as number),
    );
    const porMaterial: FilaIndicador[] = [...materiales]
      .map((materialId) => {
        const filas = delMes.filter((merma) => merma.materialId === materialId);
        const referencia = REFERENCIAS_DEMO.consumoPorMaterial[materialId] ?? 0;
        const cantidad = redondear4(suma(filas, (merma) => merma.cantidad));
        const porcentaje = referencia > 0 ? redondear2((cantidad / referencia) * 100) : 0;
        return {
          clave: String(materialId),
          etiqueta: `${filas[0]?.materialCodigo ?? ''} · ${filas[0]?.materialNombre ?? ''} · ${filas[0]?.color ?? ''}`,
          cantidad,
          cantidadMaterial: 0,
          costoPerdido: redondear2(suma(filas, (merma) => merma.costoPerdido)),
          referencia,
          porcentaje,
          base: 'meta' as const,
          superaMeta: porcentaje > META_MERMA_PCT,
          unidad: filas[0]?.unidadBase ?? 'unidad base',
        };
      })
      .sort((a, b) => b.porcentaje - a.porcentaje);

    const evolucion: FilaEvolucion[] = mesesDelPeriodo(periodo, 6).map((mes) => {
      const filas = registros.filter((merma) => merma.fecha.startsWith(mes));
      const fecha = new Date(`${mes}-01T12:00:00`);
      return {
        mes,
        etiqueta: new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(fecha).replace('.', ''),
        cantidadProducto: redondear4(
          suma(filas, (merma) => (merma.origen === 'PRODUCTO' ? merma.cantidad : 0)),
        ),
        cantidadMaterial: redondear4(
          suma(filas, (merma) => (merma.origen === 'MATERIAL' ? merma.cantidad : 0)),
        ),
        costoPerdido: redondear2(suma(filas, (merma) => merma.costoPerdido)),
      };
    });

    const alertas: AlertaMerma[] = [];
    if (mermaProductoPct > META_MERMA_PCT || mermaMaterialPct > META_MERMA_PCT) {
      alertas.push({
        id: 'general',
        ambito: 'general',
        etiqueta: 'MERMA_ALTA · merma del mes',
        detalle: `Producto ${mermaProductoPct}% y materiales m² ${mermaMaterialPct}% contra una meta menor a ${META_MERMA_PCT}%.`,
        porcentaje: Math.max(mermaProductoPct, mermaMaterialPct),
      });
    }
    for (const fila of porEtapa.filter((item) => item.superaMeta)) {
      alertas.push({
        id: `etapa-${fila.clave}`,
        ambito: 'etapa',
        etiqueta: `MERMA_ALTA · etapa ${fila.etiqueta}`,
        detalle: `${fila.cantidad} piezas en merma sobre ${fila.referencia} producidas (${fila.porcentaje}%).`,
        porcentaje: fila.porcentaje,
      });
    }
    for (const fila of porProducto.filter((item) => item.superaMeta)) {
      alertas.push({
        id: `producto-${fila.clave}`,
        ambito: 'producto',
        etiqueta: `MERMA_ALTA · ${fila.clave}`,
        detalle: `${fila.cantidad} piezas en merma sobre ${fila.referencia} producidas (${fila.porcentaje}%).`,
        porcentaje: fila.porcentaje,
      });
    }

    return {
      metaPct: META_MERMA_PCT,
      periodo,
      mermaProductoPct,
      mermaMaterialPct,
      referenciaProducto: REFERENCIAS_DEMO.unidadesProducidasMes,
      referenciaMaterial: REFERENCIAS_DEMO.consumoMaterialM2Mes,
      cantidadProducto,
      cantidadMaterial: cantidadMaterialM2,
      costoPerdido: redondear2(suma(registros, (merma) => merma.costoPerdido)),
      costoPerdidoMes: redondear2(suma(delMes, (merma) => merma.costoPerdido)),
      totalRegistros: registros.filter((merma) => !merma.esReversion).length,
      porEtapa,
      porCausa,
      porProducto,
      porMaterial,
      causasTop5: [...porCausa].sort((a, b) => b.costoPerdido - a.costoPerdido).slice(0, 5),
      evolucion,
      alertas,
    };
  }
}
