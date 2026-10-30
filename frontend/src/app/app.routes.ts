import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/ping/ping-page').then((m) => m.PingPage),
  },
  { path: '**', redirectTo: '' },
];
