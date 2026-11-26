import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { CarritoServicio } from '../servicios/carrito-servicio';

/**
 * checkoutGuard (§10.3): impide entrar a /pago con el carrito vacío o no pagable.
 * Revalida leyendo el carrito; no supone que la pantalla ya lo cargó.
 */
export const checkoutGuard: CanActivateFn = () => {
  const carrito = inject(CarritoServicio);
  const router = inject(Router);

  return carrito.cargar().pipe(
    map(
      (resumen): true | UrlTree =>
        resumen.items.length > 0 && resumen.puedePagar
          ? true
          : router.createUrlTree(['/carrito']),
    ),
    catchError(() => of(router.createUrlTree(['/carrito']))),
  );
};
