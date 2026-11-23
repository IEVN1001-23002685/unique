import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

type SeccionProduccion = 'tablero' | 'nueva' | 'revision' | 'plan';

/** Pestañas tipo píldora compartidas por las cinco pantallas de M16. */
@Component({
  selector: 'app-navegacion-produccion',
  imports: [RouterLink],
  templateUrl: './navegacion-produccion.html',
  styleUrl: './navegacion-produccion.css',
})
export class NavegacionProduccion {
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly activa = computed<SeccionProduccion>(() => {
    const url = this.url();
    if (url.startsWith('/produccion/nueva')) {
      return 'nueva';
    }
    if (url.startsWith('/produccion/revision')) {
      return 'revision';
    }
    if (url.startsWith('/produccion/plan-sugerido')) {
      return 'plan';
    }
    return 'tablero';
  });
}
