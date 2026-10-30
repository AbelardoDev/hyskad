import { Routes } from '@angular/router';

export const USUARIOS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./usuarios-page').then((m) => m.UsuariosPage) },
  {
    path: ':id/permisos',
    data: { miga: 'usuarios.permisos.miga' },
    loadComponent: () => import('./permisos-usuario-page').then((m) => m.PermisosUsuarioPage),
  },
];
