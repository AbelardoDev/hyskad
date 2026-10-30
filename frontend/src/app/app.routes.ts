import { Routes } from '@angular/router';

import { HkShell } from './core/layout/shell';
import { DEV_ROUTES } from './dev/dev.routes';

/**
 * Rutas de la app. Cada módulo es lazy y declara `data.miga` (clave i18n) para las migas de pan
 * y el título de la pestaña. Los guards por permiso llegan en F04B.
 */
export const routes: Routes = [
  {
    path: '',
    component: HkShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        data: { miga: 'menu.dashboard' },
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'ordenes',
        data: { miga: 'menu.ordenes' },
        loadChildren: () => import('./features/taller/taller.routes').then((m) => m.TALLER_ROUTES),
      },
      {
        path: 'clientes',
        data: { miga: 'menu.clientes' },
        loadChildren: () =>
          import('./features/clientes/clientes.routes').then((m) => m.CLIENTES_ROUTES),
      },
      {
        path: 'motocicletas',
        data: { miga: 'menu.motocicletas' },
        loadChildren: () =>
          import('./features/motocicletas/motocicletas.routes').then((m) => m.MOTOCICLETAS_ROUTES),
      },
      {
        path: 'servicios',
        data: { miga: 'menu.servicios' },
        loadChildren: () =>
          import('./features/servicios/servicios.routes').then((m) => m.SERVICIOS_ROUTES),
      },
      {
        path: 'ventas',
        data: { miga: 'menu.ventas' },
        loadChildren: () => import('./features/ventas/ventas.routes').then((m) => m.VENTAS_ROUTES),
      },
      {
        path: 'inventario',
        data: { miga: 'menu.inventario' },
        loadChildren: () =>
          import('./features/inventario/inventario.routes').then((m) => m.INVENTARIO_ROUTES),
      },
      {
        path: 'compras',
        data: { miga: 'menu.compras' },
        loadChildren: () =>
          import('./features/compras/compras.routes').then((m) => m.COMPRAS_ROUTES),
      },
      {
        path: 'proveedores',
        data: { miga: 'menu.proveedores' },
        loadChildren: () =>
          import('./features/proveedores/proveedores.routes').then((m) => m.PROVEEDORES_ROUTES),
      },
      {
        path: 'reportes',
        data: { miga: 'menu.reportes' },
        loadChildren: () =>
          import('./features/reportes/reportes.routes').then((m) => m.REPORTES_ROUTES),
      },
      {
        path: 'usuarios',
        data: { miga: 'menu.usuarios' },
        loadChildren: () =>
          import('./features/usuarios/usuarios.routes').then((m) => m.USUARIOS_ROUTES),
      },
      {
        path: 'configuracion',
        data: { miga: 'menu.configuracion' },
        loadChildren: () =>
          import('./features/configuracion/configuracion.routes').then(
            (m) => m.CONFIGURACION_ROUTES,
          ),
      },
      {
        path: 'perfil',
        data: { miga: 'menu.perfil' },
        loadChildren: () => import('./features/perfil/perfil.routes').then((m) => m.PERFIL_ROUTES),
      },
      ...DEV_ROUTES,
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./core/layout/paginas/no-encontrada-page').then((m) => m.NoEncontradaPage),
  },
];
