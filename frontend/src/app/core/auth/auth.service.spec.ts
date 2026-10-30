import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { LanguageService } from '../i18n/language.service';
import { ANTICIPACION_REFRESCO_S, AuthService, esRutaInterna } from './auth.service';
import { sesionDePrueba } from './sesion-de-prueba';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('sin sesión no tiene usuario, token ni permisos', () => {
    expect(auth.estaAutenticado()).toBe(false);
    expect(auth.token()).toBeNull();
    expect(auth.tienePermiso('USUARIOS_GESTIONAR')).toBe(false);
  });

  it('login guarda la sesión solo en memoria, con permisos y el idioma del usuario', () => {
    let nombre = '';
    auth.login('ana@hyskad.test', 'Clave12345').subscribe((u) => (nombre = u.nombre));
    const req = http.expectOne('/api/v1/auth/login');
    expect(req.request.body).toEqual({ email: 'ana@hyskad.test', password: 'Clave12345' });
    req.flush(sesionDePrueba({ permisos: ['VENTAS_VER'], idioma: 'en' }, 'abc'));

    expect(nombre).toBe('Ana Admin');
    expect(auth.estaAutenticado()).toBe(true);
    expect(auth.token()).toBe('abc');
    expect(auth.tienePermiso('VENTAS_VER')).toBe(true);
    expect(auth.tienePermiso('VENTAS_CREAR')).toBe(false);
    expect(auth.tieneAlguno(['VENTAS_CREAR', 'VENTAS_VER'])).toBe(true);
    expect(TestBed.inject(LanguageService).idioma()).toBe('en');
    // Criterio de aceptación: el token nunca va a localStorage ni a sessionStorage.
    const guardado = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(guardado).not.toContain('abc');
  });

  it('restaurar recupera la sesión con la cookie de refresh', async () => {
    const promesa = auth.restaurar();
    http.expectOne('/api/v1/auth/refresh').flush(sesionDePrueba());
    await promesa;

    expect(auth.estaAutenticado()).toBe(true);
  });

  it('restaurar sin cookie válida deja la app sin sesión y no falla', async () => {
    const promesa = auth.restaurar();
    http
      .expectOne('/api/v1/auth/refresh')
      .flush({ code: 'SESION_INVALIDA' }, { status: 401, statusText: 'Unauthorized' });
    await promesa;

    expect(auth.estaAutenticado()).toBe(false);
  });

  it('varios refrescos a la vez comparten una sola petición', () => {
    const tokens: string[] = [];
    auth.refrescar().subscribe((t) => tokens.push(t));
    auth.refrescar().subscribe((t) => tokens.push(t));
    auth.refrescar().subscribe((t) => tokens.push(t));

    http.expectOne('/api/v1/auth/refresh').flush(sesionDePrueba({}, 'nuevo'));

    expect(tokens).toEqual(['nuevo', 'nuevo', 'nuevo']);
    // Terminado, el siguiente refresh es una petición nueva.
    auth.refrescar().subscribe();
    http.expectOne('/api/v1/auth/refresh').flush(sesionDePrueba({}, 'otro'));
    expect(auth.token()).toBe('otro');
  });

  it('renueva el token un minuto antes de que venza', () => {
    vi.useFakeTimers();
    auth.login('a@b.co', 'x').subscribe();
    http.expectOne('/api/v1/auth/login').flush(sesionDePrueba({}, 't1', 900));

    vi.advanceTimersByTime((900 - ANTICIPACION_REFRESCO_S) * 1000 - 1);
    http.expectNone('/api/v1/auth/refresh');
    vi.advanceTimersByTime(1);
    http.expectOne('/api/v1/auth/refresh').flush(sesionDePrueba({}, 't2', 900));

    expect(auth.token()).toBe('t2');
  });

  it('si el refresco automático falla, cierra la sesión y va al login con la URL de retorno', async () => {
    vi.useFakeTimers();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/usuarios?q=ana');
    auth.login('a@b.co', 'x').subscribe();
    http.expectOne('/api/v1/auth/login').flush(sesionDePrueba({}, 't1', 120));

    vi.advanceTimersByTime(60_000);
    http
      .expectOne('/api/v1/auth/refresh')
      .flush({ code: 'SESION_INVALIDA' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.estaAutenticado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/usuarios?q=ana' },
    });
  });

  it('logout revoca en el backend, limpia la sesión y va al login aunque el backend falle', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.login('a@b.co', 'x').subscribe();
    http.expectOne('/api/v1/auth/login').flush(sesionDePrueba());

    const promesa = auth.logout();
    const req = http.expectOne('/api/v1/auth/logout');
    req.flush(null, { status: 500, statusText: 'Error' });
    await promesa;

    expect(auth.estaAutenticado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith('/login');
  });

  it('cambiar el idioma con sesión lo guarda como preferencia', () => {
    auth.login('a@b.co', 'x').subscribe();
    http.expectOne('/api/v1/auth/login').flush(sesionDePrueba({ idioma: 'es' }));

    auth.cambiarIdioma('en');
    const req = http.expectOne('/api/v1/auth/me/preferencias');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ idioma: 'en' });
    req.flush(sesionDePrueba({ idioma: 'en' }).usuario);

    expect(auth.usuario()?.idioma).toBe('en');
    expect(TestBed.inject(LanguageService).idioma()).toBe('en');
  });

  it('sin sesión, cambiar el idioma no llama al backend', () => {
    auth.cambiarIdioma('en');
    http.expectNone('/api/v1/auth/me/preferencias');
    expect(TestBed.inject(LanguageService).idioma()).toBe('en');
  });
});

describe('esRutaInterna', () => {
  it('acepta rutas de la app y rechaza redirecciones a otros sitios', () => {
    expect(esRutaInterna('/usuarios?q=1')).toBe(true);
    expect(esRutaInterna('https://malo.com')).toBe(false);
    expect(esRutaInterna('//malo.com')).toBe(false);
    expect(esRutaInterna('/\\malo.com')).toBe(false);
    expect(esRutaInterna(undefined)).toBe(false);
  });
});
