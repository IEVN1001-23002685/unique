import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { PerfilSesionServicio } from '../../../../nucleo/servicios/perfil-sesion-servicio';

type SeccionInventario = 'existencias' | 'lotes' | 'kardex' | 'ajuste' | 'catalogo' | 'politicas';

/** Pestañas tipo píldora compartidas por las seis pantallas de M15. */
@Component({
  selector: 'app-navegacion-inventario',
  imports: [RouterLink],
  templateUrl: './navegacion-inventario.html',
  styleUrl: './navegacion-inventario.css',
})
export class NavegacionInventario {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStateService);
  private readonly perfilSesion = inject(PerfilSesionServicio);

  /** Catálogo y políticas son de Administrador (§3 y §10); las demás son de operación. */
  protected readonly esAdministrador = computed(() =>
    this.auth.puede(['ADMIN']),
  );

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly activa = computed<SeccionInventario>(() => {
    const url = this.url();
    if (url.startsWith('/inventario-mp/lotes')) {
      return 'lotes';
    }
    if (url.startsWith('/inventario-mp/kardex')) {
      return 'kardex';
    }
    if (url.startsWith('/inventario-mp/ajuste')) {
      return 'ajuste';
    }
    if (url.startsWith('/inventario-mp/catalogo')) {
      return 'catalogo';
    }
    if (url.startsWith('/inventario-mp/politicas')) {
      return 'politicas';
    }
    return 'existencias';
  });
}
