import { Routes } from '@angular/router';

import { permisoGuard } from '../../core/auth/guards';

export const VENTAS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./ventas-page').then((m) => m.VentasPage) },
  {
    path: 'nueva',
    canMatch: [permisoGuard('VENTAS_CREAR')],
    data: { miga: 'ventas.nueva' },
    loadComponent: () => import('./punto-venta-page').then((m) => m.PuntoVentaPage),
  },
  {
    path: ':id',
    data: { miga: 'ventas.detalle.miga' },
    loadComponent: () => import('./venta-detalle-page').then((m) => m.VentaDetallePage),
  },
];
