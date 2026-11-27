import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { PerfilSesionServicio } from '../../../../nucleo/servicios/perfil-sesion-servicio';

type SeccionCompra = 'requisiciones' | 'cotizaciones' | 'ordenes' | 'recepciones';

/** Pestañas tipo píldora compartidas por las cuatro pantallas de M14. */
@Component({
  selector: 'app-navegacion-compras',
  imports: [RouterLink],
  templateUrl: './navegacion-compras.html',
  styleUrl: './navegacion-compras.css',
})
export class NavegacionCompras {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStateService);
  private readonly perfilSesion = inject(PerfilSesionServicio);

  /** §10: las pestañas de compras son de Administrador; recepciones también es Operativo. */
  protected readonly esAdministrador = computed(() =>
    this.auth.puede(['ADMIN']),
  );

  /** Se recalcula en cada navegación para mantener activa la sección en subrutas. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly activa = computed<SeccionCompra>(() => {
    const url = this.url();
    if (url.startsWith('/recepciones')) {
      return 'recepciones';
    }
    if (url.startsWith('/compras/cotizaciones')) {
      return 'cotizaciones';
    }
    if (url.startsWith('/compras/ordenes')) {
      return 'ordenes';
    }
    return 'requisiciones';
  });
}
