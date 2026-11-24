import { Injectable, computed, inject, signal } from '@angular/core';
import { AvisosServicio } from '../../../nucleo/servicios/avisos-servicio';
import { EntregasServicio } from '../../entregas/servicios/entregas-servicio';
import { InventarioProductoServicio } from '../../inventario-producto-terminado/servicios/inventario-producto-terminado-servicio';
import { ETIQUETAS_ESTADO, PedidosServicio } from '../../pedidos/servicios/pedidos-servicio';
import { ProveedoresServicio } from '../../proveedores/servicios/proveedores-servicio';
import { VentasServicio } from '../../ventas/servicios/ventas-servicio';
import { ALERTAS_DEMO, REGLAS_INICIALES, TIPOS_ALERTA } from '../datos-simulados/alertas';
import type {
  AlertaCentro,
  ContadoresSeveridad,
  ReglaAlerta,
  ResultadoRegla,
  RolVistaAlertas,
  TipoAlertaCentro,
} from '../modelos/alerta-centro';
import { fechaLegible } from '../modelos/alerta-centro';

const dos = (valor: number): string => String(valor).padStart(2, '0');

function isoHace(horas: number): string {
  const fecha = new Date(Date.now() - horas * 3_600_000);
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:00`;
}

/**
 * Proyección de solo lectura/acciones locales de M21. Las alertas se derivan
 * de los servicios dueños (M08, M09, M12, M19) o se marcan como demostración
 * cuando su módulo aún no existe. Flask conservará la clave única, cerrará por
 * condición resuelta y ejecutará las acciones reales.
 */
@Injectable({
  providedIn: 'root',
})
export class AlertasServicio {
  private readonly inventario = inject(InventarioProductoServicio);
  private readonly entregas = inject(EntregasServicio);
  private readonly pedidos = inject(PedidosServicio);
  private readonly proveedores = inject(ProveedoresServicio);
  private readonly ventas = inject(VentasServicio);
  private readonly avisos = inject(AvisosServicio);

  /** Vista previa demostrativa; no sustituye authGuard ni roleGuard. */
  private readonly rolLista = signal<RolVistaAlertas>('Administrador');
  private readonly reglasLista = signal<ReglaAlerta[]>(
    REGLAS_INICIALES.map((regla) => ({ ...regla })),
  );

  private readonly lista = signal<AlertaCentro[]>(this.condicionesActuales());

  readonly rol = this.rolLista.asReadonly();
  readonly esAdmin = computed(() => this.rolLista() === 'Administrador');
  readonly reglas = this.reglasLista.asReadonly();
  readonly tipos = TIPOS_ALERTA;

  readonly visibles = computed(() =>
    this.lista().filter((alerta) => this.puedeVer(alerta, this.rolLista())),
  );

  readonly abiertas = computed(() =>
    this.visibles()
      .filter((alerta) => alerta.estado === 'ABIERTA')
      .sort((a, b) => b.abiertaEn.localeCompare(a.abiertaEn)),
  );

  readonly resueltas = computed(() =>
    this.visibles()
      .filter((alerta) => alerta.estado !== 'ABIERTA')
      .sort((a, b) => (b.atendidaEn ?? '').localeCompare(a.atendidaEn ?? '')),
  );

  readonly contadores = computed<ContadoresSeveridad>(() => {
    const abiertas = this.abiertas();
    return {
      todas: abiertas.length,
      criticas: abiertas.filter((alerta) => alerta.severidad === 'CRITICA').length,
      preventivas: abiertas.filter((alerta) => alerta.severidad === 'PREVENTIVA').length,
      informativas: abiertas.filter((alerta) => alerta.severidad === 'INFORMATIVA').length,
    };
  });

  cambioRol(rol: RolVistaAlertas): void {
    this.rolLista.set(rol);
  }

  /** Aplica la regla de clave única y cierra sola la condición que desapareció. */
  sincronizar(): void {
    const actuales = this.condicionesActuales();
    const claves = new Set(
      actuales.map((alerta) => alerta.claveUnica).filter((clave): clave is string => clave !== null),
    );

    this.lista.update((lista) => {
      let resultado = [...lista];
      for (const alerta of actuales) {
        const yaRegistrada = resultado.some(
          (item) =>
            item.id === alerta.id ||
            (item.estado === 'ABIERTA' && item.claveUnica === alerta.claveUnica),
        );
        if (!yaRegistrada) {
          resultado = [alerta, ...resultado];
        }
      }

      const ahora = new Date().toISOString();
      return resultado.map((alerta) =>
        alerta.estado === 'ABIERTA' &&
        alerta.claveUnica !== null &&
        !claves.has(alerta.claveUnica)
          ? {
              ...alerta,
              estado: 'RESUELTA_AUTO' as const,
              claveUnica: null,
              atendidaPor: 'Sistema (condición resuelta)',
              atendidaEn: ahora,
            }
          : alerta,
      );
    });
  }

  atender(id: string): void {
    const alerta = this.lista().find((item) => item.id === id);
    if (!alerta || alerta.estado !== 'ABIERTA') {
      return;
    }
    if (!this.puedeVer(alerta, this.rolLista())) {
      this.avisos.mostrar('error', 'Esa alerta no corresponde al rol demostrativo seleccionado.');
      return;
    }

    const ahora = new Date().toISOString();
    this.lista.update((lista) =>
      lista.map((item) =>
        item.id === id
          ? {
              ...item,
              estado: 'ATENDIDA' as const,
              claveUnica: null,
              atendidaPor: this.rolLista(),
              atendidaEn: ahora,
            }
          : item,
      ),
    );
    this.avisos.mostrar(
      'exito',
      `Alerta marcada como atendida en memoria. La acción «${alerta.accionSugerida ?? 'correspondiente'}» se ejecutará en Flask.`,
    );
  }

  guardarRegla(clave: string, valor: number): ResultadoRegla {
    if (!this.esAdmin()) {
      return { ok: false, mensaje: 'Las reglas solo pueden editarse con el rol Administrador.' };
    }
    const regla = this.reglasLista().find((item) => item.clave === clave);
    if (!regla) {
      return { ok: false, mensaje: 'No encontramos el parámetro indicado.' };
    }
    if (!Number.isInteger(valor) || valor < regla.min || valor > regla.max) {
      return {
        ok: false,
        mensaje: `${regla.etiqueta} debe ser un entero entre ${regla.min} y ${regla.max} ${regla.unidad}.`,
      };
    }

    this.reglasLista.update((reglas) =>
      reglas.map((item) => (item.clave === clave ? { ...item, valor } : item)),
    );
    return {
      ok: true,
      mensaje: `${regla.etiqueta} actualizado en memoria; Flask aplicará el nuevo umbral a las reglas de alertas.`,
    };
  }

  restablecerReglas(): void {
    this.reglasLista.set(REGLAS_INICIALES.map((regla) => ({ ...regla })));
    this.avisos.mostrar('informacion', 'Umbrales restablecidos a los valores del documento v3.0.');
  }

  registro(tipo: TipoAlertaCentro) {
    return this.tipos.find((item) => item.tipo === tipo);
  }

  private puedeVer(alerta: AlertaCentro, rol: RolVistaAlertas): boolean {
    return (
      alerta.rolDestino === 'AMBOS' ||
      (rol === 'Administrador'
        ? alerta.rolDestino === 'ADMIN'
        : alerta.rolDestino === 'OPERATIVO')
    );
  }

  /** Estado actual de las condiciones que puede observar este frontend. */
  private condicionesActuales(): AlertaCentro[] {
    const lista: AlertaCentro[] = [];
    const limitePago =
      this.reglasLista().find((regla) => regla.clave === 'horas_max_recibido')?.valor ?? 2;
    const minimoATiempo =
      this.reglasLista().find(
        (regla) => regla.clave === 'proveedor_minimo_a_tiempo_pct',
      )?.valor ?? 80;

    const pedidosEspera = this.pedidos
      .pedidos()
      .filter((pedido) => pedido.estado === 'EN_PRODUCCION' || pedido.estado === 'CONFIRMADO');

    for (const fila of this.inventario
      .existencias()
      .filter((item) => item.semaforo === 'ROJO' && pedidosEspera.length > 0)
      .slice(0, 2)) {
      const pedido = pedidosEspera[0]!;
      lista.push({
        id: `pt-agotado-${fila.varianteId}`,
        tipo: 'PT_AGOTADO_DEMANDA',
        severidad: 'CRITICA',
        titulo: `${fila.sku} sin disponible con pedidos esperando`,
        detalle: `Disponible 0 y ${fila.reservado} unidades reservadas. ${pedidosEspera.length} pedido(s) en espera; el más antiguo es ${pedido.folio}.`,
        entidadTipo: 'variante',
        entidadId: String(fila.varianteId),
        rolDestino: 'AMBOS',
        accionSugerida: 'Generar orden de producción',
        estado: 'ABIERTA',
        claveUnica: `PT_AGOTADO_DEMANDA:variante:${fila.varianteId}`,
        abiertaEn: isoHace(5),
        atendidaPor: null,
        atendidaEn: null,
        ruta: ['/admin', 'pedidos', pedido.folio],
        origen: 'M12 · Inventario PT',
        demo: false,
      });
    }

    for (const alerta of this.inventario
      .alertas()
      .filter((item) => item.clave === 'PT_STOCK_MINIMO')
      .slice(0, 3)) {
      lista.push({
        id: `pt-minimo-${alerta.id}`,
        tipo: 'PT_STOCK_MINIMO',
        severidad: 'PREVENTIVA',
        titulo: `${alerta.sku} en stock mínimo`,
        detalle: alerta.mensaje,
        entidadTipo: 'variante',
        entidadId: alerta.sku,
        rolDestino: 'AMBOS',
        accionSugerida: 'Generar orden de producción',
        estado: 'ABIERTA',
        claveUnica: `PT_STOCK_MINIMO:variante:${alerta.sku}`,
        abiertaEn: alerta.fecha,
        atendidaPor: null,
        atendidaEn: null,
        ruta: ['/operacion', 'inventario-pt', 'reglas'],
        origen: 'M12 · Inventario PT',
        demo: false,
      });
    }

    for (const alerta of this.inventario
      .alertas()
      .filter((item) => item.clave === 'AJUSTE_DIFERENCIA')
      .slice(0, 2)) {
      lista.push({
        id: `conteo-${alerta.id}`,
        tipo: 'DIFERENCIA_CONTEO',
        severidad: 'INFORMATIVA',
        titulo: `Diferencia de conteo · ${alerta.sku}`,
        detalle: alerta.mensaje,
        entidadTipo: 'movimiento_producto',
        entidadId: String(alerta.id),
        rolDestino: 'ADMIN',
        accionSugerida: 'Ver detalle',
        estado: 'ABIERTA',
        claveUnica: `DIFERENCIA_CONTEO:movimiento_producto:${alerta.id}`,
        abiertaEn: alerta.fecha,
        atendidaPor: null,
        atendidaEn: null,
        ruta: ['/operacion', 'inventario-pt', 'movimientos'],
        origen: 'M12 · Inventario PT',
        demo: false,
      });
    }

    for (const pedido of this.pedidos
      .pedidos()
      .filter((item) => this.pedidos.tono(item) === 'rojo')
      .slice(0, 4)) {
      lista.push({
        id: `pedido-${pedido.folio}`,
        tipo: 'PEDIDO_ESTANCADO',
        severidad: 'CRITICA',
        titulo: `Pedido estancado · ${pedido.folio}`,
        detalle: `${ETIQUETAS_ESTADO[pedido.estado]} desde ${fechaLegible(pedido.estadoDesde)}: ${this.pedidos.formatoTiempo(this.pedidos.horasEnEstado(pedido))} en el estado.`,
        entidadTipo: 'pedido',
        entidadId: pedido.folio,
        rolDestino: 'AMBOS',
        accionSugerida: 'Ver pedido',
        estado: 'ABIERTA',
        claveUnica: `PEDIDO_ESTANCADO:pedido:${pedido.folio}`,
        abiertaEn: pedido.estadoDesde,
        atendidaPor: null,
        atendidaEn: null,
        ruta: ['/admin', 'pedidos', pedido.folio],
        origen: 'M09 · Pedidos',
        demo: false,
      });
    }

    for (const entrega of this.entregas.alertasCriticas().slice(0, 3)) {
      lista.push({
        id: `entrega-${entrega.folio}`,
        tipo: 'ENTREGA_FALLIDA',
        severidad: 'CRITICA',
        titulo: `Entrega fallida en segundo intento · ${entrega.folio}`,
        detalle: `${entrega.cliente} requiere decisión del Administrador: reprogramar o cancelar con reembolso.`,
        entidadTipo: 'entrega',
        entidadId: entrega.folio,
        rolDestino: 'AMBOS',
        accionSugerida: 'Reprogramar o cancelar',
        estado: 'ABIERTA',
        claveUnica: `ENTREGA_FALLIDA:entrega:${entrega.folio}`,
        abiertaEn: entrega.fechaProgramada,
        atendidaPor: null,
        atendidaEn: null,
        ruta: ['/entregas', 'seguimiento'],
        origen: 'M19 · Entregas',
        demo: false,
      });
    }

    for (const venta of this.ventas
      .ventas()
      .filter(
        (item) =>
          item.estado === 'ACTIVA' && item.estadoPago === 'PENDIENTE' && item.canal === 'MANUAL',
      )
      .slice(0, 3)) {
      lista.push({
        id: `pago-${venta.folio}`,
        tipo: 'PAGO_PENDIENTE',
        severidad: 'PREVENTIVA',
        titulo: `Pago pendiente · ${venta.folio}`,
        detalle: `Venta manual por ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(venta.total)} sin pago aprobado desde ${fechaLegible(venta.fecha)}. Umbral de referencia: ${limitePago} h.`,
        entidadTipo: 'venta',
        entidadId: venta.folio,
        rolDestino: 'ADMIN',
        accionSugerida: 'Validar pago',
        estado: 'ABIERTA',
        claveUnica: `PAGO_PENDIENTE:venta:${venta.folio}`,
        abiertaEn: venta.fecha,
        atendidaPor: null,
        atendidaEn: null,
        ruta: ['/ventas', venta.folio],
        origen: 'M08 · Ventas',
        demo: false,
      });
    }

    for (const evaluacion of this.proveedores
      .evaluacionesRegistradas()
      .filter((item) => item.entregasATiempoPct < minimoATiempo)
      .slice(0, 3)) {
      const proveedor = this.proveedores.obtenerPorId(evaluacion.proveedorId);
      if (!proveedor || proveedor.estatus === 'INACTIVO') {
        continue;
      }
      lista.push({
        id: `proveedor-${evaluacion.proveedorId}`,
        tipo: 'PROVEEDOR_EN_REVISION',
        severidad: 'INFORMATIVA',
        titulo: `${proveedor.nombreComercial} por debajo del mínimo de entregas a tiempo`,
        detalle: `Entregas a tiempo del periodo: ${evaluacion.entregasATiempoPct} % frente al mínimo de ${minimoATiempo} %. Estatus actual: ${proveedor.estatus}.`,
        entidadTipo: 'proveedor',
        entidadId: String(proveedor.id),
        rolDestino: 'ADMIN',
        accionSugerida: 'Ver proveedor',
        estado: 'ABIERTA',
        claveUnica: `PROVEEDOR_EN_REVISION:proveedor:${proveedor.id}`,
        abiertaEn: isoHace(26),
        atendidaPor: null,
        atendidaEn: null,
        ruta: ['/proveedores', 'evaluacion'],
        origen: 'M13 · Proveedores',
        demo: false,
      });
    }

    return [...lista, ...ALERTAS_DEMO];
  }
}
