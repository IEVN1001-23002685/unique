import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionPreparacion } from '../../componentes/navegacion-preparacion/navegacion-preparacion';
import {
  ETIQUETAS_ESTADO_INCIDENCIA,
  ETIQUETAS_TIPO_INCIDENCIA,
  type EstadoIncidencia,
  type TipoIncidencia,
} from '../../modelos/preparacion';
import { PreparacionServicio } from '../../servicios/preparacion-servicio';

type EstadoFiltro = EstadoIncidencia | 'TODAS';
type TipoFiltro = TipoIncidencia | 'TODOS';

@Component({
  selector: 'app-incidencias',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, NavegacionPreparacion],
  templateUrl: './incidencias.html',
  styleUrls: ['./incidencias.css', '../../estilos-compartidos.css'],
})
export class Incidencias {
  protected readonly servicio = inject(PreparacionServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly fb = inject(FormBuilder);

  protected readonly busqueda = signal('');
  protected readonly estado = signal<EstadoFiltro>('TODAS');
  protected readonly tipo = signal<TipoFiltro>('TODOS');
  protected readonly resolviendo = signal<number | null>(null);
  protected readonly conReposicion = signal(true);
  protected readonly intento = signal(false);

  protected readonly estados: { valor: EstadoFiltro; etiqueta: string }[] = [
    { valor: 'TODAS', etiqueta: 'Todos los estados' },
    ...(Object.keys(ETIQUETAS_ESTADO_INCIDENCIA) as EstadoIncidencia[]).map((valor) => ({
      valor,
      etiqueta: ETIQUETAS_ESTADO_INCIDENCIA[valor],
    })),
  ];

  protected readonly tipos: { valor: TipoFiltro; etiqueta: string }[] = [
    { valor: 'TODOS', etiqueta: 'Todos los tipos' },
    ...(Object.keys(ETIQUETAS_TIPO_INCIDENCIA) as TipoIncidencia[]).map((valor) => ({
      valor,
      etiqueta: ETIQUETAS_TIPO_INCIDENCIA[valor],
    })),
  ];

  protected readonly forma = this.fb.nonNullable.group({
    resolucion: ['', [Validators.required, Validators.minLength(4)]],
  });

  protected readonly indicadores = computed(() => {
    const lista = this.servicio.incidencias();
    return {
      total: lista.length,
      abiertas: lista.filter((item) => item.estado === 'ABIERTA').length,
      resueltas: lista.filter((item) => item.estado === 'RESUELTA').length,
      produccion: lista.filter((item) => item.estado === 'PENDIENTE_PRODUCCION').length,
    };
  });

  protected readonly filtrados = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    return this.servicio
      .incidencias()
      .filter((item) => {
        const coincideEstado = this.estado() === 'TODAS' || item.estado === this.estado();
        const coincideTipo = this.tipo() === 'TODOS' || item.tipo === this.tipo();
        const coincideTexto =
          termino === '' ||
          item.folio.toLowerCase().includes(termino) ||
          item.pedidoFolio.toLowerCase().includes(termino) ||
          item.sku.toLowerCase().includes(termino) ||
          item.descripcion.toLowerCase().includes(termino);
        return coincideEstado && coincideTipo && coincideTexto;
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  });

  protected readonly sinFiltros = computed(
    () =>
      this.busqueda().trim() === '' && this.estado() === 'TODAS' && this.tipo() === 'TODOS',
  );

  protected readonly actual = computed(
    () => this.servicio.incidencias().find((item) => item.id === this.resolviendo()) ?? null,
  );

  protected readonly resolucionInvalida = computed(() => {
    const control = this.forma.controls.resolucion;
    return control.invalid && (control.touched || this.intento());
  });

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarEstado(evento: Event): void {
    this.estado.set((evento.target as HTMLSelectElement).value as EstadoFiltro);
  }

  protected alCambiarTipo(evento: Event): void {
    this.tipo.set((evento.target as HTMLSelectElement).value as TipoFiltro);
  }

  protected restablecer(): void {
    this.busqueda.set('');
    this.estado.set('TODAS');
    this.tipo.set('TODOS');
  }

  protected abrirResolucion(id: number): void {
    this.resolviendo.set(id);
    this.forma.controls.resolucion.setValue('');
    this.forma.controls.resolucion.markAsUntouched();
    this.conReposicion.set(true);
    this.intento.set(false);
  }

  protected resolver(): void {
    const id = this.resolviendo();
    if (id === null) {
      return;
    }
    this.intento.set(true);
    if (this.forma.invalid) {
      this.forma.markAllAsTouched();
      return;
    }
    const resultado = this.servicio.resolverIncidencia(
      id,
      this.forma.controls.resolucion.value,
      this.conReposicion(),
    );
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    if (resultado.ok) {
      this.resolviendo.set(null);
    }
  }

  protected etiquetaTipo(tipo: TipoIncidencia): string {
    return ETIQUETAS_TIPO_INCIDENCIA[tipo];
  }

  protected etiquetaEstado(estado: EstadoIncidencia): string {
    return ETIQUETAS_ESTADO_INCIDENCIA[estado];
  }
}
