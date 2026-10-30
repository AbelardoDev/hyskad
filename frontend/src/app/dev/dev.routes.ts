import { Routes } from '@angular/router';

/**
 * Rutas solo para desarrollo. En el build de producción este archivo se reemplaza por
 * `dev.routes.prod.ts` (angular.json → fileReplacements), así la galería no entra al bundle.
 */
export const DEV_ROUTES: Routes = [
  {
    path: 'dev/ui',
    data: { miga: 'menu.dev_ui' },
    loadComponent: () => import('./ui-galeria/ui-galeria-page').then((m) => m.UiGaleriaPage),
  },
];
