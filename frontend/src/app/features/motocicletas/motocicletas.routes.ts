import { Routes } from '@angular/router';

export const MOTOCICLETAS_ROUTES: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        loadComponent: () => import('./motocicletas-page').then((m) => m.MotocicletasPage),
      },
      {
        path: ':id',
        data: { miga: 'motos.detalle.miga' },
        loadComponent: () => import('./moto-detalle-page').then((m) => m.MotoDetallePage),
      },
    ],
  },
];
