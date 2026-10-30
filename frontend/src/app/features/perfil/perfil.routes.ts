import { Routes } from '@angular/router';

export const PERFIL_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./perfil-page').then((m) => m.PerfilPage) },
];
