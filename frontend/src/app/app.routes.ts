import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { authGuard, invitadoGuard, permisoGuard, sesionGuard } from './core/auth/guards';
import { AuthLayout } from './core/layout/auth-layout';
import { NavegacionService } from './core/layout/navegacion.service';
import { HkShell } from './core/layout/shell';
import { DEV_ROUTES } from './dev/dev.routes';

/**
 * Rutas de la app. Las pantallas de acceso van en `AuthLayout`; el resto, dentro del shell y con
 * sesión (`authGuard`). Cada módulo es lazy, exige su permiso con `canMatch` (el mismo del menú)
 * y declara `data.miga` (clave i18n) para las migas de pan y el título de la pestaña.
 */
export const routes: Routes = [
  {
    path: '',
    component: HkShell,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: () => inject(NavegacionService).rutaInicio() },
      {
        path: 'dashboard',
        canMatch: [permisoGuard('DASHBOARD_VER')],
        data: { miga: 'menu.dashboard' },
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'ordenes',
        canMatch: [permisoGuard('ORDENES_VER_TODAS', 'ORDENES_VER_ASIGNADAS')],
        data: { miga: 'menu.ordenes' },
        loadChildren: () => import('./features/taller/taller.routes').then((m) => m.TALLER_ROUTES),
      },
      {
        path: 'clientes',
        canMatch: [permisoGuard('CLIENTES_VER')],
        data: { miga: 'menu.clientes' },
        loadChildren: () =>
          import('./features/clientes/clientes.routes').then((m) => m.CLIENTES_ROUTES),
      },
      {
        path: 'motocicletas',
        canMatch: [permisoGuard('MOTOS_VER')],
        data: { miga: 'menu.motocicletas' },
        loadChildren: () =>
          import('./features/motocicletas/motocicletas.routes').then((m) => m.MOTOCICLETAS_ROUTES),
      },
      {
        path: 'servicios',
        canMatch: [permisoGuard('SERVICIOS_GESTIONAR')],
        data: { miga: 'menu.servicios' },
        loadChildren: () =>
          import('./features/servicios/servicios.routes').then((m) => m.SERVICIOS_ROUTES),
      },
      {
        path: 'ventas',
        canMatch: [permisoGuard('VENTAS_VER')],
        data: { miga: 'menu.ventas' },
        loadChildren: () => import('./features/ventas/ventas.routes').then((m) => m.VENTAS_ROUTES),
      },
      {
        path: 'inventario',
        canMatch: [permisoGuard('PRODUCTOS_VER')],
        data: { miga: 'menu.inventario' },
        loadChildren: () =>
          import('./features/inventario/inventario.routes').then((m) => m.INVENTARIO_ROUTES),
      },
      {
        path: 'compras',
        canMatch: [permisoGuard('COMPRAS_GESTIONAR')],
        data: { miga: 'menu.compras' },
        loadChildren: () =>
          import('./features/compras/compras.routes').then((m) => m.COMPRAS_ROUTES),
      },
      {
        path: 'proveedores',
        canMatch: [permisoGuard('PROVEEDORES_GESTIONAR')],
        data: { miga: 'menu.proveedores' },
        loadChildren: () =>
          import('./features/proveedores/proveedores.routes').then((m) => m.PROVEEDORES_ROUTES),
      },
      {
        path: 'reportes',
        canMatch: [permisoGuard('REPORTES_VER')],
        data: { miga: 'menu.reportes' },
        loadChildren: () =>
          import('./features/reportes/reportes.routes').then((m) => m.REPORTES_ROUTES),
      },
      {
        path: 'usuarios',
        canMatch: [permisoGuard('USUARIOS_GESTIONAR')],
        data: { miga: 'menu.usuarios' },
        loadChildren: () =>
          import('./features/usuarios/usuarios.routes').then((m) => m.USUARIOS_ROUTES),
      },
      {
        path: 'configuracion',
        canMatch: [permisoGuard('CONFIGURACION_GESTIONAR')],
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
      {
        path: 'acceso-denegado',
        data: { miga: 'acceso_denegado.miga' },
        loadComponent: () =>
          import('./core/layout/paginas/acceso-denegado-page').then((m) => m.AccesoDenegadoPage),
      },
      ...DEV_ROUTES,
    ],
  },
  // Después del shell: con `''` y sin hijo que coincida, capturaría la raíz.
  {
    path: '',
    component: AuthLayout,
    children: [
      {
        path: 'login',
        canActivate: [invitadoGuard],
        data: { miga: 'auth.login.miga' },
        loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
      },
      {
        path: 'olvide-password',
        canActivate: [invitadoGuard],
        data: { miga: 'auth.olvide.miga' },
        loadComponent: () =>
          import('./features/auth/olvide-password-page').then((m) => m.OlvidePasswordPage),
      },
      {
        path: 'restablecer-password',
        data: { miga: 'auth.restablecer.miga' },
        loadComponent: () =>
          import('./features/auth/restablecer-password-page').then(
            (m) => m.RestablecerPasswordPage,
          ),
      },
      {
        path: 'cambiar-password',
        canActivate: [sesionGuard],
        data: { miga: 'auth.cambiar.miga' },
        loadComponent: () =>
          import('./features/auth/cambiar-password-page').then((m) => m.CambiarPasswordPage),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./core/layout/paginas/no-encontrada-page').then((m) => m.NoEncontradaPage),
  },
];
