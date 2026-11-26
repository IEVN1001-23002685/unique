import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { PerfilDemoServicio } from '../../../../nucleo/servicios/perfil-demo-servicio';
import { BarraMeta } from '../../componentes/barra-meta/barra-meta';
import { NavegacionMermas } from '../../componentes/navegacion-mermas/navegacion-mermas';
import { MermasServicio } from '../../servicios/mermas-servicio';
import type { FilaEvolucion } from '../../modelos/merma';

/** Analítica de M17. Según §4 y §7 es una vista exclusiva del Administrador. */
@Component({
  selector: 'app-indicadores-merma',
  imports: [CurrencyPipe, DecimalPipe, RouterLink, NavegacionMermas, BarraMeta],
  templateUrl: './indicadores.html',
  styleUrls: ['./indicadores.css', '../../mermas-compartido.css'],
})
export class Indicadores {
  protected readonly servicio = inject(MermasServicio);
  private readonly auth = inject(AuthStateService);
  private readonly perfilDemo = inject(PerfilDemoServicio);

  protected readonly esAdministrador = computed(() =>
    this.auth.autenticado()
      ? this.auth.puede(['ADMIN'])
      : this.perfilDemo.esAdministrador(),
  );

  protected reintentar(): void {
    this.servicio.recargar().subscribe();
  }
  protected readonly datos = computed(() => this.servicio.indicadores());
  protected readonly meta = computed(() => this.datos().metaPct);

  private readonly maximoEvolucion = computed(() =>
    Math.max(
      1,
      ...this.datos().evolucion.map((fila) =>
        Math.max(fila.cantidadProducto, fila.cantidadMaterial),
      ),
    ),
  );

  protected tonoMeta(porcentaje: number): 'exito' | 'adv' | 'error' {
    const meta = this.meta();
    return porcentaje > meta ? 'error' : porcentaje > meta * 0.8 ? 'adv' : 'exito';
  }

  protected altura(fila: FilaEvolucion, tipo: 'producto' | 'material'): number {
    const valor =
      tipo === 'producto' ? Math.max(fila.cantidadProducto, 0) : Math.max(fila.cantidadMaterial, 0);
    return Math.max(3, Math.round((valor / this.maximoEvolucion()) * 100));
  }
}
