import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ChipEstadoEntrega } from '../../componentes/chip-estado-entrega/chip-estado-entrega';
import {
  ModalResultadoEntrega,
  type ResultadoEntrega,
} from '../../componentes/modal-resultado-entrega/modal-resultado-entrega';
import { NavegacionEntregas } from '../../componentes/navegacion-entregas/navegacion-entregas';
import type { Entrega } from '../../modelos/entrega';
import { EntregasServicio } from '../../servicios/entregas-servicio';

@Component({
  selector: 'app-hoja-reparto',
  imports: [RouterLink, ChipEstadoEntrega, ModalResultadoEntrega, NavegacionEntregas],
  templateUrl: './hoja-reparto.html',
  styleUrls: ['../../estilos-compartidos.css', './hoja-reparto.css'],
})
export class HojaReparto {
  protected readonly servicio = inject(EntregasServicio);
  private readonly avisos = inject(AvisosServicio);

  protected readonly activos = this.servicio.activos;
  protected readonly repartidorId = signal<number>(this.servicio.activos()[0]?.id ?? 0);
  protected readonly fecha = signal(this.servicio.fechaHoy());
  protected readonly resultado = signal<{
    entrega: Entrega;
    modo: 'ENTREGADO' | 'FALLIDA';
  } | null>(null);

  protected readonly repartidor = computed(() => this.servicio.repartidorDe(this.repartidorId()));
  protected readonly paradas = computed<Entrega[]>(() =>
    this.repartidorId() === 0 ? [] : this.servicio.hojaDe(this.repartidorId(), this.fecha()),
  );
  protected readonly piezas = computed(() =>
    this.paradas().reduce((suma, entrega) => suma + this.servicio.piezas(entrega), 0),
  );

  protected alCambiarRepartidor(evento: Event): void {
    this.repartidorId.set(Number((evento.target as HTMLSelectElement).value));
  }

  protected alCambiarFecha(evento: Event): void {
    this.fecha.set((evento.target as HTMLInputElement).value);
  }

  protected confirmarSalida(entrega: Entrega): void {
    const resultado = this.servicio.confirmarSalida(entrega.folio);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
  }

  protected abrirResultado(entrega: Entrega, modo: 'ENTREGADO' | 'FALLIDA'): void {
    this.resultado.set({ entrega, modo });
  }

  protected registrar(evento: ResultadoEntrega): void {
    const actual = this.resultado();
    if (!actual) {
      return;
    }
    const resultado =
      evento.tipo === 'ENTREGADO'
        ? this.servicio.registrarEntregado(actual.entrega.folio, evento.datos)
        : this.servicio.registrarFallida(actual.entrega.folio, evento.datos);

    this.avisos.mostrar(
      !resultado.ok ? 'error' : evento.tipo === 'ENTREGADO' ? 'exito' : 'advertencia',
      resultado.mensaje,
    );
    if (resultado.ok) {
      this.resultado.set(null);
    }
  }

  protected prendas(entrega: Entrega): string {
    return entrega.lineas
      .map((linea) => `${linea.cantidad} × ${linea.nombreProducto} ${linea.talla}/${linea.color}`)
      .join('; ');
  }

  /** Abre un documento imprimible; no genera ni persiste un PDF. */
  protected imprimir(): void {
    const paradas = this.paradas();
    if (paradas.length === 0) {
      this.avisos.mostrar(
        'advertencia',
        'No hay paradas para imprimir con el repartidor y la fecha seleccionados.',
      );
      return;
    }

    const ventana = window.open('', '_blank', 'width=820,height=900');
    if (!ventana) {
      this.avisos.mostrar(
        'advertencia',
        'El navegador bloqueó la ventana de impresión. Revisa los permisos de ventanas emergentes.',
      );
      return;
    }

    const filas = paradas
      .map((entrega, indice) => {
        const direccion = entrega.direccion;
        return `<tr>
          <td>${indice + 1}</td>
          <td><strong>${this.escapar(entrega.folio)}</strong><br>${this.escapar(entrega.pedidoFolio)}</td>
          <td>${this.escapar(direccion.destinatario)}<br>${this.escapar(direccion.telefono)}</td>
          <td>${this.escapar(direccion.calle)}<br>${this.escapar(direccion.colonia)}, ${this.escapar(direccion.ciudad)}<br>CP ${this.escapar(direccion.cp)}</td>
          <td>${this.escapar(this.prendas(entrega))}</td>
        </tr>`;
      })
      .join('');

    const contenido = `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>Hoja de reparto ${this.escapar(this.fecha())}</title>
<style>
body{font-family:Arial,sans-serif;color:#1f1226;margin:1.5rem}
h1{color:#542d59;margin:0;font-size:1.4rem}
.marca{color:#8b548c;font-size:.8rem;margin:.2rem 0 1.2rem}
.datos{display:flex;gap:2rem;margin-bottom:1rem;font-size:.9rem}
table{width:100%;border-collapse:collapse;font-size:.8rem}
th{background:#8b548c;color:#fff;text-align:left;padding:.5rem}
td{border-bottom:1px solid #eadcea;padding:.5rem;vertical-align:top}
.nota{margin-top:1.2rem;font-size:.7rem;color:#6b5870}
@media print{body{margin:.8rem}}
</style></head><body>
<h1>UNIQUE · Hoja de reparto</h1>
<p class="marca">tan único como tú · Documento de demostración</p>
<div class="datos"><span><strong>Repartidor:</strong> ${this.escapar(this.repartidor()?.nombre ?? '—')}</span><span><strong>Fecha:</strong> ${this.escapar(this.fecha())}</span><span><strong>Paradas:</strong> ${paradas.length}</span></div>
<table><thead><tr><th>#</th><th>Guía / pedido</th><th>Destinatario</th><th>Dirección</th><th>Prendas</th></tr></thead><tbody>${filas}</tbody></table>
<p class="nota">Las guías EN-AAAA-NNNNNN son de demostración. La impresión real y el descuento de existencia (M12) se generan en Flask.</p>
</body></html>`;

    ventana.document.write(contenido);
    ventana.document.close();
    ventana.focus();
    ventana.print();
  }

  private escapar(valor: string): string {
    const entidades: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return valor.replace(/[&<>"']/g, (caracter) => entidades[caracter] ?? caracter);
  }
}
