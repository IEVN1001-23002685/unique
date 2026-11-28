import { Pagina } from '../../../core/api/pagina';

export type { Pagina };

export interface ParametrosLista {
  pagina?: number;
  por_pagina?: number;
}

export interface PreparacionLinea {
  id: number;
  pedido_linea_id: number;
  sku: string | null;
  nombre_producto: string | null;
  talla: string | null;
  color: string | null;
  cantidad_requerida: number;
  cantidad_surtida: number;
  sku_verificado: boolean;
  diseno_verificado: boolean;
  etiquetas_verificadas: boolean;
  incidencia: string | null;
}

export interface Preparacion {
  id: number;
  pedido_id: number;
  folio: string | null;
  estado: string;
  prioridad: string | null;
  fecha_promesa: string | null;
  destinatario: string | null;
  codigo_postal: string | null;
  tomada_por: number | null;
  iniciada_en: string | null;
  terminada_en: string | null;
  notas: string | null;
  lineas: PreparacionLinea[];
}

export interface LineaPreparacionActualizar {
  preparacion_linea_id: number;
  sku?: string;
  cantidad_surtida?: number;
  sku_verificado?: boolean;
  diseno_verificado?: boolean;
  etiquetas_verificadas?: boolean;
}

export type TipoIncidencia = 'SKU' | 'CANTIDAD' | 'CALIDAD';

export interface IncidenciaPreparacion {
  preparacion_linea_id: number;
  tipo: TipoIncidencia;
  descripcion: string;
  cantidad?: number;
}

export interface DireccionEntrega {
  destinatario: string | null;
  telefono: string | null;
  direccion: string | null;
  codigo_postal: string | null;
}

export interface PedidoPorAsignar {
  pedido_id: number;
  venta_folio: string;
  prioridad: string | null;
  fecha_promesa: string | null;
  direccion: DireccionEntrega | null;
}

export interface Entrega {
  id: number;
  folio: string;
  pedido_id: number;
  estado: string;
  intento: number;
  fecha_programada: string;
  salida_en: string | null;
  resultado_en: string | null;
  receptor: string | null;
  motivo_fallo: string | null;
  notas: string | null;
  repartidor_id: number;
  repartidor: string | null;
  destinatario: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  telefono: string | null;
}

export interface ProductoRepartido {
  sku: string;
  nombre_producto: string;
  unidades: number;
  pedidos: number;
}

export interface Repartidor {
  id: number;
  nombre: string;
  telefono: string;
  vehiculo: string | null;
  activo: boolean;
  eliminado_en: string | null;
}

export interface FilaEntrega {
  id: number | null;
  folio: string;
  pedido: string;
  destinatario: string;
  direccion: string;
  codigo_postal: string;
  telefono: string;
  repartidor: string;
  estado: string;
  intento: number;
  fecha_programada: string;
  detalle: string;
  pedido_origen?: PedidoPorAsignar;
  entrega_origen?: Entrega;
}

export interface Alerta {
  id: number;
  tipo: string;
  severidad: 'CRITICA' | 'PREVENTIVA' | 'INFORMATIVA';
  titulo: string;
  detalle: string;
  entidad_tipo: string;
  entidad_id: number;
  rol_destino: string;
  accion_sugerida: string | null;
  estado: 'ABIERTA' | 'ATENDIDA' | 'RESUELTA_AUTO';
  clave_unica: string | null;
  atendida_por: number | null;
  atendida_en: string | null;
  creado_en: string | null;
}

export interface ReglaAlerta {
  clave: string;
  valor: string | null;
  descripcion: string | null;
}

export type AccionAlerta =
  | 'ATENDER'
  | 'GENERAR_PRODUCCION'
  | 'GENERAR_REQUISICION'
  | 'EVALUAR_PROVEEDOR';

export interface ConteoEstados {
  [estado: string]: number;
}

export interface DashboardBase {
  periodo: { desde: string | null; hasta: string | null };
  ventas_activas: number;
  ingresos: string;
  unidades_vendidas: number;
  ticket_promedio: string;
  pedidos_activos: number;
  pedidos_entregados: number;
  ordenes_produccion_activas: number;
  alertas_abiertas: number;
  variantes_bajo_minimo: number;
}

export interface DashboardResumen extends DashboardBase {
  ventas_hoy: string;
  mermas: number;
  costo_mermas: string;
}

export interface DashboardVentas extends DashboardBase {
  por_canal: { canal: string; ventas: number; ingresos: string }[];
  top_sku: {
    fecha: string;
    sku: string;
    nombre_producto: string;
    categoria: string;
    talla: string;
    color: string;
    unidades: number;
    ingresos: string;
  }[];
}

export interface DashboardProduccion {
  por_estado: ConteoEstados;
  por_semaforo: ConteoEstados;
  unidades_planeadas: number;
  unidades_aprobadas: number;
  unidades_reproceso: number;
  ordenes_vencidas: number;
}

export interface DashboardAbastecimiento {
  materiales_activos: number;
  bajo_minimo: number;
  agotados: number;
  en_compra: string;
  ordenes_compra: ConteoEstados;
  recepciones: number;
  dias_abastecimiento: number;
}

export interface DashboardLogistica {
  preparacion: ConteoEstados;
  entregas: ConteoEstados;
  pedidos_listo_envio: number;
  repartidores_activos: number;
  intentos_maximos: number;
  entregas_programadas_hoy: number;
  entregas_programadas_periodo?: number;
}

export interface UsuarioAdmin {
  id: number;
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  estado_cuenta: string;
  acepta_promociones: boolean;
  rol: 'CLIENTE' | 'OPERATIVO' | 'ADMIN';
  creado_en: string | null;
  actualizado_en: string | null;
}

export interface ClienteResumen {
  ventas: number;
  pedidos: number;
  importe_total: string;
}

export interface ClienteDetalle {
  cliente: {
    id: number;
    nombre: string;
    correo: string;
    telefono: string;
    estado_cuenta: string;
    creado_en: string;
  };
  resumen: ClienteResumen;
  ventas: { id: number; folio: string; fecha: string; estado: string; total: string }[];
  pedidos: {
    id: number;
    venta_folio: string;
    estado: string;
    prioridad: string;
    fecha_promesa: string | null;
  }[];
}

export type RecursoCatalogo =
  | 'color'
  | 'talla'
  | 'categoria-producto'
  | 'categoria-material'
  | 'causa-merma'
  | 'tarifa-envio';

export interface ElementoCatalogo {
  id: number;
  creado_en: string;
  [campo: string]: string | number | boolean | null;
}

export interface ConfiguracionParametro {
  clave: string;
  valor: string;
  descripcion: string | null;
}

export interface BitacoraRegistro {
  id: number;
  usuario_id: number | null;
  accion: string;
  entidad: string;
  entidad_id: number | null;
  detalle: Record<string, unknown>;
  ip: string | null;
  fecha: string;
}
