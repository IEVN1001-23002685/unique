import { CurrencyPipe, DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { DetalleMerma } from '../../componentes/detalle-merma/detalle-merma';
import { ModalReversarMerma } from '../../componentes/modal-reversar-merma/modal-reversar-merma';
import { NavegacionMermas } from '../../componentes/navegacion-mermas/navegacion-mermas';
import { MermasServicio } from '../../servicios/mermas-servicio';
import {
  ETAPAS_MERMA,
  ETIQUETAS_ETAPA,
  FILTROS_ORIGEN,
  type EtapaMerma,
  type FiltrosZona,
  type MermaVista,
  type OrigenMerma,
} from '../../modelos/merma';

/** Historial de la zona de merma y correcciones por reverso (M17). */
@Component({
  selector: 'app-zona-merma',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    NgClass,
    RouterLink,
    NavegacionMermas,
    DetalleMerma,
    ModalReversarMerma,
  ],
  templateUrl: './zona-merma.html',
  styleUrls: ['./zona-merma.css', '../../mermas-compartido.css'],
})
export class ZonaMerma {
  private readonly servicio = inject(MermasServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly auth = inject(AuthStateService);

  private readonly tamanoPagina = 8;

  protected readonly etapas = ETAPAS_MERMA;
  protected readonly etiquetasEtapa = ETIQUETAS_ETAPA;
  protected readonly origenes = FILTROS_ORIGEN;

  protected readonly filtroTexto = signal('');
  protected readonly filtroProducto = signal('');
  protected readonly filtroPeriodo = signal('TODOS');
  protected readonly filtroEtapa = signal<EtapaMerma | 'TODAS'>('TODAS');
  protected readonly filtroCausa = signal<number | 'TODAS'>('TODAS');
  protected readonly filtroOrigen = signal<OrigenMerma | 'TODOS'>('TODOS');
  protected readonly pagina = signal(1);
  protected readonly detalle = signal<MermaVista | null>(null);
  protected readonly reversar = signal<MermaVista | null>(null);

  private readonly filtros = computed<FiltrosZona>(() => ({
    periodo: this.filtroPeriodo(),
    etapa: this.filtroEtapa(),
    causaId: this.filtroCausa(),
    origen: this.filtroOrigen(),
    producto: this.filtroProducto(),
    texto: this.filtroTexto(),
  }));

  protected readonly causas = computed(() => this.servicio.causas());
  protected readonly periodos = computed(() => {
    const claves = new Set(this.servicio.mermas().map((merma) => merma.fecha.slice(0, 7)));
    return [
      { clave: 'TODOS', etiqueta: 'Todos los periodos' },
      ...[...claves]
        .sort()
        .reverse()
        .map((clave) => ({
          clave,
          etiqueta: new Intl.DateTimeFormat('es-MX', {
            month: 'long',
            year: 'numeric',
          }).format(new Date(`${clave}-01T12:00:00`)),
        })),
    ];
  });

  protected readonly registros = computed(() => this.servicio.filtrar(this.filtros()));
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.registros().length / this.tamanoPagina)),
  );
  protected readonly paginaSegura = computed(() =>
    Math.min(Math.max(1, this.pagina()), this.totalPaginas()),
  );
  protected readonly visibles = computed(() => {
    const inicio = (this.paginaSegura() - 1) * this.tamanoPagina;
    return this.registros().slice(inicio, inicio + this.tamanoPagina);
  });

  protected readonly resumen = computed(() => {
    const todas = this.servicio.mermas();
    return {
      total: todas.filter((merma) => !merma.esReversion).length,
      automaticas: todas.filter((merma) => merma.automatica && !merma.esReversion).length,
      manuales: todas.filter((merma) => merma.procedencia === 'MANUAL').length,
      corregidas: todas.filter((merma) => merma.reversionDeId !== null).length,
    };
  });

  protected readonly esAdministrador = computed(() => this.auth.puede(['ADMIN']));

  protected alCambiarTexto(evento: Event): void {
    this.filtroTexto.set((evento.target as HTMLInputElement).value);
    this.pagina.set(1);
  }

  protected alCambiarProducto(evento: Event): void {
    this.filtroProducto.set((evento.target as HTMLInputElement).value);
    this.pagina.set(1);
  }

  protected alCambiarPeriodo(evento: Event): void {
    this.filtroPeriodo.set((evento.target as HTMLSelectElement).value);
    this.pagina.set(1);
  }

  protected alCambiarEtapa(evento: Event): void {
    this.filtroEtapa.set((evento.target as HTMLSelectElement).value as EtapaMerma | 'TODAS');
    this.pagina.set(1);
  }

  protected alCambiarCausa(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.filtroCausa.set(valor === 'TODAS' ? 'TODAS' : Number(valor));
    this.pagina.set(1);
  }

  protected alCambiarOrigen(clave: OrigenMerma | 'TODOS'): void {
    this.filtroOrigen.set(clave);
    this.pagina.set(1);
  }

  protected limpiarFiltros(): void {
    this.filtroTexto.set('');
    this.filtroProducto.set('');
    this.filtroPeriodo.set('TODOS');
    this.filtroEtapa.set('TODAS');
    this.filtroCausa.set('TODAS');
    this.filtroOrigen.set('TODOS');
    this.pagina.set(1);
  }

  protected irAPagina(pagina: number): void {
    this.pagina.set(Math.min(Math.max(1, pagina), this.totalPaginas()));
  }

  protected verDetalle(merma: MermaVista): void {
    this.detalle.set(merma);
  }

  protected cerrarDetalle(): void {
    this.detalle.set(null);
  }

  protected solicitarReverso(merma: MermaVista): void {
    if (!this.esAdministrador()) {
      this.avisos.mostrar(
        'informacion',
        'Corregir una merma requiere una sesión con perfil Administrador.',
      );
      return;
    }
    this.reversar.set(merma);
  }

  protected cancelarReverso(): void {
    this.reversar.set(null);
  }

  protected confirmarReverso(motivo: string): void {
    const merma = this.reversar();
    if (!merma) {
      return;
    }
    this.servicio.reversar(merma.id, motivo).subscribe((resultado) => {
      this.reversar.set(null);
      this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    });
  }

  protected etiquetaEstado(merma: MermaVista): string {
    if (merma.reversada) {
      return 'Corregida';
    }
    if (merma.esReversion) {
      return 'Registro inverso';
    }
    return merma.automatica ? 'Automática' : 'Registrada';
  }

  protected claseEstado(merma: MermaVista): string {
    if (merma.reversada) {
      return 'etiqueta--alerta';
    }
    if (merma.esReversion) {
      return 'etiqueta--neutro';
    }
    return merma.automatica ? 'etiqueta--info' : 'etiqueta--exito';
  }
}
