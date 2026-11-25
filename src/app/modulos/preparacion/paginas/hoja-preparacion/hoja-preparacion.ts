import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ChipEstadoPreparacion } from '../../componentes/chip-estado-preparacion/chip-estado-preparacion';
import { ModalIncidencia } from '../../componentes/modal-incidencia/modal-incidencia';
import { NavegacionPreparacion } from '../../componentes/navegacion-preparacion/navegacion-preparacion';
import { PasosPreparacion } from '../../componentes/pasos-preparacion/pasos-preparacion';
import type { DatosIncidencia, PasoPreparacion } from '../../modelos/preparacion';
import { PreparacionServicio } from '../../servicios/preparacion-servicio';

@Component({
  selector: 'app-hoja-preparacion',
  imports: [
    DatePipe,
    RouterLink,
    ChipEstadoPreparacion,
    ModalIncidencia,
    NavegacionPreparacion,
    PasosPreparacion,
  ],
  templateUrl: './hoja-preparacion.html',
  styleUrls: ['./hoja-preparacion.css', '../../estilos-compartidos.css'],
})
export class HojaPreparacion {
  private readonly ruta = inject(ActivatedRoute);
  protected readonly servicio = inject(PreparacionServicio);
  private readonly avisos = inject(AvisosServicio);

  protected readonly folio = this.ruta.snapshot.paramMap.get('folio') ?? '';
  protected readonly preparacion = computed(() => this.servicio.obtener(this.folio));
  protected readonly incidencias = computed(() => this.servicio.incidenciasDe(this.folio));
  protected readonly consumos = computed(() => this.servicio.consumoEmpaque(this.folio));
  protected readonly skus = computed(
    () => this.preparacion()?.lineas.map((linea) => linea.sku) ?? [],
  );

  protected readonly paso = computed<PasoPreparacion>(() => {
    const preparacion = this.preparacion();
    return preparacion ? this.servicio.pasoDe(preparacion.estado) : 'PICKING';
  });

  protected readonly abiertas = computed(
    () =>
      this.incidencias().filter(
        (incidencia) =>
          incidencia.estado === 'ABIERTA' || incidencia.estado === 'PENDIENTE_PRODUCCION',
      ).length,
  );

  protected readonly codigoSku = signal('');
  protected readonly abrirModal = signal(false);
  protected readonly incidenciaSku = signal('');

  protected alCapturarSku(evento: Event): void {
    this.codigoSku.set((evento.target as HTMLInputElement).value);
  }

  protected surtir(): void {
    const resultado = this.servicio.registrarSurtido(this.folio, this.codigoSku());
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    if (resultado.ok) {
      this.codigoSku.set('');
    }
  }

  protected verificar(lineaId: number, campo: 'sku' | 'diseno' | 'etiquetas'): void {
    const resultado = this.servicio.verificarLinea(this.folio, lineaId, campo);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'advertencia', resultado.mensaje);
  }

  protected pasarAVerificacion(): void {
    const resultado = this.servicio.pasarAVerificacion(this.folio);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'advertencia', resultado.mensaje);
  }

  protected pasarAEmpaque(): void {
    const resultado = this.servicio.pasarAEmpaque(this.folio);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'advertencia', resultado.mensaje);
  }

  protected marcarListo(): void {
    const resultado = this.servicio.marcarListo(this.folio);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'advertencia', resultado.mensaje);
  }

  protected abrirIncidencia(sku = ''): void {
    this.incidenciaSku.set(sku);
    this.abrirModal.set(true);
  }

  protected registrarIncidencia(datos: DatosIncidencia): void {
    const resultado = this.servicio.registrarIncidencia(this.folio, datos);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    if (resultado.ok) {
      this.abrirModal.set(false);
    }
  }

  /** Abre un documento de impresión con la etiqueta; no genera un PDF persistente. */
  protected imprimirEtiqueta(): void {
    const preparacion = this.preparacion();
    if (!preparacion) {
      return;
    }
    const ventana = window.open('', '_blank', 'width=680,height=720');
    if (!ventana) {
      this.avisos.mostrar(
        'advertencia',
        'El navegador bloqueó la ventana de impresión. Revisa los permisos de ventanas emergentes.',
      );
      return;
    }

    const datos = preparacion.direccion;
    const contenido = `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>Etiqueta ${this.escapar(preparacion.folio)}</title>
<style>
body{font-family:Arial,sans-serif;color:#1f1226;margin:2rem}
.etiqueta{border:3px solid #542d59;border-radius:12px;padding:1.5rem;max-width:28rem}
h1{font-size:1.3rem;color:#542d59;margin:0 0 .2rem}
.marca{font-size:.8rem;color:#8b548c;margin:0 0 1.2rem}
.dato{margin:.35rem 0;font-size:.95rem}
.dato strong{display:inline-block;min-width:6rem;color:#6b5870}
.qr{display:flex;align-items:center;gap:1rem;margin-top:1.4rem;font-size:.72rem;color:#6b5870}
.nota{margin-top:1rem;font-size:.7rem;color:#6b5870}
@media print{body{margin:1rem}}
</style></head><body><section class="etiqueta">
<h1>UNIQUE</h1><p class="marca">tan único como tú · Etiqueta de envío</p>
<p class="dato"><strong>Folio</strong>${this.escapar(preparacion.folio)} · Pedido ${this.escapar(preparacion.pedidoFolio)}</p>
<p class="dato"><strong>Destinatario</strong>${this.escapar(datos.destinatario)}</p>
<p class="dato"><strong>Dirección</strong>${this.escapar(datos.calle)}, ${this.escapar(datos.colonia)}</p>
<p class="dato"><strong>CP</strong>${this.escapar(datos.cp)} · ${this.escapar(datos.ciudad)}, ${this.escapar(datos.estado)}</p>
<p class="dato"><strong>Teléfono</strong>${this.escapar(datos.telefono)}</p>
<p class="dato"><strong>Piezas</strong>${preparacion.lineas.reduce((suma, linea) => suma + linea.cantidadRequerida, 0)}</p>
<div class="qr"><svg width="72" height="72" viewBox="0 0 9 9" aria-hidden="true" shape-rendering="crispEdges">
<rect width="9" height="9" fill="#fff"/><path fill="#542d59" d="M0 0h3v3H0zM6 0h3v3H6zM0 6h3v3H0zM4 1h1v1H4zM5 3h2v1H5zM3 4h2v1H3zM6 5h1v1H6zM2 6h1v2H2zM5 7h2v1H5zM8 4h1v4H8z"/></svg>
<span>Código QR de demostración<br>El QR rastreable se genera en Flask.</span></div>
<p class="nota">Documento de demostración. No constituye una guía de entrega real.</p>
</section></body></html>`;

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
