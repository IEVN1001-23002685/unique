/** Contrato común de listas paginadas del backend UNIQUE. */
export interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export function paginaVacia<T>(porPagina = 20): Pagina<T> {
  return { items: [], total: 0, pagina: 1, por_pagina: porPagina };
}
