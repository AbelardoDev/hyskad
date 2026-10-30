import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';

import { UsuarioSesion } from './auth.models';
import { authGuard, invitadoGuard, permisoGuard, sesionGuard } from './guards';
import { iniciarSesionDePrueba } from './sesion-de-prueba';

@Component({ template: '' })
class Vacia {}

const RUTAS: Routes = [
  { path: 'login', canActivate: [invitadoGuard], component: Vacia },
  { path: 'cambiar-password', canActivate: [sesionGuard], component: Vacia },
  { path: 'acceso-denegado', component: Vacia },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: 'dashboard', component: Vacia },
      { path: 'usuarios', canMatch: [permisoGuard('USUARIOS_GESTIONAR')], component: Vacia },
      {
        path: 'ordenes',
        canMatch: [permisoGuard('ORDENES_VER_TODAS', 'ORDENES_VER_ASIGNADAS')],
        component: Vacia,
      },
    ],
  },
];

function configurar(sesion: Partial<UsuarioSesion> | null) {
  TestBed.configureTestingModule({
    providers: [provideRouter(RUTAS), provideHttpClient(), provideHttpClientTesting()],
  });
  if (sesion) iniciarSesionDePrueba(sesion);
  return TestBed.inject(Router);
}

const MECANICO: Partial<UsuarioSesion> = {
  rol: 'MECANICO',
  permisos: ['DASHBOARD_VER', 'ORDENES_VER_ASIGNADAS'],
};

describe('guards', () => {
  it('authGuard: sin sesión va al login con la URL de retorno', async () => {
    const router = configurar(null);
    await router.navigateByUrl('/dashboard?x=1');
    expect(router.url).toBe('/login?returnUrl=%2Fdashboard%3Fx%3D1');
  });

  it('permisoGuard: sin sesión también va al login (canMatch se evalúa antes)', async () => {
    const router = configurar(null);
    await router.navigateByUrl('/usuarios');
    expect(router.url).toBe('/login?returnUrl=%2Fusuarios');
  });

  it('permisoGuard: un mecánico que escribe /usuarios termina en la página 403', async () => {
    const router = configurar(MECANICO);
    await router.navigateByUrl('/usuarios');
    expect(router.url).toBe('/acceso-denegado');
  });

  it('permisoGuard: basta con uno de los permisos', async () => {
    const router = configurar(MECANICO);
    await router.navigateByUrl('/ordenes');
    expect(router.url).toBe('/ordenes');
  });

  it('authGuard: si debe cambiar la contraseña solo puede ir a esa pantalla', async () => {
    const router = configurar({ debeCambiarPassword: true });
    await router.navigateByUrl('/dashboard');
    expect(router.url).toBe('/cambiar-password');
  });

  it('invitadoGuard: con sesión, el login no es accesible', async () => {
    const router = configurar({});
    await router.navigateByUrl('/login');
    expect(router.url).not.toContain('login');
  });

  it('sesionGuard: el cambio de contraseña exige sesión', async () => {
    const router = configurar(null);
    await router.navigateByUrl('/cambiar-password');
    expect(router.url).toBe('/login?returnUrl=%2Fcambiar-password');
  });
});
