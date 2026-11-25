import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

export type TipoSolicitudCaso = 'Cambio' | 'Devolución';
export type EstadoCaso = 'Solicitada' | 'En inspección' | 'Aprobada' | 'Rechazada' | 'Completada';
export type EstadoFisicoPrenda = 'Buen estado' | 'Con detalles' | 'Sin etiquetas';

export interface SolicitudCambioDevolucion {
  id: number;
  folioCaso: string;
  folioPedido: string;
  tipo: TipoSolicitudCaso;
  prendaResumen: string;
  motivo: string;
  comentario?: string;
  estado: EstadoCaso;
  estadoFisico?: EstadoFisicoPrenda;
  dictamen?: string;
}

@Component({
  selector: 'app-cambios-devoluciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cambios-devoluciones.html',
  styles: [],
})
export class CambiosDevoluciones implements OnInit {
  private readonly router = inject(Router);

  @Input() solicitudes: SolicitudCambioDevolucion[] = [
    {
      id: 1,
      folioCaso: 'CD-3019',
      folioPedido: 'UNQ-847110',
      tipo: 'Cambio',
      prendaResumen: 'PLAYERA (Blanco, Talla MD) x1 → Talla GD',
      motivo: 'Talla ajustada',
      comentario: 'Me gustaría cambiarla a talla GD del mismo modelo.',
      estado: 'En inspección',
      estadoFisico: 'Buen estado',
    },
  ];

  @Output() cerrar = new EventEmitter<void>();

  seccionActiva: 'solicitar' | 'mis-solicitudes' | 'bandeja' | 'inspeccion' = 'solicitar';
  mensajeAviso = '';

  // Formulario de Solicitar
  nuevaSolicitud = {
    folioPedido: 'UNQ-847110',
    tipo: 'Cambio' as TipoSolicitudCaso,
    prendaResumen: '',
    motivo: 'Talla ajustada',
    comentario: '',
  };

  // Selección para Inspección
  casoEnInspeccion: SolicitudCambioDevolucion | null = null;
  revisionFisica = {
    estadoFisico: 'Buen estado' as EstadoFisicoPrenda,
    observaciones: '',
    dictamenTexto: '',
  };

  ngOnInit(): void {
    this.casoEnInspeccion = this.solicitudes[0] || null;
  }

  cerrarCasos(): void {
    this.cerrar.emit();
    void this.router.navigate(['/catalogo']);
  }

  cambiarSeccion(sec: 'solicitar' | 'mis-solicitudes' | 'bandeja' | 'inspeccion'): void {
    this.seccionActiva = sec;
    this.mensajeAviso = '';
    if (sec === 'inspeccion' && !this.casoEnInspeccion && this.solicitudes.length > 0) {
      this.casoEnInspeccion = this.solicitudes[0];
    }
  }

  enviarSolicitud(): void {
    if (!this.nuevaSolicitud.folioPedido.trim() || !this.nuevaSolicitud.prendaResumen.trim()) {
      this.mensajeAviso = 'Indica el folio del pedido y la prenda a cambiar o devolver.';
      return;
    }

    const creado: SolicitudCambioDevolucion = {
      id: Date.now(),
      folioCaso: `CD-${Math.floor(1000 + Math.random() * 9000)}`,
      folioPedido: this.nuevaSolicitud.folioPedido.trim().toUpperCase(),
      tipo: this.nuevaSolicitud.tipo,
      prendaResumen: this.nuevaSolicitud.prendaResumen.trim(),
      motivo: this.nuevaSolicitud.motivo,
      comentario: this.nuevaSolicitud.comentario.trim(),
      estado: 'Solicitada',
    };

    this.solicitudes = [creado, ...this.solicitudes];
    this.nuevaSolicitud.prendaResumen = '';
    this.nuevaSolicitud.comentario = '';
    this.seccionActiva = 'mis-solicitudes';
    this.mensajeAviso = `Solicitud registrada con folio ${creado.folioCaso}.`;
  }

  enviarAInspeccion(caso: SolicitudCambioDevolucion): void {
    caso.estado = 'En inspección';
    this.casoEnInspeccion = caso;
    this.revisionFisica = {
      estadoFisico: caso.estadoFisico || 'Buen estado',
      observaciones: '',
      dictamenTexto: caso.dictamen || '',
    };
    this.seccionActiva = 'inspeccion';
    this.mensajeAviso = `El caso ${caso.folioCaso} pasó a inspección física.`;
  }

  resolverInspeccion(aprobada: boolean): void {
    if (!this.casoEnInspeccion) return;
    this.casoEnInspeccion.estadoFisico = this.revisionFisica.estadoFisico;
    this.casoEnInspeccion.estado = aprobada ? 'Aprobada' : 'Rechazada';
    this.casoEnInspeccion.dictamen =
      this.revisionFisica.dictamenTexto.trim() ||
      (aprobada
        ? 'Prenda validada en inspección; procede el trámite.'
        : 'No cumple condiciones para cambio o devolución.');

    this.mensajeAviso = `Caso ${this.casoEnInspeccion.folioCaso} marcado como ${this.casoEnInspeccion.estado}.`;
    this.seccionActiva = 'mis-solicitudes';
  }
}
