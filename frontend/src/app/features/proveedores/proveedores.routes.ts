import { Routes } from '@angular/router';

export const PROVEEDORES_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./proveedores-page').then((m) => m.ProveedoresPage) },
  {
    path: ':id',
    data: { miga: 'proveedores.detalle.miga' },
    loadComponent: () => import('./proveedor-detalle-page').then((m) => m.ProveedorDetallePage),
  },
];
