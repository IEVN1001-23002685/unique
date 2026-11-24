import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

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
