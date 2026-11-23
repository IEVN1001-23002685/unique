import type {
  MaterialOrden,
  OrdenProduccion,
  RecetaCopiada,
} from '../modelos/produccion';

/**
 * DATOS DEMOSTRATIVOS de M16. Nada de esto viene de Flask: al integrarse se
 * sustituye por GET/POST /produccion/ordenes, /produccion/plan-sugerido, etc.
 * Las recetas son copias simuladas de la receta vigente de M11; Flask debe
 * copiar la versión real al crear cada orden (§5 y §7 del documento).
 */

export function redondear4(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10000) / 10000;
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function enDias(dias: number): string {
  const fecha = new Date(`${hoyISO()}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

const NOMBRES_MATERIAL: Record<number, string> = {
  1: 'Felpa',
  2: 'Jersey peinado',
  3: 'Tejido acanalado (rib)',
  4: 'Estambre acrílico',
  5: 'Hilo de costura 40/2',
  6: 'Estabilizador de corte, hoja',
  7: 'Etiqueta tejida UNIQUE',
  9: 'Ojillos metálicos de 8 mm',
  10: 'Cordón redondo de poliéster',
  11: 'Loneta',
  16: 'Etiqueta de talla CH',
  17: 'Etiqueta de talla MD',
  18: 'Etiqueta de talla GD',
  19: 'Etiqueta de composición y cuidado sudadera',
  20: 'Etiqueta de composición y cuidado playera',
  21: 'Etiqueta de composición y cuidado pantalón',
  22: 'Etiqueta de composición y cuidado gorro',
  23: 'Etiqueta de composición y cuidado bolsa',
};

const UNIDADES_MATERIAL: Record<number, string> = {
  1: 'm²',
  2: 'm²',
  3: 'm²',
  4: 'm',
  5: 'm',
  11: 'm²',
};

/** Etiqueta de talla según la talla comercial del SKU. */
function etiquetaTallaDe(talla: string): number {
  if (talla === 'MD' || talla === 'M') {
    return 17;
  }
  if (talla === 'GD' || talla === 'G') {
    return 18;
  }
  return 16;
}

export const RECETAS_COPIADAS: RecetaCopiada[] = [
  {
    familia: 'HOODIE',
    nombre: 'Sudadera con capucha',
    materiales: [
      { materialId: 1, color: null, cantidadBrutaPorUnidad: 1.85, descripcion: 'Felpa cuerpo y capucha' },
      { materialId: 3, color: null, cantidadBrutaPorUnidad: 0.28, descripcion: 'Rib de puños y cintura' },
      { materialId: 4, color: null, cantidadBrutaPorUnidad: 120, descripcion: 'Estambre de bordado' },
      { materialId: 5, color: 'NA', cantidadBrutaPorUnidad: 45, descripcion: 'Hilo de costura' },
      { materialId: 6, color: 'NA', cantidadBrutaPorUnidad: 1, descripcion: 'Estabilizador de bordado' },
      { materialId: 7, color: 'NA', cantidadBrutaPorUnidad: 1, descripcion: 'Etiqueta tejida' },
      { materialId: 19, color: 'NA', cantidadBrutaPorUnidad: 1, descripcion: 'Etiqueta de cuidado' },
    ],
  },
  {
    familia: 'PLAYERA',
    nombre: 'Playera de manga corta',
    materiales: [
      { materialId: 2, color: null, cantidadBrutaPorUnidad: 1.25, descripcion: 'Jersey peinado' },
      { materialId: 3, color: null, cantidadBrutaPorUnidad: 0.18, descripcion: 'Rib de cuello' },
      { materialId: 5, color: 'NA', cantidadBrutaPorUnidad: 32, descripcion: 'Hilo de costura' },
      { materialId: 6, color: 'NA', cantidadBrutaPorUnidad: 1, descripcion: 'Estabilizador' },
      { materialId: 7, color: 'NA', cantidadBrutaPorUnidad: 1, descripcion: 'Etiqueta tejida' },
      { materialId: 20, color: 'NA', cantidadBrutaPorUnidad: 1, descripcion: 'Etiqueta de cuidado' },
    ],
  },
  {
    familia: 'PANTS',
    nombre: 'Pantalón',
    materiales: [
      { materialId: 11, color: null, cantidadBrutaPorUnidad: 1.4, descripcion: 'Loneta' },
      { materialId: 5, color: 'NA', cantidadBrutaPorUnidad: 40, descripcion: 'Hilo de costura' },
      { materialId: 9, color: 'NA', cantidadBrutaPorUnidad: 2, descripcion: 'Ojillos' },
      { materialId: 10, color: 'NA', cantidadBrutaPorUnidad: 1, descripcion: 'Cordón' },
      { materialId: 21, color: 'NA', cantidadBrutaPorUnidad: 1, descripcion: 'Etiqueta de cuidado' },
    ],
  },
  {
    familia: 'GORRO',
    nombre: 'Gorro',
    materiales: [
      { materialId: 1, color: null, cantidadBrutaPorUnidad: 0.35, descripcion: 'Felpa' },
      { materialId: 3, color: null, cantidadBrutaPorUnidad: 0.12, descripcion: 'Rib' },
      { materialId: 5, color: 'NA', cantidadBrutaPorUnidad: 18, descripcion: 'Hilo de costura' },
      { materialId: 7, color: 'NA', cantidadBrutaPorUnidad: 1, descripcion: 'Etiqueta tejida' },
      { materialId: 22, color: 'NA', cantidadBrutaPorUnidad: 1, descripcion: 'Etiqueta de cuidado' },
    ],
  },
  {
    familia: 'TOTE',
    nombre: 'Tote bag',
    materiales: [
      { materialId: 11, color: null, cantidadBrutaPorUnidad: 0.9, descripcion: 'Loneta' },
      { materialId: 5, color: 'NA', cantidadBrutaPorUnidad: 25, descripcion: 'Hilo de costura' },
      { materialId: 23, color: 'NA', cantidadBrutaPorUnidad: 1, descripcion: 'Etiqueta de cuidado' },
    ],
  },
];

/** Alias de familias del catálogo de M10 (SD, PL, PN, GO, BO). */
const ALIAS_FAMILIA: Record<string, string> = {
  SD: 'HOODIE',
  SD2: 'HOODIE',
  PL: 'PLAYERA',
  PN: 'PANTS',
  GO: 'GORRO',
  BO: 'TOTE',
};

const COLOR_SKU: Record<string, string> = {
  NG: 'Negro',
  BL: 'Blanco',
  GR: 'Gris',
  ROJA: 'Rojo',
  GRIS: 'Gris',
  CAFE: 'NA',
  BLANCO: 'Blanco',
  CRUDO: 'Natural',
  UNICA: 'NA',
};

export function familiaDeSku(sku: string): string {
  return sku.split('-')[0] ?? '';
}

export function colorDeSku(sku: string): string {
  const segmentos = sku.split('-');
  return COLOR_SKU[segmentos[2] ?? ''] ?? 'NA';
}

export function nombreProductoDeSku(sku: string): string {
  const familia = familiaDeSku(sku);
  const receta = RECETAS_COPIADAS.find(
    (item) => item.familia === familia || ALIAS_FAMILIA[item.familia] === ALIAS_FAMILIA[familia],
  );
  return receta?.nombre ?? 'Prenda UNIQUE';
}

export function explosionarMateriales(
  sku: string,
  unidades: number,
  sinReservar: number[] | 'todos' = [],
  consumido = false,
): MaterialOrden[] {
  const familia = familiaDeSku(sku);
  const familiaBase = ALIAS_FAMILIA[familia] ?? familia;
  const receta =
    RECETAS_COPIADAS.find((item) => item.familia === familiaBase) ?? RECETAS_COPIADAS[0];
  const color = colorDeSku(sku);
  const talla = sku.split('-')[1] ?? 'UN';
  const tallaMaterial = etiquetaTallaDe(talla);
  const acumulados = new Map<string, MaterialOrden>();

  for (const item of receta.materiales) {
    const materialId = item.materialId === 16 ? tallaMaterial : item.materialId;
    const colorMaterial = item.color === null ? color : item.color;
    const clave = `${materialId}|${colorMaterial}`;
    const requerida = redondear4(item.cantidadBrutaPorUnidad * unidades);
    const actual = acumulados.get(clave);

    if (actual) {
      actual.cantidadRequerida = redondear4(actual.cantidadRequerida + requerida);
      if (sinReservar !== 'todos' && !sinReservar.includes(materialId)) {
        actual.cantidadReservada = redondear4(actual.cantidadReservada + requerida);
      }
      if (consumido) {
        actual.cantidadConsumida = redondear4(actual.cantidadConsumida + requerida);
      }
      continue;
    }

    const reservada =
      sinReservar === 'todos' || sinReservar.includes(materialId) ? 0 : requerida;
    acumulados.set(clave, {
      id: 0,
      materialId,
      nombreMaterial: NOMBRES_MATERIAL[materialId] ?? 'Material no disponible',
      color: colorMaterial,
      unidadBase: UNIDADES_MATERIAL[materialId] ?? 'pieza',
      cantidadRequerida: requerida,
      cantidadReservada: redondear4(reservada),
      cantidadConsumida: consumido ? requerida : 0,
    });
  }

  return [...acumulados.values()].map((material, indice) => ({ ...material, id: indice + 1 }));
}

type SemillaOrden = {
  folio: string;
  origen: OrdenProduccion['origen'];
  estado: OrdenProduccion['estado'];
  sku: string;
  unidades: number;
  diasRequerida: number | null;
  aprobadas?: number;
  merma?: number;
  reproceso?: number;
  sinReservar?: number[] | 'todos';
  consumido?: boolean;
  diasIniciada?: number;
  diasCerrada?: number;
  notas?: string;
};

const SEMILLAS: SemillaOrden[] = [
  {
    folio: 'OP-2026-0031',
    origen: 'PEDIDO',
    estado: 'LISTA',
    sku: 'HOODIE-M-ROJA',
    unidades: 24,
    diasRequerida: 4,
    notas: 'Materiales reservados; lista para iniciar.',
  },
  {
    folio: 'OP-2026-0032',
    origen: 'STOCK_MINIMO',
    estado: 'PLANEADA',
    sku: 'HOODIE-CH-GRIS',
    unidades: 70,
    diasRequerida: 6,
    sinReservar: [1],
    notas: 'Reposición por disponible en el mínimo. Falta felpa gris con requisición vigente.',
  },
  {
    folio: 'OP-2026-0033',
    origen: 'MANUAL',
    estado: 'CANCELADA',
    sku: 'PLAYERA-CH-GRIS',
    unidades: 12,
    diasRequerida: null,
    sinReservar: 'todos',
    notas: 'Cancelada desde PLANEADA a solicitud del Operativo.',
  },
  {
    folio: 'OP-2026-0034',
    origen: 'PEDIDO',
    estado: 'EN_PROCESO',
    sku: 'PLAYERA-CH-GRIS',
    unidades: 30,
    diasRequerida: 2,
    consumido: true,
    diasIniciada: 2,
  },
  {
    folio: 'OP-2026-0035',
    origen: 'PEDIDO',
    estado: 'EN_REVISION',
    sku: 'GORRO-UNICA-BLANCO',
    unidades: 40,
    diasRequerida: 1,
    aprobadas: 30,
    merma: 2,
    reproceso: 4,
    consumido: true,
    diasIniciada: 4,
  },
  {
    folio: 'OP-2026-0036',
    origen: 'MANUAL',
    estado: 'CERRADA',
    sku: 'TOTE-UNICA-CRUD',
    unidades: 25,
    diasRequerida: -3,
    aprobadas: 24,
    merma: 1,
    consumido: true,
    diasIniciada: 8,
    diasCerrada: 3,
  },
  {
    folio: 'OP-2026-0037',
    origen: 'PEDIDO',
    estado: 'PLANEADA',
    sku: 'PANTS-28-CAFE',
    unidades: 20,
    diasRequerida: 7,
    sinReservar: [9],
    notas: 'Faltan ojillos; la orden de compra está vigente.',
  },
  {
    folio: 'OP-2026-0038',
    origen: 'STOCK_MINIMO',
    estado: 'PLANEADA',
    sku: 'SD2-GD-NG',
    unidades: 15,
    diasRequerida: 5,
    sinReservar: [1],
    notas: 'Felpa negra sin requisición ni orden de compra que cubra el faltante.',
  },
  {
    folio: 'OP-2026-0039',
    origen: 'PEDIDO',
    estado: 'LISTA',
    sku: 'PLAYERA-MD-NG',
    unidades: 18,
    diasRequerida: -2,
    notas: 'Materiales completos, pero la fecha requerida ya venció.',
  },
  {
    folio: 'OP-2026-0142',
    origen: 'PEDIDO',
    estado: 'PLANEADA',
    sku: 'HOODIE-M-ROJA',
    unidades: 12,
    diasRequerida: 3,
    sinReservar: [4],
    notas: 'Estambre rojo en rojo: existe requisición, pero la orden de compra está retrasada.',
  },
];

export const ORDENES_SIMULADAS: OrdenProduccion[] = SEMILLAS.map((semilla, indice) => ({
  id: indice + 1,
  folio: semilla.folio,
  origen: semilla.origen,
  estado: semilla.estado,
  fechaRequerida: semilla.diasRequerida === null ? null : enDias(semilla.diasRequerida),
  iniciadaEn: semilla.diasIniciada === undefined ? null : enDias(-semilla.diasIniciada),
  cerradaEn: semilla.diasCerrada === undefined ? null : enDias(-semilla.diasCerrada),
  creadaPor: semilla.origen === 'MANUAL' ? 'Operativo · demostración' : 'Sistema · demostración',
  notas: semilla.notas ?? null,
  lineas: [
    {
      id: indice + 1,
      sku: semilla.sku,
      nombreProducto: nombreProductoDeSku(semilla.sku),
      talla: semilla.sku.split('-')[1] ?? 'UN',
      color: colorDeSku(semilla.sku),
      cantidadPlaneada: semilla.unidades,
      cantidadAprobada: semilla.aprobadas ?? 0,
      cantidadMerma: semilla.merma ?? 0,
      cantidadReproceso: semilla.reproceso ?? 0,
    },
  ],
  materiales: explosionarMateriales(
    semilla.sku,
    semilla.unidades,
    semilla.sinReservar ?? [],
    semilla.consumido ?? false,
  ),
}));
