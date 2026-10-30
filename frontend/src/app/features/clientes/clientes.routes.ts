import { Routes } from '@angular/router';

export const CLIENTES_ROUTES: Routes = [
  {
    path: '',
    children: [
      { path: '', loadComponent: () => import('./clientes-page').then((m) => m.ClientesPage) },
      {
        path: ':id',
        data: { miga: 'clientes.detalle.miga' },
        loadComponent: () => import('./cliente-detalle-page').then((m) => m.ClienteDetallePage),
      },
    ],
  },
];
