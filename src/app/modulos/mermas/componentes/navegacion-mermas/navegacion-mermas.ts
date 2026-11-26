import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { PerfilDemoServicio } from '../../../../nucleo/servicios/perfil-demo-servicio';

type SeccionMermas = 'zona' | 'registro' | 'indicadores';

/** Pestañas tipo píldora compartidas por las tres pantallas de M17. */
@Component({
  selector: 'app-navegacion-mermas',
  imports: [RouterLink],
  templateUrl: './navegacion-mermas.html',
  styleUrl: './navegacion-mermas.css',
})
export class NavegacionMermas {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStateService);
  private readonly perfilDemo = inject(PerfilDemoServicio);

  /** Indicadores es exclusivo del Administrador (§3 y §10). */
  protected readonly esAdministrador = computed(() =>
    this.auth.autenticado()
      ? this.auth.puede(['ADMIN'])
      : this.perfilDemo.esAdministrador(),
  );

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly activa = computed<SeccionMermas>(() => {
    const url = this.url();
    if (url.startsWith('/mermas/registro')) {
      return 'registro';
    }
    if (url.startsWith('/mermas/indicadores')) {
      return 'indicadores';
    }
    return 'zona';
  });
}
