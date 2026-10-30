import { Routes } from '@angular/router';

import { permisoGuard } from '../../core/auth/guards';

export const TALLER_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./ordenes-page').then((m) => m.OrdenesPage) },
  {
    path: 'nueva',
    canMatch: [permisoGuard('ORDENES_CREAR')],
    data: { miga: 'taller.recepcion.miga' },
    loadComponent: () => import('./nueva-orden-page').then((m) => m.NuevaOrdenPage),
  },
  {
    path: 'mias',
    canMatch: [permisoGuard('ORDENES_VER_ASIGNADAS')],
    data: { miga: 'taller.mias.titulo' },
    loadComponent: () => import('./mis-ordenes-page').then((m) => m.MisOrdenesPage),
  },
  {
    path: ':id',
    data: { miga: 'taller.detalle.miga' },
    loadComponent: () => import('./orden-detalle-page').then((m) => m.OrdenDetallePage),
  },
];
