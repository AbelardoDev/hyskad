import { Routes } from '@angular/router';

export const REPORTES_ROUTES: Routes = [
  // Hasta F11 el único reporte es el de cuentas pendientes (RF26)
  { path: '', pathMatch: 'full', redirectTo: 'cuentas-pendientes' },
  {
    path: 'cuentas-pendientes',
    data: { miga: 'reportes.cuentas.titulo' },
    loadComponent: () => import('./cuentas-pendientes-page').then((m) => m.CuentasPendientesPage),
  },
];
