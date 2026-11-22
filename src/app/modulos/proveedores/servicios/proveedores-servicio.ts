import { Injectable, computed, signal } from '@angular/core';
import type {
  EvaluacionProveedor,
  MaterialProveedor,
  Proveedor,
} from '../modelos/proveedor';
import {
  EVALUACIONES_SIMULADAS,
  PROVEEDORES_SIMULADOS,
} from '../datos-simulados/proveedores';

export type ResultadoEliminacion = 'eliminado' | 'desactivado' | 'no-encontrado';

/**
 * Estado en memoria del padrón de proveedores.
 *
 * La interfaz pública (listar, obtener, guardar, eliminar, evaluación) está
 * pensada para sustituirse por HttpClient contra:
 *   GET, POST, PATCH y DELETE /proveedores
 *   GET, POST, PATCH y DELETE /proveedores/{id}/materiales
 *   GET /proveedores/evaluacion
 * Nada de lo que ocurre aquí persiste en servidor.
 */
@Injectable({
  providedIn: 'root',
})
export class ProveedoresServicio {
  private readonly lista = signal<Proveedor[]>(structuredClone(PROVEEDORES_SIMULADOS));
  private readonly evaluaciones = signal<EvaluacionProveedor[]>(
    structuredClone(EVALUACIONES_SIMULADAS),
  );

  readonly proveedores = this.lista.asReadonly();
  readonly evaluacionesRegistradas = this.evaluaciones.asReadonly();

  /** Líneas activas de proveedores activos/en revisión, agrupadas por material. */
  readonly cobertura = computed<Map<number, MaterialProveedor[]>>(() => {
    const agrupado = new Map<number, MaterialProveedor[]>();

    for (const proveedor of this.lista()) {
      if (proveedor.estatus === 'INACTIVO') {
        continue;
      }
      for (const material of proveedor.materiales) {
        if (!material.activo) {
          continue;
        }
        const lineas = agrupado.get(material.materialId) ?? [];
        lineas.push(material);
        agrupado.set(material.materialId, lineas);
      }
    }

    return agrupado;
  });

  obtenerPorId(id: number): Proveedor | undefined {
    return this.lista().find((proveedor) => proveedor.id === id);
  }

  obtenerEvaluacion(id: number): EvaluacionProveedor | undefined {
    return this.evaluaciones().find((evaluacion) => evaluacion.proveedorId === id);
  }

  guardarProveedor(datos: Proveedor): void {
    const proveedor = structuredClone(datos);

    if (proveedor.id === 0) {
      proveedor.id = this.siguienteId();
      this.lista.update((actuales) => [...actuales, proveedor]);
      return;
    }

    this.lista.update((actuales) =>
      actuales.map((actual) => (actual.id === proveedor.id ? proveedor : actual)),
    );
  }

  /**
   * Regla del documento: solo se elimina si no hay órdenes de compra.
   * Con historial se desactiva, nunca se borra.
   */
  eliminarProveedor(id: number): ResultadoEliminacion {
    const proveedor = this.obtenerPorId(id);
    if (!proveedor) {
      return 'no-encontrado';
    }

    if (proveedor.tieneOrdenesCompra) {
      this.lista.update((actuales) =>
        actuales.map((actual) =>
          actual.id === id ? { ...actual, estatus: 'INACTIVO' as const } : actual,
        ),
      );
      return 'desactivado';
    }

    this.lista.update((actuales) => actuales.filter((actual) => actual.id !== id));
    this.evaluaciones.update((actuales) =>
      actuales.filter((evaluacion) => evaluacion.proveedorId !== id),
    );
    return 'eliminado';
  }

  reemplazarMateriales(proveedorId: number, materiales: MaterialProveedor[]): void {
    const copia = structuredClone(materiales);
    this.lista.update((actuales) =>
      actuales.map((actual) =>
        actual.id === proveedorId ? { ...actual, materiales: copia } : actual,
      ),
    );
  }

  private siguienteId(): number {
    return this.lista().reduce((maximo, proveedor) => Math.max(maximo, proveedor.id), 0) + 1;
  }
}
