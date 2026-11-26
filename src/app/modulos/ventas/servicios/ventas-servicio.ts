import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { aNumero } from '../../../core/api/formato';
import { mensajeError } from '../../../core/api/errores';
import type {
  ContextoDescuento,
  Descuento,
  DireccionVenta,
  LineaVenta,
  MetodoPago,
  PagoVenta,
  SolicitudVentaManual,
  Venta,
} from '../modelos/venta';

const dos = (valor: number): string => String(valor).padStart(2, '0');

/** Fecha local en formato AAAA-MM-DD, sin el desfase de toISOString(). */
export function fechaHoyIso(): string {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

export interface DatosPagoRegistrado {
  monto: number;
  metodo: MetodoPago;
  titular?: string | null;
  estado: 'APROBADO' | 'PENDIENTE';
}

export interface ClienteManual {
  id: number;
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
}

export interface VarianteManual {
  sku: string;
  nombreProducto: string;
  talla: string;
  color: string;
  precioUnitario: number;
}

export type ResultadoEliminacionDescuento = 'eliminado' | 'desactivado' | 'no-encontrado';

export interface ResultadoVenta {
  ok: boolean;
  mensaje: string;
  venta?: Venta;
}

interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

interface VentaResumenApi {
  id: number;
  folio: string;
  fecha: string;
  cliente: { nombre: string; apellidos?: string; correo?: string };
  canal: string;
  estado: string;
  estado_pago: string;
  total: string;
  pedido_estado: string | null;
}

interface VentaDetalleApi {
  id: number;
  folio: string;
  fecha: string;
  cliente_id: number | null;
  cliente?: { nombre: string; apellidos?: string; correo?: string };
  canal: string;
  estado: string;
  estado_pago: string;
  subtotal: string;
  descuento_monto: string;
  descuento_id?: number | null;
  descuento?: { nombre?: string } | null;
  costo_envio: string;
  total: string;
  iva_importe: string;
  iva_incluido?: boolean;
  requiere_factura?: boolean;
  fecha_promesa?: string | null;
  cancelada_en?: string | null;
  motivo_cancelacion?: string | null;
  creada_por?: number | string | null;
  notas?: string | null;
  pedido?: { id?: number; folio?: string; estado?: string } | null;
  lineas?: Array<{
    sku: string;
    nombre_producto: string;
    talla: string;
    color: string;
    cantidad: number;
    precio_unitario: string;
    subtotal: string;
    costo_estandar_unitario: string;
  }>;
  direcciones?: Array<{
    tipo: string;
    destinatario: string;
    telefono: string;
    calle: string;
    numero_ext: string;
    numero_int?: string | null;
    colonia: string;
    municipio: string;
    estado: string;
    codigo_postal: string;
    referencia?: string | null;
    rfc?: string | null;
    razon_social?: string | null;
  }>;
  pagos?: Array<{
    id: number;
    tipo: string;
    metodo: string;
    estado: string;
    monto: string;
    referencia: string;
    ultimos4?: string | null;
    titular?: string | null;
    motivo_rechazo?: string | null;
    fecha?: string | null;
  }>;
}

interface DescuentoApi {
  id: number;
  nombre: string;
  codigo: string | null;
  tipo: string;
  valor: string;
  aplicacion: string;
  solo_primera_compra: boolean;
  monto_minimo: string | null;
  min_articulos: number | null;
  vigente_desde: string;
  vigente_hasta: string | null;
  usos_maximos: number | null;
  usos_por_cliente: number;
  usos_actuales: number;
  activo: boolean;
}

interface TarifaApi {
  id: number;
  nombre: string;
  cp_inicio: string;
  cp_fin: string;
  costo: string;
  dias_estimados: number;
  activa: boolean;
}

interface CoberturaApi {
  cobertura: boolean;
  costo: string | null;
  dias_estimados: number | null;
}

interface ClienteApi {
  id: number;
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
}

interface ProductoCatalogoApi {
  id: number;
  nombre: string;
  precio_venta: string;
  variantes: Array<{ sku: string; talla: string; color: string }>;
}

function nombreCliente(cliente: VentaResumenApi['cliente'] | undefined): string {
  if (!cliente) {
    return 'Cliente';
  }
  return [cliente.nombre, cliente.apellidos].filter(Boolean).join(' ').trim();
}

function deResumenApi(item: VentaResumenApi): Venta {
  return {
    id: item.id,
    folio: item.folio,
    cliente: nombreCliente(item.cliente),
    clienteId: null,
    fecha: item.fecha,
    canal: item.canal as Venta['canal'],
    estado: item.estado as Venta['estado'],
    estadoPago: item.estado_pago as Venta['estadoPago'],
    estadoPedido: item.pedido_estado ? (item.pedido_estado as Venta['estadoPedido']) : null,
    pedidoFolio: '',
    subtotal: null,
    descuentoId: null,
    descuentoNombre: null,
    descuentoMonto: 0,
    costoEnvio: 0,
    total: aNumero(item.total),
    ivaIncluido: 0,
    requiereFactura: false,
    fechaPromesa: null,
    canceladaEn: null,
    motivoCancelacion: null,
    creadaPor: '',
    notas: null,
    lineas: [],
    direcciones: [],
    pagos: [],
  };
}

function deDetalleApi(item: VentaDetalleApi): Venta {
  return {
    id: item.id,
    folio: item.folio,
    cliente: nombreCliente(item.cliente),
    clienteId: item.cliente_id ?? null,
    fecha: item.fecha,
    canal: item.canal as Venta['canal'],
    estado: item.estado as Venta['estado'],
    estadoPago: item.estado_pago as Venta['estadoPago'],
    estadoPedido: item.pedido?.estado ? (item.pedido.estado as Venta['estadoPedido']) : null,
    pedidoFolio: item.pedido?.folio ?? '',
    subtotal: aNumero(item.subtotal),
    descuentoId: item.descuento_id ?? null,
    descuentoNombre: item.descuento?.nombre ?? null,
    descuentoMonto: aNumero(item.descuento_monto),
    costoEnvio: aNumero(item.costo_envio),
    total: aNumero(item.total),
    ivaIncluido: aNumero(item.iva_importe),
    requiereFactura: Boolean(item.requiere_factura),
    fechaPromesa: item.fecha_promesa ?? null,
    canceladaEn: item.cancelada_en ?? null,
    motivoCancelacion: item.motivo_cancelacion ?? null,
    creadaPor: item.creada_por === null || item.creada_por === undefined ? '' : String(item.creada_por),
    notas: item.notas ?? null,
    lineas: (item.lineas ?? []).map((linea): LineaVenta => ({
      sku: linea.sku,
      nombreProducto: linea.nombre_producto,
      talla: linea.talla,
      color: linea.color,
      cantidad: linea.cantidad,
      precioUnitario: aNumero(linea.precio_unitario),
      subtotal: aNumero(linea.subtotal),
      costoEstandarUnitario: aNumero(linea.costo_estandar_unitario),
    })),
    direcciones: (item.direcciones ?? []).map((direccion): DireccionVenta => ({
      tipo: direccion.tipo as DireccionVenta['tipo'],
      destinatario: direccion.destinatario,
      telefono: direccion.telefono,
      calle: direccion.calle,
      numeroExt: direccion.numero_ext,
      numeroInt: direccion.numero_int ?? null,
      colonia: direccion.colonia,
      municipio: direccion.municipio,
      estado: direccion.estado,
      codigoPostal: direccion.codigo_postal,
      referencia: direccion.referencia ?? null,
      rfc: direccion.rfc ?? null,
      razonSocial: direccion.razon_social ?? null,
    })),
    pagos: (item.pagos ?? []).map((pago): PagoVenta => ({
      id: pago.id,
      tipo: pago.tipo as PagoVenta['tipo'],
      metodo: pago.metodo as PagoVenta['metodo'],
      estado: pago.estado as PagoVenta['estado'],
      monto: aNumero(pago.monto),
      referencia: pago.referencia,
      ultimos4: pago.ultimos4 ?? null,
      titular: pago.titular ?? null,
      motivoRechazo: pago.motivo_rechazo ?? null,
      fecha: pago.fecha ?? '',
      registradoPor: '',
    })),
  };
}

function deDescuentoApi(item: DescuentoApi): Descuento {
  return {
    id: item.id,
    nombre: item.nombre,
    codigo: item.codigo,
    tipo: item.tipo as Descuento['tipo'],
    valor: aNumero(item.valor),
    aplicacion: item.aplicacion as Descuento['aplicacion'],
    soloPrimeraCompra: Boolean(item.solo_primera_compra),
    montoMinimo: item.monto_minimo === null ? null : aNumero(item.monto_minimo),
    minArticulos: item.min_articulos,
    vigenteDesde: String(item.vigente_desde).slice(0, 10),
    vigenteHasta: item.vigente_hasta ? String(item.vigente_hasta).slice(0, 10) : null,
    usosMaximos: item.usos_maximos,
    usosPorCliente: item.usos_por_cliente,
    usosActuales: item.usos_actuales,
    activo: Boolean(item.activo),
  };
}

/** Estado de M08 leído de /ventas y /descuentos; ninguna cifra se calcula en el cliente. */
@Injectable({ providedIn: 'root' })
export class VentasServicio {
  private readonly api = inject(ApiService);
  private readonly listaVentas = signal<Venta[]>([]);
  private readonly listaDescuentos = signal<Descuento[]>([]);
  private readonly detalles = signal<Record<number, Venta>>({});
  private readonly listaTarifas = signal<TarifaApi[]>([]);
  private readonly listaClientes = signal<ClienteManual[]>([]);
  private readonly listaVariantes = signal<VarianteManual[]>([]);

  /** API pública síncrona conservada para módulos externos. */
  ventas(): Venta[] {
    return this.listaVentas();
  }

  descuentos(): Descuento[] {
    return this.listaDescuentos();
  }

  clientes(): ClienteManual[] {
    return this.listaClientes();
  }

  variantes(): VarianteManual[] {
    return this.listaVariantes();
  }

  readonly indicadores = computed(() => {
    const hoy = fechaHoyIso();
    const mes = hoy.slice(0, 7);
    const activasDelMes = this.listaVentas().filter(
      (venta) => venta.estado === 'ACTIVA' && venta.fecha.startsWith(mes),
    );
    const totalMes = activasDelMes.reduce((suma, venta) => suma + venta.total, 0);
    return {
      dia: this.listaVentas()
        .filter((venta) => venta.estado === 'ACTIVA' && venta.fecha.startsWith(hoy))
        .reduce((suma, venta) => suma + venta.total, 0),
      mes: totalMes,
      ticket: activasDelMes.length === 0 ? 0 : totalMes / activasDelMes.length,
      pendientes: this.listaVentas().filter(
        (venta) => venta.estado === 'ACTIVA' && venta.estadoPago === 'PENDIENTE',
      ).length,
    };
  });

  /** Carga todas las páginas de un listado paginado del contrato. */
  private listarTodo<T>(path: string, params: Record<string, string> = {}): Observable<T[]> {
    return this.api.get<Pagina<T>>(path, { params: { ...params, pagina: 1, por_pagina: 100 } }).pipe(
      switchMap((primera) => {
        const faltantes = Math.max(0, Math.ceil(primera.total / 100) - 1);
        if (faltantes === 0) {
          return of(primera.items);
        }
        return forkJoin(
          Array.from({ length: faltantes }, (_, indice) =>
            this.api.get<Pagina<T>>(path, {
              params: { ...params, pagina: indice + 2, por_pagina: 100 },
            }),
          ),
        ).pipe(map((paginas) => [...primera.items, ...paginas.flatMap((pagina) => pagina.items)]));
      }),
    );
  }

  recargar(): Observable<void> {
    return forkJoin({
      ventas: this.listarTodo<VentaResumenApi>('/ventas'),
      descuentos: this.listarTodo<DescuentoApi>('/descuentos'),
      tarifas: this.listarTodo<TarifaApi>('/catalogos/tarifa-envio'),
    }).pipe(
      tap(({ ventas, descuentos, tarifas }) => {
        this.listaVentas.set(ventas.map(deResumenApi));
        this.listaDescuentos.set(descuentos.map(deDescuentoApi));
        this.listaTarifas.set(tarifas);
      }),
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  /** Catálogos reales para la pantalla de venta manual; ningún dato se inventa en el cliente. */
  cargarDatosManuales(): Observable<void> {
    return forkJoin({
      clientes: this.listarTodo<ClienteApi>('/clientes'),
      catalogo: this.api.get<ProductoCatalogoApi[]>('/catalogo'),
    }).pipe(
      tap(({ clientes, catalogo }) => {
        this.listaClientes.set(
          clientes.map((cliente) => ({
            id: cliente.id,
            nombre: cliente.nombre,
            apellidos: cliente.apellidos,
            correo: cliente.correo,
            telefono: cliente.telefono,
          })),
        );
        this.listaVariantes.set(
          catalogo.flatMap((producto) =>
            producto.variantes.map((variante) => ({
              sku: variante.sku,
              nombreProducto: producto.nombre,
              talla: variante.talla,
              color: variante.color,
              precioUnitario: aNumero(producto.precio_venta),
            })),
          ),
        );
      }),
      map(() => undefined),
    );
  }

  /** El contrato usa `id` para detalle y mutaciones; la ruta Angular usa `folio`. */
  private idPorFolio(folio: string): number | undefined {
    const exacto = this.listaVentas().find((venta) => venta.folio === folio);
    if (exacto) {
      return exacto.id;
    }
    const porId = Number(folio);
    return Number.isInteger(porId) && porId > 0 ? porId : undefined;
  }

  private obtenerDetalle(id: number): Observable<Venta> {
    return this.api.get<VentaDetalleApi>(`/ventas/${id}`).pipe(
      switchMap((item) => {
        const venta = deDetalleApi(item);
        const pedidoId = item.pedido?.id;
        if (pedidoId === undefined) {
          return of(venta);
        }
        return this.api
          .get<{ folio: string; estado: string }>(`/pedidos/${pedidoId}`)
          .pipe(
            map((pedido) => ({
              ...venta,
              pedidoFolio: pedido.folio,
              estadoPedido: pedido.estado as Venta['estadoPedido'],
            })),
            catchError(() => of(venta)),
          );
      }),
      map((venta) => {
        this.detalles.update((actuales) => ({ ...actuales, [venta.id]: venta }));
        this.listaVentas.update((actuales) =>
          actuales.map((existente) =>
            existente.id === venta.id
              ? { ...existente, ...deResumenApiFromDetalle(venta) }
              : existente,
          ),
        );
        return venta;
      }),
    );
  }

  cargarDetalle(folio: string): Observable<Venta | undefined> {
    const porId = Number(folio);
    if (Number.isInteger(porId) && porId > 0) {
      return this.obtenerDetalle(porId).pipe(catchError(() => of(undefined)));
    }
    const conocido = this.idPorFolio(folio);
    if (conocido !== undefined) {
      return this.obtenerDetalle(conocido).pipe(catchError(() => of(undefined)));
    }
    return this.recargar().pipe(
      switchMap(() => {
        const resuelto = this.idPorFolio(folio);
        return resuelto === undefined
          ? of(undefined)
          : this.obtenerDetalle(resuelto).pipe(catchError(() => of(undefined)));
      }),
    );
  }

  obtenerVenta(folio: string): Venta | undefined {
    const id = this.idPorFolio(folio);
    return id === undefined ? undefined : (this.detalles()[id] ?? this.listaVentas().find((v) => v.id === id));
  }

  obtenerDescuento(id: number): Descuento | undefined {
    return this.listaDescuentos().find((descuento) => descuento.id === id);
  }

  /** Cobertura autoritativa de M02; el catálogo local sólo se usa como apoyo visual. */
  consultarCobertura(codigoPostal: string): Observable<{ costo: number; dias: number } | null> {
    if (!/^\d{5}$/.test(codigoPostal)) {
      return of(null);
    }
    return this.api
      .get<CoberturaApi>('/envio/cobertura', { params: { cp: codigoPostal } })
      .pipe(
        map((item) =>
          item.cobertura && item.costo !== null && item.dias_estimados !== null
            ? { costo: aNumero(item.costo), dias: item.dias_estimados }
            : null,
        ),
        catchError(() => of(null)),
      );
  }

  /** Tarifa vigente del catálogo M22 filtrada por rango de código postal. */
  tarifaPorCodigoPostal(codigoPostal: string): { costo: number; dias: number } | null {
    if (!/^\d{5}$/.test(codigoPostal)) {
      return null;
    }
    const codigo = Number(codigoPostal);
    const tarifa = this.listaTarifas().find(
      (item) =>
        item.activa &&
        Number(item.cp_inicio) <= codigo &&
        Number(item.cp_fin) >= codigo,
    );
    return tarifa ? { costo: aNumero(tarifa.costo), dias: tarifa.dias_estimados } : null;
  }

  buscarCupon(codigo: string): Descuento | undefined {
    const normalizado = codigo.trim().toUpperCase();
    return this.listaDescuentos().find(
      (descuento) =>
        descuento.activo &&
        descuento.aplicacion === 'CUPON' &&
        descuento.codigo?.toUpperCase() === normalizado,
    );
  }

  /** Validación informativa: el servidor recalcula el descuento al pagar. */
  validarDescuento(descuento: Descuento, contexto: ContextoDescuento) {
    const hoy = fechaHoyIso();
    if (!descuento.activo) {
      return { valido: false, motivo: 'El descuento está inactivo.', monto: 0 };
    }
    if (descuento.vigenteDesde > hoy) {
      return { valido: false, motivo: 'El descuento aún no entra en vigencia.', monto: 0 };
    }
    if (descuento.vigenteHasta !== null && descuento.vigenteHasta < hoy) {
      return { valido: false, motivo: 'El descuento ya venció.', monto: 0 };
    }
    if (descuento.usosMaximos !== null && descuento.usosActuales >= descuento.usosMaximos) {
      return { valido: false, motivo: 'Se agotaron los usos del descuento.', monto: 0 };
    }
    if (descuento.soloPrimeraCompra && !contexto.esPrimeraCompra) {
      return { valido: false, motivo: 'Solo aplica a la primera compra.', monto: 0 };
    }
    if (descuento.montoMinimo !== null && contexto.subtotal < descuento.montoMinimo) {
      return { valido: false, motivo: `Requiere un subtotal de $${descuento.montoMinimo}.`, monto: 0 };
    }
    if (descuento.minArticulos !== null && contexto.cantidadArticulos < descuento.minArticulos) {
      return { valido: false, motivo: `Requiere al menos ${descuento.minArticulos} artículos.`, monto: 0 };
    }
    const bruto =
      descuento.tipo === 'PORCENTAJE'
        ? (contexto.subtotal * descuento.valor) / 100
        : descuento.valor;
    return {
      valido: true,
      motivo: '',
      monto: Math.min(Math.round(bruto * 100) / 100, contexto.subtotal),
    };
  }

  descuentoAutomatico(contexto: ContextoDescuento): Descuento | undefined {
    return this.listaDescuentos()
      .filter((descuento) => descuento.activo && descuento.aplicacion === 'AUTOMATICO')
      .map((descuento) => ({ descuento, validacion: this.validarDescuento(descuento, contexto) }))
      .filter((candidato) => candidato.validacion.valido)
      .sort((a, b) => b.validacion.monto - a.validacion.monto)[0]?.descuento;
  }

  crearVentaManual(solicitud: SolicitudVentaManual): Observable<ResultadoVenta> {
    const direccion = solicitud.direccionEnvio;
    const factura = solicitud.direccionFacturacion;
    const cuerpo = {
      ...(solicitud.cliente.esNuevoSinAcceso ? {} : { cliente_id: solicitud.cliente.id }),
      ...(solicitud.cliente.esNuevoSinAcceso
        ? {
            cliente: {
              nombre: solicitud.cliente.nombre,
              apellidos: solicitud.cliente.apellidos,
              correo: solicitud.cliente.correo,
              telefono: solicitud.cliente.telefono,
            },
          }
        : {}),
      lineas: solicitud.lineas.map((linea) => ({ sku: linea.sku, cantidad: linea.cantidad })),
      direccion: {
        tipo: direccion.tipo,
        destinatario: direccion.destinatario,
        telefono: direccion.telefono,
        calle: direccion.calle,
        numero_ext: direccion.numeroExt,
        numero_int: direccion.numeroInt,
        colonia: direccion.colonia,
        municipio: direccion.municipio,
        estado: direccion.estado,
        codigo_postal: direccion.codigoPostal,
        referencia: direccion.referencia,
      },
      metodo_pago: solicitud.metodoPago,
      estado_pago: solicitud.estadoPago,
      descuento_codigo: this.obtenerDescuento(solicitud.descuentoId ?? 0)?.codigo ?? null,
      requiere_factura: factura.rfc !== null,
      rfc: factura.rfc,
      razon_social: factura.razonSocial,
      cp_fiscal: direccion.codigoPostal,
      notas: null,
    };
    return this.api.post<VentaDetalleApi>('/ventas/manual', cuerpo).pipe(
      map((item) => {
        const venta = deDetalleApi(item);
        this.detalles.update((actuales) => ({ ...actuales, [venta.id]: venta }));
        return {
          ok: true,
          mensaje: `Venta ${venta.folio} registrada y persistida.`,
          venta,
        };
      }),
      tap(() => this.recargar().subscribe()),
      catchError((error) =>
        of({ ok: false, mensaje: mensajeError(error, 'No fue posible registrar la venta.') }),
      ),
    );
  }

  registrarPago(folio: string, datos: DatosPagoRegistrado): Observable<ResultadoVenta> {
    const id = this.idPorFolio(folio);
    if (id === undefined) {
      return of({ ok: false, mensaje: 'No encontramos la venta.' });
    }
    if (datos.estado === 'APROBADO' && (datos.metodo === 'TARJETA' || datos.metodo === 'CUENTA')) {
      return of({
        ok: false,
        mensaje: 'Para tarjeta o cuenta se requiere un medio de pago guardado; este panel no captura PAN ni CVV.',
      });
    }
    const aprueba = datos.estado === 'APROBADO';
    const cuerpo = {
      accion: aprueba ? 'APROBAR' : 'RECHAZAR',
      metodo_pago: datos.metodo,
      titular: datos.titular ?? null,
      motivo: aprueba ? null : 'Pago rechazado desde el panel de ventas',
    };
    return this.api.post<VentaDetalleApi>(`/ventas/${id}/pago`, cuerpo).pipe(
      map((item) => {
        const venta = deDetalleApi(item);
        this.detalles.update((actuales) => ({ ...actuales, [venta.id]: venta }));
        return { ok: true, mensaje: `Pago actualizado en la venta ${venta.folio}.`, venta };
      }),
      tap(() => this.recargar().subscribe()),
      catchError((error) => of({ ok: false, mensaje: mensajeError(error) })),
    );
  }

  validarPago(folio: string): Observable<ResultadoVenta> {
    const id = this.idPorFolio(folio);
    if (id === undefined) {
      return of({ ok: false, mensaje: 'No encontramos la venta.' });
    }
    return this.api
      .post<VentaDetalleApi>(`/ventas/${id}/pago`, { accion: 'APROBAR', metodo_pago: 'TRANSFERENCIA' })
      .pipe(
        map((item) => {
          const venta = deDetalleApi(item);
          this.detalles.update((actuales) => ({ ...actuales, [venta.id]: venta }));
          return { ok: true, mensaje: `Pago de la venta ${venta.folio} aprobado.`, venta };
        }),
        tap(() => this.recargar().subscribe()),
        catchError((error) => of({ ok: false, mensaje: mensajeError(error) })),
      );
  }

  cancelarVenta(folio: string, motivo: string): Observable<ResultadoVenta> {
    const id = this.idPorFolio(folio);
    if (id === undefined) {
      return of({ ok: false, mensaje: 'No encontramos la venta.' });
    }
    return this.api.post<VentaDetalleApi>(`/ventas/${id}/cancelar`, { motivo }).pipe(
      map((item) => {
        const venta = deDetalleApi(item);
        this.detalles.update((actuales) => ({ ...actuales, [venta.id]: venta }));
        return { ok: true, mensaje: `Venta ${venta.folio} cancelada; reembolso simulado registrado.`, venta };
      }),
      tap(() => this.recargar().subscribe()),
      catchError((error) => of({ ok: false, mensaje: mensajeError(error) })),
    );
  }

  reembolsar(folio: string, monto: number, motivo: string): Observable<ResultadoVenta> {
    const id = this.idPorFolio(folio);
    if (id === undefined) {
      return of({ ok: false, mensaje: 'No encontramos la venta.' });
    }
    return this.api.post<VentaDetalleApi>(`/ventas/${id}/reembolso`, { monto, motivo }).pipe(
      map((item) => {
        const venta = deDetalleApi(item);
        this.detalles.update((actuales) => ({ ...actuales, [venta.id]: venta }));
        return { ok: true, mensaje: `Reembolso registrado en la venta ${venta.folio}.`, venta };
      }),
      tap(() => this.recargar().subscribe()),
      catchError((error) => of({ ok: false, mensaje: mensajeError(error) })),
    );
  }

  guardarDescuento(descuento: Descuento): Observable<ResultadoVenta> {
    const cuerpo = {
      nombre: descuento.nombre,
      codigo: descuento.codigo,
      tipo: descuento.tipo,
      valor: descuento.valor,
      aplicacion: descuento.aplicacion,
      solo_primera_compra: descuento.soloPrimeraCompra,
      monto_minimo: descuento.montoMinimo,
      min_articulos: descuento.minArticulos,
      vigente_desde: descuento.vigenteDesde,
      vigente_hasta: descuento.vigenteHasta,
      usos_maximos: descuento.usosMaximos,
      usos_por_cliente: descuento.usosPorCliente,
      activo: descuento.activo,
    };
    const peticion =
      descuento.id === 0
        ? this.api.post<DescuentoApi>('/descuentos', cuerpo)
        : this.api.patch<DescuentoApi>(`/descuentos/${descuento.id}`, cuerpo);
    return peticion.pipe(
      map(() => ({
        ok: true,
        mensaje: `Descuento «${descuento.nombre}» guardado en servidor.`,
      })),
      tap(() => this.recargar().subscribe()),
      catchError((error) => of({ ok: false, mensaje: mensajeError(error) })),
    );
  }

  /** DELETE /descuentos/{id}: el servidor desactiva si ya se usó y borra si no. */
  eliminarDescuento(id: number): Observable<ResultadoEliminacionDescuento> {
    const previo = this.obtenerDescuento(id);
    return this.api.delete<void>(`/descuentos/${id}`).pipe(
      map(() => (previo && previo.usosActuales > 0 ? 'desactivado' : 'eliminado')),
      tap(() => this.recargar().subscribe()),
      catchError(() => of('no-encontrado' as const)),
    );
  }
}

function deResumenApiFromDetalle(venta: Venta): Venta {
  return {
    id: venta.id,
    folio: venta.folio,
    cliente: venta.cliente,
    clienteId: venta.clienteId,
    fecha: venta.fecha,
    canal: venta.canal,
    estado: venta.estado,
    estadoPago: venta.estadoPago,
    estadoPedido: venta.estadoPedido,
    pedidoFolio: venta.pedidoFolio,
    subtotal: venta.subtotal,
    descuentoId: venta.descuentoId,
    descuentoNombre: venta.descuentoNombre,
    descuentoMonto: venta.descuentoMonto,
    costoEnvio: venta.costoEnvio,
    total: venta.total,
    ivaIncluido: venta.ivaIncluido,
    requiereFactura: venta.requiereFactura,
    fechaPromesa: venta.fechaPromesa,
    canceladaEn: venta.canceladaEn,
    motivoCancelacion: venta.motivoCancelacion,
    creadaPor: venta.creadaPor,
    notas: venta.notas,
    lineas: [],
    direcciones: [],
    pagos: [],
  };
}
