import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

/** Página 403 del §10.2. No sustituye a los guards definitivos de Flask. */
@Component({
  selector: 'app-pagina-sin-acceso',
  imports: [RouterLink],
  templateUrl: './sin-acceso.html',
  styleUrl: './sin-acceso.css',
})
export class SinAcceso {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly parametros = this.ruta.snapshot.queryParamMap;

  protected readonly perfil = this.parametros.get('perfil') ?? 'tu perfil de demostración';
  protected readonly requerido = this.parametros.get('requerido') ?? 'Administrador';
  protected readonly destino = this.parametros.get('ruta') ?? 'la sección solicitada';

  protected volver(): void {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    void this.router.navigate(['/catalogo']);
  }
}
