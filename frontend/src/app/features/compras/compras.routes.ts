import { Routes } from '@angular/router';

export const COMPRAS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./compras-page').then((m) => m.ComprasPage) },
  {
    path: 'nueva',
    data: { miga: 'compras.nueva' },
    loadComponent: () => import('./nueva-compra-page').then((m) => m.NuevaCompraPage),
  },
  {
    path: ':id',
    data: { miga: 'compras.detalle.miga' },
    loadComponent: () => import('./compra-detalle-page').then((m) => m.CompraDetallePage),
  },
];
