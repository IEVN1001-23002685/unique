import { Injectable, signal } from '@angular/core';

export type TipoAviso = 'exito' | 'advertencia' | 'error' | 'informacion';

export interface Aviso {
  tipo: TipoAviso;
  mensaje: string;
}

/**
 * Estado de los mensajes toast. No envía nada a un backend:
 * solo controla qué aviso se muestra y cuándo desaparece.
 */
@Injectable({
  providedIn: 'root',
})
export class AvisosServicio {
  readonly aviso = signal<Aviso | null>(null);
  private secuencia = 0;

  mostrar(tipo: TipoAviso, mensaje: string): void {
    const actual = ++this.secuencia;
    this.aviso.set({ tipo, mensaje });

    // Temporizador de visibilidad; no representa persistencia ni operación alguna.
    setTimeout(() => {
      if (this.secuencia === actual) {
        this.aviso.set(null);
      }
    }, 6000);
  }

  cerrar(): void {
    this.secuencia += 1;
    this.aviso.set(null);
  }
}
