import type {
  AlertaDashboard,
  CompraDemo,
  DevolucionDemo,
  MaterialDemo,
  MermaDemo,
  OrdenProduccionDemo,
  ProveedorDemo,
} from '../modelos/dashboard';

/**
 * DATOS DE DEMOSTRACIÓN (M20). Nada se persiste ni representa un saldo real.
 * M14, M15, M16, M17 y M21 aún no están implementados en este frontend: estas
 * filas muestran la forma de la interfaz hasta que Flask exponga las vistas
 * v_merma_resumen, v_capacidad_variante y v_inventario_material.
 */

const anio = new Date().getFullYear();

export const CONVERSION_DEMO = 38.4;
export const EXACTITUD_INVENTARIO_DEMO = 98.2;
export const ROTACION_PT_DEMO = 2.4;
export const MERMA_PRODUCCION_DEMO = 3.8;
export const MERMA_MATERIAL_DEMO = 2.6;
export const TASA_RECHAZO_DEMO = 4.1;
export const TASA_DEVOLUCION_DEMO = 1.8;
export const ACEPTACION_MATERIAL_DEMO = 96.4;
export const ENTREGAS_PROVEEDOR_DEMO = 87.5;

export const ORDENES_PRODUCCION_DEMO: OrdenProduccionDemo[] = [
  { folio: `OP-${anio}-0112`, sku: 'SD-GD-NG', tono: 'ROJO', planeadas: 120, aprobadas: 74, alcanzaPara: 1, etapa: 'Producción' },
  { folio: `OP-${anio}-0114`, sku: 'PL-MD-GR', tono: 'ROJO', planeadas: 200, aprobadas: 118, alcanzaPara: 2, etapa: 'Revisión' },
  { folio: `OP-${anio}-0118`, sku: 'PN-CH-BL', tono: 'AMBAR', planeadas: 80, aprobadas: 69, alcanzaPara: 4, etapa: 'Producción' },
  { folio: `OP-${anio}-0121`, sku: 'GO-UN-NG', tono: 'AMBAR', planeadas: 150, aprobadas: 136, alcanzaPara: 6, etapa: 'Bordado' },
  { folio: `OP-${anio}-0123`, sku: 'BO-UN-GR', tono: 'VERDE', planeadas: 90, aprobadas: 89, alcanzaPara: 11, etapa: 'Terminada' },
  { folio: `OP-${anio}-0127`, sku: 'SD-CH-BL', tono: 'VERDE', planeadas: 110, aprobadas: 108, alcanzaPara: 9, etapa: 'Revisión' },
];

export const MERMAS_DEMO: MermaDemo[] = [
  { etapa: 'Corte', causa: 'Tela manchada', unidades: 18, costo: 486 },
  { etapa: 'Corte', causa: 'Error de trazo', unidades: 9, costo: 243 },
  { etapa: 'Costura', causa: 'Costura defectuosa', unidades: 24, costo: 648 },
  { etapa: 'Bordado', causa: 'Diseño desalineado', unidades: 13, costo: 351 },
  { etapa: 'Revisión', causa: 'Talla fuera de especificación', unidades: 11, costo: 297 },
  { etapa: 'Revisión', causa: 'Reproceso', unidades: 7, costo: 189 },
];

export const MATERIALES_DEMO: MaterialDemo[] = [
  { material: 'Algodón peinado', sku: 'MP-ALG-001', disponible: 0, minimo: 40, tono: 'ROJO' },
  { material: 'Hilo poliéster negro', sku: 'MP-HIL-004', disponible: 3, minimo: 20, tono: 'ROJO' },
  { material: 'Cierre 60 cm', sku: 'MP-CIE-002', disponible: 18, minimo: 25, tono: 'AMBAR' },
  { material: 'Etiqueta tejida', sku: 'MP-ETI-006', disponible: 120, minimo: 150, tono: 'AMBAR' },
  {
    material: 'Tela de lona natural',
    sku: 'MP-LON-003',
    disponible: 310,
    minimo: 80,
    tono: 'AMBAR',
  },
];

export const COMPRAS_DEMO: CompraDemo[] = [
  {
    folio: `OC-${anio}-0084`,
    proveedor: 'Textiles León',
    material: 'Algodón peinado',
    cantidad: 120,
    compromiso: `${anio}-11-20`,
    estado: 'RETRASADA',
  },
  {
    folio: `OC-${anio}-0087`,
    proveedor: 'Hilos del Bajío',
    material: 'Hilo poliéster negro',
    cantidad: 80,
    compromiso: `${anio}-11-24`,
    estado: 'RETRASADA',
  },
  {
    folio: `OC-${anio}-0091`,
    proveedor: 'Cierres Mexicanos',
    material: 'Cierre 60 cm',
    cantidad: 200,
    compromiso: `${anio}-11-28`,
    estado: 'PENDIENTE',
  },
  {
    folio: `OC-${anio}-0093`,
    proveedor: 'Etiquetas GDL',
    material: 'Etiqueta tejida',
    cantidad: 500,
    compromiso: `${anio}-12-02`,
    estado: 'PENDIENTE',
  },
  {
    folio: `OC-${anio}-0079`,
    proveedor: 'Lonas del Centro',
    material: 'Tela de lona natural',
    cantidad: 150,
    compromiso: `${anio}-11-12`,
    estado: 'RECIBIDA',
  },
];

export const PROVEEDORES_DEMO: ProveedorDemo[] = [
  { proveedor: 'Textiles León', entregas: 16, aTiempo: 81.3, aceptacion: 94.2 },
  { proveedor: 'Hilos del Bajío', entregas: 12, aTiempo: 91.7, aceptacion: 98.1 },
  { proveedor: 'Cierres Mexicanos', entregas: 9, aTiempo: 88.9, aceptacion: 97.4 },
  { proveedor: 'Lonas del Centro', entregas: 7, aTiempo: 100, aceptacion: 99.1 },
];

export const DEVOLUCIONES_DEMO: DevolucionDemo[] = [
  { motivo: 'Cambio de talla', producto: 'SUDADERA', unidades: 14, tasa: 0.9 },
  { motivo: 'Color diferente al esperado', producto: 'Playera gris', unidades: 8, tasa: 0.5 },
  { motivo: 'Defecto de costura', producto: 'PANTALÓN', unidades: 5, tasa: 0.3 },
  { motivo: 'Arrepentimiento', producto: 'Gorro blanco', unidades: 2, tasa: 0.1 },
];

export const ALERTAS_DEMO: AlertaDashboard[] = [
  {
    id: 'demo-mp-algodon',
    clave: 'MP_INSUFICIENTE',
    titulo: 'Algodón peinado por debajo del mínimo',
    detalle: 'Quedan 0 unidades base; la orden OP-0112 requiere 40 kg. Datos de demostración.',
    severidad: 'CRITICA',
    origen: 'M15 · Inventario de materia prima (pendiente)',
    ruta: ['/dashboard', 'abastecimiento'],
  },
  {
    id: 'demo-orden-roja',
    clave: 'OP_RETRASADA',
    titulo: 'Orden de producción en semáforo rojo',
    detalle: 'La orden OP-0112 lleva 14 h en etapa de producción. Datos de demostración.',
    severidad: 'CRITICA',
    origen: 'M16 · Producción (pendiente)',
    ruta: ['/dashboard', 'produccion-merma'],
  },
];
