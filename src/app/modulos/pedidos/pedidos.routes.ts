import { Routes } from '@angular/router';

/**
 * Rutas de M09 · Pedidos, montadas bajo /admin/pedidos.
 * Se reserva /pedidos para M06 (mis pedidos del cliente) según el mapa del §10.
 */
export const PEDIDOS_RUTAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Bandeja de pedidos · UNIQUE',
    loadComponent: () =>
      import('./paginas/bandeja-pedidos/bandeja-pedidos').then((c) => c.BandejaPedidos),
  },
  {
    path: 'pendientes-produccion',
    title: 'Pendientes de producción · UNIQUE',
    loadComponent: () =>
      import('./paginas/pendientes-produccion/pendientes-produccion').then(
        (c) => c.PendientesProduccion,
      ),
  },
  {
    path: 'cancelados',
    title: 'Pedidos cancelados · UNIQUE',
    loadComponent: () => import('./paginas/cancelados/cancelados').then((c) => c.Cancelados),
  },
  {
    path: ':folio',
    title: 'Detalle de pedido · UNIQUE',
    loadComponent: () =>
      import('./paginas/detalle-pedido/detalle-pedido').then((c) => c.DetallePedido),
  },
  { path: '**', redirectTo: '' },
];
