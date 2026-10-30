import { Routes } from '@angular/router';

export const SERVICIOS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./servicios-page').then((m) => m.ServiciosPage) },
];
