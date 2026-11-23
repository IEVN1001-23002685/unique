export interface ApiLista<T> { datos: T[]; mensaje?: string; }
export interface PedidoPreparacion {
 id:number; folio:string; cliente:string; fecha_prometida:string; estado:string;
 lineas: LineaPreparacion[];
}
export interface LineaPreparacion {
 id:number; sku:string; producto:string; talla:string; color:string; cantidad_requerida:number; cantidad_surtida:number;
 sku_verificado:boolean; diseno_verificado:boolean; bordado_verificado:boolean; etiquetas_verificadas:boolean;
}
export interface Repartidor { id:number; nombre:string; telefono:string; vehiculo:string; activo:boolean; }
export interface Entrega {
 id:number; folio:string; pedido_folio:string; cliente:string; direccion:string; colonia:string; codigo_postal:string;
 telefono:string; fecha_programada:string; repartidor_id:number|null; repartidor?:string; estado:string; intento:number;
 productos?:{sku:string;producto:string;cantidad:number}[];
}
export interface Alerta {
 id:number; codigo:string; titulo:string; detalle:string; severidad:'CRITICA'|'PREVENTIVA'|'INFORMATIVA';
 creada_en:string; minutos_abierta:number; estado:string; accion_label:string; accion_ruta?:string; resuelta_por?:string; resuelta_en?:string; resultado?:string;
}
export interface IndicadoresDashboard { kpis:Record<string,number|string>; ventas_mensuales:{periodo:string;total:number}[]; ingresos_sku:{sku:string;nombre:string;total:number}[]; produccion:{verde:number;ambar:number;rojo:number}; mermas:{etapa:string;porcentaje:number}[]; alertas_criticas:number; }
