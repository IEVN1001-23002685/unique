import { Injectable, computed, inject, signal } from '@angular/core';
import { AvisosServicio } from '../../../nucleo/servicios/avisos-servicio';
import { EntregasServicio } from '../../entregas/servicios/entregas-servicio';
import { InventarioProductoServicio } from '../../inventario-producto-terminado/servicios/inventario-producto-terminado-servicio';
import type { Pedido } from '../../pedidos/modelos/pedido';
import { PedidosServicio } from '../../pedidos/servicios/pedidos-servicio';
import { PreparacionServicio } from '../../preparacion/servicios/preparacion-servicio';
import { ProductosServicio } from '../../productos/servicios/productos-servicio';
import type { LineaVenta, Venta } from '../../ventas/modelos/venta';
import { VentasServicio } from '../../ventas/servicios/ventas-servicio';
import {
  ALERTAS_DEMO,
  ACEPTACION_MATERIAL_DEMO,
  COMPRAS_DEMO,
  CONVERSION_DEMO,
  DEVOLUCIONES_DEMO,
  ENTREGAS_PROVEEDOR_DEMO,
  EXACTITUD_INVENTARIO_DEMO,
  MERMAS_DEMO,
  MERMA_MATERIAL_DEMO,
  MERMA_PRODUCCION_DEMO,
  MATERIALES_DEMO,
  ORDENES_PRODUCCION_DEMO,
  PROVEEDORES_DEMO,
  ROTACION_PT_DEMO,
  TASA_DEVOLUCION_DEMO,
  TASA_RECHAZO_DEMO,
} from '../datos-simulados/dashboard';
import {
  ETIQUETAS_ESTADO_PEDIDO_DASH,
  mxn,
  normalizar,
  numero,
  porcentaje,
  type AlertaDashboard,
  type CanalDashboard,
  type EstadoPedidoMetric,
  type FiltrosDashboard,
  type FilaValor,
  type IngresoSku,
  type LineaAgrupada,
  type MetricaDashboard,
  type PeriodoDashboard,
  type RepartidorMetric,
  type RolDashboard,
  type SeccionDashboard,
} from '../modelos/dashboard';
import type { Entrega } from '../../entregas/modelos/entrega';

interface Rango {
  inicio: string;
  fin: string;
  anteriorInicio: string;
  anteriorFin: string;
}

const dos = (valor: number): string => String(valor).padStart(2, '0');

function fechaIso(fecha: Date): string {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

function rangoPeriodo(periodo: PeriodoDashboard): Rango {
  const hoy = new Date();
  if (periodo === 'ANO_ACTUAL') {
    const anio = hoy.getFullYear();
    return {
      inicio: `${anio}-01-01`,
      fin: `${anio + 1}-01-01`,
      anteriorInicio: `${anio - 1}-01-01`,
      anteriorFin: `${anio}-01-01`,
    };
  }

  const dias = periodo === '30_DIAS' ? 30 : 90;
  const inicio = new Date(hoy);
  inicio.setDate(inicio.getDate() - dias);
  const anteriorInicio = new Date(inicio);
  anteriorInicio.setDate(anteriorInicio.getDate() - dias);
  return {
    inicio: fechaIso(inicio),
    fin: fechaIso(new Date(hoy.getTime() + 86_400_000)),
    anteriorInicio: fechaIso(anteriorInicio),
    anteriorFin: fechaIso(inicio),
  };
}

function diasEntre(inicio: string, fin: string): number {
  return Math.max(0, (new Date(fin).getTime() - new Date(inicio).getTime()) / 86_400_000);
}

const ESTADOS_PEDIDO = [
  'RECIBIDO',
  'CONFIRMADO',
  'EN_PRODUCCION',
  'EN_PREPARACION',
  'LISTO_ENVIO',
  'EN_REPARTO',
  'ENTREGADO',
  'CANCELADO',
] as const;

/**
 * Proyección de solo lectura para M20. Consulta los servicios dueños de cada
 * dato; no escribe estados, no calcula costes definitivos y no persiste nada.
 */
@Injectable({
  providedIn: 'root',
})
export class DashboardServicio {
  private readonly ventas = inject(VentasServicio);
  private readonly pedidos = inject(PedidosServicio);
  private readonly productos = inject(ProductosServicio);
  private readonly inventario = inject(InventarioProductoServicio);
  private readonly entregas = inject(EntregasServicio);
  private readonly preparacion = inject(PreparacionServicio);
  private readonly avisos = inject(AvisosServicio);

  private readonly filtrosLista = signal<FiltrosDashboard>({
    periodo: '30_DIAS',
    categoriaId: 0,
    productoId: 0,
    color: '',
    talla: '',
    canal: 'TODOS',
  });

  /** Vista previa demostrativa; no sustituye un guard ni define permisos reales. */
  private readonly rolLista = signal<RolDashboard>('Administrador');

  readonly filtros = this.filtrosLista.asReadonly();
  readonly rol = this.rolLista.asReadonly();
  readonly esAdmin = computed(() => this.rolLista() === 'Administrador');

  readonly periodos: { valor: PeriodoDashboard; etiqueta: string }[] = [
    { valor: '30_DIAS', etiqueta: 'Últimos 30 días' },
    { valor: '90_DIAS', etiqueta: 'Últimos 90 días' },
    { valor: 'ANO_ACTUAL', etiqueta: 'Año actual' },
  ];

  readonly canales: { valor: CanalDashboard; etiqueta: string }[] = [
    { valor: 'TODOS', etiqueta: 'Todos los canales' },
    { valor: 'TIENDA', etiqueta: 'Tienda' },
    { valor: 'MANUAL', etiqueta: 'Manual' },
    { valor: 'CAMBIO', etiqueta: 'Cambio' },
  ];

  readonly categorias = this.productos.categorias.filter((categoria) => categoria.activa);
  readonly productosCatalogo = this.productos.visibles;
  readonly compras = signal(COMPRAS_DEMO).asReadonly();
  readonly materiales = signal(MATERIALES_DEMO).asReadonly();
  readonly proveedores = signal(PROVEEDORES_DEMO).asReadonly();
  readonly ordenes = signal(ORDENES_PRODUCCION_DEMO).asReadonly();
  readonly mermas = signal(MERMAS_DEMO).asReadonly();
  readonly devoluciones = signal(DEVOLUCIONES_DEMO).asReadonly();

  readonly coloresVendidos = computed(() =>
    [...new Set(this.ventas.ventas().flatMap((venta) => venta.lineas.map((linea) => linea.color)))]
      .sort((a, b) => a.localeCompare(b, 'es-MX')),
  );

  readonly tallasVendidas = computed(() =>
    [...new Set(this.ventas.ventas().flatMap((venta) => venta.lineas.map((linea) => linea.talla)))]
      .sort((a, b) => a.localeCompare(b, 'es-MX')),
  );

  private readonly catalogo = computed(() => this.productos.productos());
  private readonly rango = computed(() => rangoPeriodo(this.filtrosLista().periodo));

  private readonly hayFiltroProducto = computed(() => {
    const filtros = this.filtrosLista();
    return (
      filtros.categoriaId !== 0 ||
      filtros.productoId !== 0 ||
      filtros.color !== '' ||
      filtros.talla !== ''
    );
  });

  actualizarFiltro<K extends keyof FiltrosDashboard>(clave: K, valor: FiltrosDashboard[K]): void {
    this.filtrosLista.update((actuales) => ({ ...actuales, [clave]: valor }));
  }

  restablecerFiltros(): void {
    this.filtrosLista.set({
      periodo: '30_DIAS',
      categoriaId: 0,
      productoId: 0,
      color: '',
      talla: '',
      canal: 'TODOS',
    });
  }

  cambiarRol(rol: RolDashboard): void {
    this.rolLista.set(rol);
  }

  private pagoAprobado(venta: Venta): boolean {
    return (
      venta.estadoPago === 'PAGADA' &&
      venta.pagos.some((pago) => pago.tipo === 'COBRO' && pago.estado === 'APROBADO')
    );
  }

  private productoDeLinea(linea: LineaVenta) {
    const nombre = normalizar(linea.nombreProducto);
    return this.catalogo().find((producto) => normalizar(producto.nombre) === nombre);
  }

  private categoriaDeLinea(linea: LineaVenta): string {
    const producto = this.productoDeLinea(linea);
    return producto ? this.productos.nombreCategoria(producto.categoriaId) : 'Sin categoría';
  }

  private coincideLinea(linea: LineaVenta, filtros: FiltrosDashboard): boolean {
    return (
      (filtros.categoriaId === 0 ||
        this.productoDeLinea(linea)?.categoriaId === filtros.categoriaId) &&
      (filtros.productoId === 0 || this.productoDeLinea(linea)?.id === filtros.productoId) &&
      (filtros.color === '' || linea.color === filtros.color) &&
      (filtros.talla === '' || linea.talla === filtros.talla)
    );
  }

  private ventasEn(rango: Rango): Venta[] {
    const filtros = this.filtrosLista();
    return this.ventas.ventas().filter(
      (venta) =>
        venta.estado === 'ACTIVA' &&
        this.pagoAprobado(venta) &&
        venta.fecha >= rango.inicio &&
        venta.fecha < rango.fin &&
        (filtros.canal === 'TODOS' || venta.canal === filtros.canal),
    );
  }

  private lineasEn(rango: Rango): LineaVenta[] {
    const filtros = this.filtrosLista();
    return this.ventasEn(rango).flatMap((venta) =>
      venta.lineas.filter((linea) => this.coincideLinea(linea, filtros)),
    );
  }

  private totalEn(rango: Rango): number {
    if (!this.hayFiltroProducto()) {
      return this.ventasEn(rango).reduce((suma, venta) => suma + venta.total, 0);
    }
    return this.lineasEn(rango).reduce((suma, linea) => suma + linea.subtotal, 0);
  }

  private totalVentaFiltrada(venta: Venta): number {
    if (!this.hayFiltroProducto()) {
      return venta.total;
    }
    const filtros = this.filtrosLista();
    return venta.lineas
      .filter((linea) => this.coincideLinea(linea, filtros))
      .reduce((suma, linea) => suma + linea.subtotal, 0);
  }

  private readonly ventasActuales = computed(() => {
    const filtros = this.filtrosLista();
    return this.ventasEn(this.rango()).filter((venta) =>
      venta.lineas.some((linea) => this.coincideLinea(linea, filtros)),
    );
  });

  private readonly lineasActuales = computed(() => this.lineasEn(this.rango()));

  private readonly totalActual = computed(() => this.totalEn(this.rango()));

  private readonly totalAnterior = computed(() =>
    this.totalEn({
      inicio: this.rango().anteriorInicio,
      fin: this.rango().anteriorFin,
      anteriorInicio: this.rango().anteriorInicio,
      anteriorFin: this.rango().anteriorFin,
    }),
  );

  readonly variacionVentas = computed(() =>
    this.totalAnterior() === 0 ? 0 : ((this.totalActual() - this.totalAnterior()) / this.totalAnterior()) * 100,
  );

  readonly ticketPromedio = computed(() =>
    this.ventasActuales().length === 0 ? 0 : this.totalActual() / this.ventasActuales().length,
  );

  /** Participación de un mes respecto al total filtrado, en porcentaje. */
  participacion(valor: number): number {
    const total = this.totalActual();
    return total === 0 ? 0 : (valor / total) * 100;
  }

  readonly ventasPorMes = computed<FilaValor[]>(() => {
    const agrupado = new Map<string, number>();
    for (const venta of this.ventasActuales()) {
      const mes = venta.fecha.slice(0, 7);
      agrupado.set(mes, (agrupado.get(mes) ?? 0) + this.totalVentaFiltrada(venta));
    }
    return [...agrupado.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, valor]) => {
        const fecha = new Date(`${clave}-01T12:00:00`);
        return {
          etiqueta: new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' }).format(fecha),
          valor,
        };
      });
  });

  readonly ingresosPorSku = computed<IngresoSku[]>(() => {
    const agrupado = new Map<string, LineaVenta[]>();
    for (const linea of this.lineasActuales()) {
      agrupado.set(linea.sku, [...(agrupado.get(linea.sku) ?? []), linea]);
    }
    return [...agrupado.entries()]
      .map(([sku, lineas]) => {
        const piezas = lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
        const ingresos = lineas.reduce((suma, linea) => suma + linea.subtotal, 0);
        const costo = lineas.reduce(
          (suma, linea) => suma + linea.cantidad * linea.costoEstandarUnitario,
          0,
        );
        const base = ingresos / 1.16;
        return {
          sku,
          producto: lineas[0]?.nombreProducto ?? sku,
          categoria: this.categoriaDeLinea(lineas[0]!),
          color: lineas[0]?.color ?? '—',
          talla: lineas[0]?.talla ?? '—',
          piezas,
          ingresos,
          margen: base === 0 ? 0 : ((base - costo) / base) * 100,
        };
      })
      .sort((a, b) => b.ingresos - a.ingresos);
  });

  private agruparLineas(clave: (linea: LineaVenta) => string): LineaAgrupada[] {
    const agrupado = new Map<string, LineaAgrupada>();
    for (const linea of this.lineasActuales()) {
      const etiqueta = clave(linea);
      const actual = agrupado.get(etiqueta) ?? { etiqueta, piezas: 0, ingresos: 0 };
      actual.piezas += linea.cantidad;
      actual.ingresos += linea.subtotal;
      agrupado.set(etiqueta, actual);
    }
    return [...agrupado.values()].sort((a, b) => b.ingresos - a.ingresos);
  }

  readonly ingresosPorCategoria = computed(() => this.agruparLineas((linea) => this.categoriaDeLinea(linea)));
  readonly ingresosPorColor = computed(() => this.agruparLineas((linea) => linea.color));
  readonly ingresosPorTalla = computed(() => this.agruparLineas((linea) => linea.talla));

  readonly masVendidos = computed(() =>
    [...this.ingresosPorSku()].sort((a, b) => b.piezas - a.piezas).slice(0, 5),
  );

  readonly menosVendidos = computed(() =>
    [...this.ingresosPorSku()].sort((a, b) => a.piezas - b.piezas).slice(0, 5),
  );

  readonly clientes = computed(() => {
    const compras = new Map<string, string[]>();
    for (const venta of this.ventas.ventas()) {
      if (venta.estado !== 'ACTIVA' || !this.pagoAprobado(venta)) {
        continue;
      }
      compras.set(venta.cliente, [...(compras.get(venta.cliente) ?? []), venta.fecha]);
    }

    let nuevos = 0;
    let recompra = 0;
    for (const fechas of compras.values()) {
      fechas.sort();
      const primera = fechas[0];
      if (primera && primera >= this.rango().inicio && primera < this.rango().fin) {
        nuevos += 1;
      }
      if (primera && fechas[1] && diasEntre(primera, fechas[1]) <= 60) {
        recompra += 1;
      }
    }
    return {
      nuevos,
      recompra,
      tasa: compras.size === 0 ? 0 : (recompra / compras.size) * 100,
    };
  });

  readonly pedidosATiempo = computed(() => {
    const entregados = this.pedidos
      .pedidos()
      .filter((pedido) => pedido.estado === 'ENTREGADO' && pedido.entregadoEn && pedido.fechaPromesa);
    const aTiempo = entregados.filter(
      (pedido) => (pedido.entregadoEn ?? '') <= (pedido.fechaPromesa ?? ''),
    ).length;
    return entregados.length === 0 ? 0 : (aTiempo / entregados.length) * 100;
  });

  readonly exactitudPedidos = computed(() => {
    const terminadas = this.preparacion.terminadas();
    if (terminadas.length === 0) {
      return 100;
    }
    const conIncidencia = new Set(this.preparacion.incidencias().map((item) => item.preparacionFolio));
    const limpias = terminadas.filter((item) => !conIncidencia.has(item.folio)).length;
    return (limpias / terminadas.length) * 100;
  });

  readonly pedidosPorEstado = computed<EstadoPedidoMetric[]>(() =>
    ESTADOS_PEDIDO.map((estado) => ({
      estado: ETIQUETAS_ESTADO_PEDIDO_DASH[estado],
      cantidad: this.pedidos.pedidos().filter((pedido) => pedido.estado === estado).length,
    })),
  );

  readonly pedidosEstancados = computed(() =>
    this.pedidos.pedidos().filter((pedido) => this.pedidos.tono(pedido) === 'rojo'),
  );

  readonly entregasPrimerIntento = computed(() => {
    const consideradas = this.entregas
      .entregas()
      .filter((entrega) => entrega.estado === 'ENTREGADA' || entrega.estado === 'FALLIDA');
    const exitosas = consideradas.filter(
      (entrega) => entrega.estado === 'ENTREGADA' && entrega.intento === 1,
    ).length;
    return consideradas.length === 0 ? 0 : (exitosas / consideradas.length) * 100;
  });

  readonly tiempoEntregaHoras = computed(() => {
    const tiempos = this.entregas
      .entregas()
      .filter(
        (entrega) =>
          entrega.estado === 'ENTREGADA' && entrega.salidaEn !== null && entrega.resultadoEn !== null,
      )
      .map((entrega) =>
        (new Date(entrega.resultadoEn!).getTime() - new Date(entrega.salidaEn!).getTime()) /
        3_600_000,
      );
    return tiempos.length === 0
      ? 0
      : tiempos.reduce((suma, horas) => suma + horas, 0) / tiempos.length;
  });

  readonly entregasPorRepartidor = computed<RepartidorMetric[]>(() => {
    const agrupado = new Map<number, Entrega[]>();
    for (const entrega of this.entregas.entregas()) {
      agrupado.set(entrega.repartidorId, [...(agrupado.get(entrega.repartidorId) ?? []), entrega]);
    }
    return [...agrupado.entries()].map(([id, lista]) => {
      const exitosas = lista.filter((entrega) => entrega.estado === 'ENTREGADA');
      const primerIntento = exitosas.filter((entrega) => entrega.intento === 1).length;
      const tiempos = exitosas
        .filter((entrega) => entrega.salidaEn !== null && entrega.resultadoEn !== null)
        .map(
          (entrega) =>
            (new Date(entrega.resultadoEn!).getTime() - new Date(entrega.salidaEn!).getTime()) /
            3_600_000,
        );
      const tiempoHoras =
        tiempos.length === 0 ? 0 : tiempos.reduce((suma, horas) => suma + horas, 0) / tiempos.length;
      return {
        repartidor: this.entregas.nombreRepartidor(id),
        entregas: lista.length,
        exitosas: exitosas.length,
        primerIntento: exitosas.length === 0 ? 0 : (primerIntento / exitosas.length) * 100,
        tiempoHoras,
      };
    });
  });

  readonly semaforosInventario = computed(() => {
    const filas = this.inventario.existencias();
    return {
      verde: filas.filter((fila) => fila.semaforo === 'VERDE').length,
      ambar: filas.filter((fila) => fila.semaforo === 'AMBAR').length,
      rojo: filas.filter((fila) => fila.semaforo === 'ROJO').length,
      senales: this.inventario.indicadores().senales,
    };
  });

  readonly cumplimientoPlan = computed(() => {
    const planeadas = ORDENES_PRODUCCION_DEMO.reduce((suma, orden) => suma + orden.planeadas, 0);
    const aprobadas = ORDENES_PRODUCCION_DEMO.reduce((suma, orden) => suma + orden.aprobadas, 0);
    return planeadas === 0 ? 0 : (aprobadas / planeadas) * 100;
  });

  readonly mermaUnidades = computed(() =>
    MERMAS_DEMO.reduce((suma, fila) => suma + fila.unidades, 0),
  );

  readonly costoPerdido = computed(() => MERMAS_DEMO.reduce((suma, fila) => suma + fila.costo, 0));

  readonly materialesEnRiesgo = computed(() =>
    MATERIALES_DEMO.filter((material) => material.tono !== 'VERDE').length,
  );

  readonly comprasPendientes = computed(
    () => COMPRAS_DEMO.filter((compra) => compra.estado === 'PENDIENTE').length,
  );

  readonly comprasRetrasadas = computed(
    () => COMPRAS_DEMO.filter((compra) => compra.estado === 'RETRASADA').length,
  );

  readonly alertasCriticas = computed<AlertaDashboard[]>(() => {
    const lista: AlertaDashboard[] = [];

    for (const fila of this.inventario.existencias().filter((item) => item.semaforo === 'ROJO').slice(0, 2)) {
      lista.push({
        id: `pt-${fila.varianteId}`,
        clave: 'PT_AGOTADO_DEMANDA',
        titulo: `${fila.sku} sin disponible`,
        detalle: `Existencia ${fila.existencia}, reservado ${fila.reservado}. Revisar reposición.`,
        severidad: 'CRITICA',
        origen: 'M12 · Inventario de producto terminado',
        ruta: ['/operacion', 'inventario-pt'],
      });
    }

    for (const entrega of this.entregas.alertasCriticas().slice(0, 2)) {
      lista.push({
        id: `ent-${entrega.folio}`,
        clave: 'ENTREGA_FALLIDA_REPETIDA',
        titulo: `Dos intentos fallidos · ${entrega.folio}`,
        detalle: `${entrega.cliente} requiere decisión del Administrador.`,
        severidad: 'CRITICA',
        origen: 'M19 · Entregas',
        ruta: ['/entregas', 'seguimiento'],
      });
    }

    for (const pedido of this.pedidosEstancados().slice(0, 2)) {
      lista.push({
        id: `ped-${pedido.folio}`,
        clave: 'PEDIDO_ESTANCADO',
        titulo: `Pedido estancado · ${pedido.folio}`,
        detalle: `${pedido.cliente} supera el umbral de su estado actual.`,
        severidad: 'CRITICA',
        origen: 'M09 · Pedidos',
        ruta: ['/admin', 'pedidos'],
      });
    }

    for (const alerta of ALERTAS_DEMO) {
      lista.push(alerta);
    }

    return lista.slice(0, 8);
  });

  readonly metricasResumen = computed<MetricaDashboard[]>(() => {
    const metricas: MetricaDashboard[] = [
      {
        etiqueta: 'Ventas del periodo',
        valor: mxn(this.totalActual()),
        detalle: `${this.ventasActuales().length} ventas con pago aprobado`,
        tono: 'INFO',
        soloAdmin: true,
      },
      {
        etiqueta: 'Vs. periodo anterior',
        valor: porcentaje(this.variacionVentas()),
        detalle: this.variacionVentas() >= 0 ? 'Tendencia positiva' : 'Requiere revisión',
        tono: this.variacionVentas() >= 0 ? 'VERDE' : 'ROJO',
        soloAdmin: true,
      },
      {
        etiqueta: 'Ticket promedio',
        valor: mxn(this.ticketPromedio()),
        detalle: 'Ventas activas del filtro',
        tono: 'INFO',
        soloAdmin: true,
      },
      {
        etiqueta: 'Conversión del carrito',
        valor: porcentaje(CONVERSION_DEMO),
        detalle: 'Demostración: los carritos se calculan en Flask',
        tono: 'INFO',
        soloAdmin: true,
      },
      {
        etiqueta: 'Pedidos a tiempo',
        valor: porcentaje(this.pedidosATiempo()),
        detalle: 'Meta 95 % · entregados en fecha prometida',
        tono: this.pedidosATiempo() >= 95 ? 'VERDE' : 'AMBAR',
      },
      {
        etiqueta: 'Exactitud de pedidos',
        valor: porcentaje(this.exactitudPedidos()),
        detalle: 'Preparaciones terminadas sin incidencia',
        tono: 'INFO',
      },
      {
        etiqueta: 'Exactitud de inventario',
        valor: porcentaje(EXACTITUD_INVENTARIO_DEMO),
        detalle: 'Demostración: los conteos se registrarán en M12',
        tono: 'INFO',
      },
      {
        etiqueta: 'Rotación de producto terminado',
        valor: `${numero(ROTACION_PT_DEMO)} veces`,
        detalle: 'Demostración: unidades vendidas ÷ inventario promedio',
        tono: 'INFO',
        soloAdmin: true,
      },
      {
        etiqueta: 'Merma del mes',
        valor: `${numero(this.mermaUnidades())} pzas`,
        detalle: this.esAdmin()
          ? `Costo estimado ${mxn(this.costoPerdido())}`
          : 'Unidades en mermas del mes',
        tono: MERMA_PRODUCCION_DEMO < 5 ? 'VERDE' : 'ROJO',
      },
      {
        etiqueta: 'Órdenes rojas',
        valor: numero(this.ordenes().filter((orden) => orden.tono === 'ROJO').length),
        detalle: 'Producción · datos de demostración',
        tono: 'ROJO',
      },
      {
        etiqueta: 'Alertas abiertas',
        valor: numero(this.alertasCriticas().length),
        detalle: 'Proyección local; revisar centro de alertas M21',
        tono: this.alertasCriticas().length > 0 ? 'ROJO' : 'VERDE',
      },
      {
        etiqueta: 'Semáforo de inventario PT',
        valor: `${this.semaforosInventario().rojo} rojos`,
        detalle: `${this.semaforosInventario().ambar} ámbar · ${this.semaforosInventario().verde} verdes`,
        tono: this.semaforosInventario().rojo > 0 ? 'ROJO' : 'VERDE',
      },
    ];
    return this.esAdmin() ? metricas : metricas.filter((metrica) => !metrica.soloAdmin);
  });

  readonly metricasProduccion = computed<MetricaDashboard[]>(() => {
    const metricas: MetricaDashboard[] = [
      {
        etiqueta: 'Cumplimiento del plan',
        valor: porcentaje(this.cumplimientoPlan()),
        detalle: 'Unidades aprobadas ÷ planeadas',
        tono: this.cumplimientoPlan() >= 90 ? 'VERDE' : 'AMBAR',
      },
      {
        etiqueta: 'Merma de producción',
        valor: porcentaje(MERMA_PRODUCCION_DEMO),
        detalle: 'Referencia: menor a 5 %',
        tono: MERMA_PRODUCCION_DEMO < 5 ? 'VERDE' : 'ROJO',
      },
      {
        etiqueta: 'Merma de material',
        valor: porcentaje(MERMA_MATERIAL_DEMO),
        detalle: 'Referencia: menor a 5 %',
        tono: MERMA_MATERIAL_DEMO < 5 ? 'VERDE' : 'ROJO',
      },
      {
        etiqueta: 'Rechazo en revisión',
        valor: porcentaje(TASA_RECHAZO_DEMO),
        detalle: '(Reproceso + merma) ÷ revisadas',
        tono: 'INFO',
      },
      {
        etiqueta: 'Costo perdido',
        valor: mxn(this.costoPerdido()),
        detalle: 'Suma de mermas de demostración',
        tono: 'ROJO',
        soloAdmin: true,
      },
    ];
    return this.esAdmin() ? metricas : metricas.filter((metrica) => !metrica.soloAdmin);
  });

  readonly metricasAbastecimiento = computed<MetricaDashboard[]>(() => [
    {
      etiqueta: 'Materiales en riesgo',
      valor: numero(this.materialesEnRiesgo()),
      detalle: 'Rojo y ámbar · demostración',
      tono: 'ROJO',
    },
    {
      etiqueta: 'Compras pendientes',
      valor: numero(this.comprasPendientes()),
      detalle: 'Órdenes de compra abiertas',
      tono: 'INFO',
    },
    {
      etiqueta: 'Compras retrasadas',
      valor: numero(this.comprasRetrasadas()),
      detalle: 'Requieren gestión con proveedor',
      tono: 'ROJO',
    },
    {
      etiqueta: 'Entregas de proveedor a tiempo',
      valor: porcentaje(ENTREGAS_PROVEEDOR_DEMO),
      detalle: 'Referencia: 80 % mínimo',
      tono: ENTREGAS_PROVEEDOR_DEMO >= 80 ? 'VERDE' : 'ROJO',
    },
    {
      etiqueta: 'Aceptación de materiales',
      valor: porcentaje(ACEPTACION_MATERIAL_DEMO),
      detalle: 'Cantidad aceptada ÷ recibida',
      tono: 'INFO',
    },
  ]);

  readonly metricasLogistica = computed<MetricaDashboard[]>(() => [
    {
      etiqueta: 'Pedidos estancados',
      valor: numero(this.pedidosEstancados().length),
      detalle: 'Semáforo rojo en M09',
      tono: this.pedidosEstancados().length > 0 ? 'ROJO' : 'VERDE',
    },
    {
      etiqueta: 'Pedidos a tiempo',
      valor: porcentaje(this.pedidosATiempo()),
      detalle: 'Meta 95 %',
      tono: this.pedidosATiempo() >= 95 ? 'VERDE' : 'AMBAR',
    },
    {
      etiqueta: 'Éxito en primer intento',
      valor: porcentaje(this.entregasPrimerIntento()),
      detalle: 'Entregas exitosas en intento 1',
      tono: 'INFO',
    },
    {
      etiqueta: 'Tiempo de entrega',
      valor: this.pedidos.formatoTiempo(this.tiempoEntregaHoras()),
      detalle: 'Promedio desde salida hasta resultado',
      tono: 'INFO',
    },
    {
      etiqueta: 'Tasa de devolución',
      valor: porcentaje(TASA_DEVOLUCION_DEMO),
      detalle: 'Referencia: menor a 3 % · demostración',
      tono: TASA_DEVOLUCION_DEMO < 3 ? 'VERDE' : 'ROJO',
    },
  ]);

  exportarCsv(seccion: SeccionDashboard): void {
    const datos = this.datosCsv(seccion);
    if (datos.filas.length === 0) {
      this.avisos.mostrar('informacion', 'No hay datos para exportar con los filtros actuales.');
      return;
    }

    const contenido = [datos.encabezados, ...datos.filas]
      .map((fila) =>
        fila
          .map((celda) => `"${String(celda ?? '').replaceAll('"', '""')}"`)
          .join(','),
      )
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8;' }),
    );
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `${datos.nombre}-${fechaIso(new Date())}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
    this.avisos.mostrar('exito', 'CSV generado en el navegador; no se envió nada a Flask.');
  }

  private datosCsv(seccion: SeccionDashboard): {
    nombre: string;
    encabezados: string[];
    filas: (string | number)[][];
  } {
    switch (seccion) {
      case 'resumen':
        return {
          nombre: 'dashboard-resumen',
          encabezados: ['Indicador', 'Valor', 'Detalle'],
          filas: this.metricasResumen().map((metrica) => [
            metrica.etiqueta,
            metrica.valor,
            metrica.detalle,
          ]),
        };
      case 'ventas-productos':
        if (!this.esAdmin()) {
          return { nombre: 'dashboard-ventas', encabezados: [], filas: [] };
        }
        return {
          nombre: 'dashboard-ventas-productos',
          encabezados: [
            'SKU',
            'Producto',
            'Categoría',
            'Color',
            'Talla',
            'Piezas',
            'Ingresos',
            'Margen real %',
          ],
          filas: this.ingresosPorSku().map((item) => [
            item.sku,
            item.producto,
            item.categoria,
            item.color,
            item.talla,
            item.piezas,
            item.ingresos,
            Math.round(item.margen * 10) / 10,
          ]),
        };
      case 'produccion-merma': {
        const encabezados = [
          'Orden',
          'SKU',
          'Semáforo',
          'Planeadas',
          'Aprobadas',
          'Alcanza para',
          'Etapa',
        ];
        if (this.esAdmin()) {
          encabezados.push('Costo perdido estimado');
        }
        return {
          nombre: 'dashboard-produccion',
          encabezados,
          filas: this.ordenes().map((orden) => {
            const fila: (string | number)[] = [
              orden.folio,
              orden.sku,
              orden.tono,
              orden.planeadas,
              orden.aprobadas,
              orden.alcanzaPara,
              orden.etapa,
            ];
            if (this.esAdmin()) {
              const mermas = MERMAS_DEMO.filter((item) => item.etapa === orden.etapa);
              fila.push(mermas.reduce((suma, item) => suma + item.costo, 0));
            }
            return fila;
          }),
        };
      }
      case 'abastecimiento':
        return {
          nombre: 'dashboard-abastecimiento',
          encabezados: ['Orden', 'Proveedor', 'Material', 'Cantidad', 'Compromiso', 'Estado'],
          filas: this.compras().map((compra) => [
            compra.folio,
            compra.proveedor,
            compra.material,
            compra.cantidad,
            compra.compromiso,
            compra.estado,
          ]),
        };
      case 'logistica-devoluciones':
        return {
          nombre: 'dashboard-logistica',
          encabezados: ['Pedido', 'Cliente', 'Estado', 'Días en estado'],
          filas: this.pedidos.pedidos().map((pedido: Pedido) => [
            pedido.folio,
            pedido.cliente,
            ETIQUETAS_ESTADO_PEDIDO_DASH[pedido.estado],
            Math.round(this.pedidos.horasEnEstado(pedido) / 24),
          ]),
        };
    }
  }
}
