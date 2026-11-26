export interface ErrorApi {
  codigo?: string;
  mensaje?: string;
  detalle?: unknown[] | Record<string, unknown>;
}

export interface ErrorHttpConCuerpo {
  error?: ErrorApi | string;
  message?: string;
  status?: number;
}

export function mensajeError(error: unknown, predeterminado = 'No fue posible completar la operación'): string {
  const http = error as ErrorHttpConCuerpo;
  if (http.error && typeof http.error === 'object' && typeof http.error.mensaje === 'string') {
    return http.error.mensaje;
  }
  if (typeof http.error === 'string' && http.error.trim()) {
    return http.error;
  }
  return http.message || predeterminado;
}

export function codigoError(error: unknown): string | undefined {
  const http = error as ErrorHttpConCuerpo;
  if (http.error && typeof http.error === 'object' && typeof http.error.codigo === 'string') {
    return http.error.codigo;
  }
  return undefined;
}

export function detalleError(error: unknown): unknown[] {
  const http = error as ErrorHttpConCuerpo;
  if (http.error && typeof http.error === 'object' && Array.isArray(http.error.detalle)) {
    return http.error.detalle;
  }
  return [];
}
