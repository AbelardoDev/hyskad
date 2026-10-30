import { Routes } from '@angular/router';

import { permisoGuard } from '../../core/auth/guards';

export const INVENTARIO_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./productos-page').then((m) => m.ProductosPage) },
  {
    path: 'productos/:id',
    data: { miga: 'inventario.detalle.miga' },
    loadComponent: () => import('./producto-detalle-page').then((m) => m.ProductoDetallePage),
  },
  {
    path: 'movimientos',
    data: { miga: 'inventario.movimientos.titulo' },
    canMatch: [permisoGuard('PRODUCTOS_GESTIONAR', 'INVENTARIO_AJUSTAR')],
    loadComponent: () => import('./movimientos-page').then((m) => m.MovimientosPage),
  },
];
