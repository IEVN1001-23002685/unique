import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AvisoToast } from '../../compartido/componentes/aviso-toast/aviso-toast';
import { mensajeError } from '../../core/api/errores';
import { AuthStateService } from '../../core/auth/auth-state.service';
import { Bandeja } from './paginas/bandeja/bandeja';
import { MisSolicitudes } from './paginas/mis-solicitudes/mis-solicitudes';
import { Recepcion } from './paginas/recepcion/recepcion';
import { Resolucion } from './paginas/resolucion/resolucion';
import { Solicitar } from './paginas/solicitar/solicitar';
import {
  DevolucionesServicio,
  type SolicitudCambioDevolucion,
} from './servicios/devoluciones-servicio';

export type { SolicitudCambioDevolucion } from './modelos/cambio-devolucion';

type Vista = 'solicitar' | 'mis-solicitudes' | 'bandeja' | 'recepcion' | 'resolucion';

/**
 * M07 · Cambios y devoluciones. Coordina las cinco pantallas documentadas
 * respetando el ámbito (tienda del cliente u operación) y el rol de la sesión.
 */
@Component({
  selector: 'app-cambios-devoluciones',
  standalone: true,
  imports: [
    AvisoToast,
    Bandeja,
    MisSolicitudes,
    Recepcion,
    Resolucion,
    RouterLink,
    RouterLinkActive,
    Solicitar,
  ],
  templateUrl: './cambios-devoluciones.html',
  styleUrls: ['./cambios-devoluciones.css', './cambios-devoluciones-compartido.css'],
})
export class CambiosDevoluciones {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStateService);
  private readonly servicio = inject(DevolucionesServicio);
  private readonly destroyRef = inject(DestroyRef);

  private readonly datosRuta = toSignal(this.ruta.data, {
    initialValue: this.ruta.snapshot.data,
  });
  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });
  private readonly consulta = toSignal(this.ruta.queryParamMap, {
    initialValue: this.ruta.snapshot.queryParamMap,
  });

  readonly solicitudes = signal<SolicitudCambioDevolucion[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');

  readonly ambito = computed(() =>
    this.datosRuta()['ambito'] === 'operacion' ? ('operacion' as const) : ('cliente' as const),
  );
  readonly vista = computed<Vista>(() => {
    const declarada = String(this.datosRuta()['vista'] ?? '');
    if (
      declarada === 'solicitar' ||
      declarada === 'mis-solicitudes' ||
      declarada === 'bandeja' ||
      declarada === 'recepcion' ||
      declarada === 'resolucion'
    ) {
      return declarada;
    }
    return this.ambito() === 'cliente' ? 'solicitar' : 'bandeja';
  });
  readonly casoId = computed(() => Number(this.parametros().get('casoId') ?? 0));
  readonly pedidoInicial = computed(() => Number(this.consulta().get('pedido_id') ?? 0));
  readonly folioInicial = computed(() => this.consulta().get('folio'));

  readonly puedeAprobar = computed(() => this.auth.puede(['ADMIN']));
  readonly puedeOperar = computed(() => this.auth.puede(['OPERATIVO']));

  readonly casoSeleccionado = computed(
    () => this.solicitudes().find((caso) => caso.id === this.casoId()) ?? null,
  );

  constructor() {
    this.recargar();
  }

  protected recargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.servicio
      .listar()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cargando.set(false)),
      )
      .subscribe({
        next: (casos) => this.solicitudes.set(casos),
        error: (error: unknown) => {
          this.error.set(mensajeError(error, 'No fue posible cargar las solicitudes.'));
          this.solicitudes.set([]);
        },
      });
  }

  protected alEnviar(_folio: string): void {
    void this.router.navigate(['/devoluciones', 'mis-solicitudes']);
  }
}
