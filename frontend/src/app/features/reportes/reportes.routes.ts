import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { permisoGuard, RUTA_ACCESO_DENEGADO } from '../../core/auth/guards';
import { PESTANAS_REPORTES, ReportesPage } from './reportes-page';

/** Primera pestaña que el usuario puede ver (o acceso denegado si no tiene ninguna). */
function pestanaPorDefecto(): string {
  const auth = inject(AuthService);
  const pestana = PESTANAS_REPORTES.find((p) => auth.tienePermiso(p.permiso));
  return pestana ? `/reportes/${pestana.id}` : RUTA_ACCESO_DENEGADO;
}

export const REPORTES_ROUTES: Routes = [
  {
    path: '',
    component: ReportesPage,
    children: [
      { path: '', pathMatch: 'full', redirectTo: pestanaPorDefecto },
      {
        path: 'servicios',
        canMatch: [permisoGuard('PRESUPUESTOS_GESTIONAR')],
        data: { miga: 'reportes.pestanas.servicios' },
        loadComponent: () => import('./reporte-servicios').then((m) => m.ReporteServiciosPage),
      },
      {
        path: 'inventario',
        canMatch: [permisoGuard('PRODUCTOS_GESTIONAR')],
        data: { miga: 'reportes.pestanas.inventario' },
        loadComponent: () => import('./reporte-inventario').then((m) => m.ReporteInventarioPage),
      },
      {
        path: 'ventas',
        canMatch: [permisoGuard('VENTAS_ANULAR')],
        data: { miga: 'reportes.pestanas.ventas' },
        loadComponent: () => import('./reporte-ventas').then((m) => m.ReporteVentasPage),
      },
      {
        path: 'cuentas-pendientes',
        canMatch: [permisoGuard('PAGOS_REGISTRAR')],
        data: { miga: 'reportes.cuentas.titulo' },
        loadComponent: () =>
          import('./cuentas-pendientes-page').then((m) => m.CuentasPendientesPage),
      },
    ],
  },
];
