import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { iniciarSesionDePrueba, sesionDePrueba } from './sesion-de-prueba';

const NO_AUTORIZADO = { status: 401, statusText: 'Unauthorized' };

describe('authInterceptor', () => {
  let http: HttpClient;
  let mock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  it('agrega el access token a la API pero no a otros orígenes ni a los archivos estáticos', () => {
    iniciarSesionDePrueba();

    http.get('/api/v1/usuarios').subscribe();
    http.get('/i18n/es.json').subscribe();

    expect(mock.expectOne('/api/v1/usuarios').request.headers.get('Authorization')).toBe(
      'Bearer token-1',
    );
    expect(mock.expectOne('/i18n/es.json').request.headers.has('Authorization')).toBe(false);
  });

  it('en /auth/* envía la cookie (withCredentials); login y refresh van sin token', () => {
    iniciarSesionDePrueba();

    http.post('/api/v1/auth/refresh', null).subscribe();
    http.get('/api/v1/auth/me').subscribe();

    const refresh = mock.expectOne('/api/v1/auth/refresh').request;
    expect(refresh.withCredentials).toBe(true);
    expect(refresh.headers.has('Authorization')).toBe(false);
    const me = mock.expectOne('/api/v1/auth/me').request;
    expect(me.withCredentials).toBe(true);
    expect(me.headers.get('Authorization')).toBe('Bearer token-1');
  });

  it('CP-04: varias peticiones con 401 a la vez hacen un único refresh y se reintentan', () => {
    iniciarSesionDePrueba();
    const respuestas: unknown[] = [];
    for (const url of ['/api/v1/a', '/api/v1/b', '/api/v1/c'])
      http.get(url).subscribe((r) => respuestas.push(r));

    for (const url of ['/api/v1/a', '/api/v1/b', '/api/v1/c'])
      mock.expectOne(url).flush({ code: 'NO_AUTENTICADO' }, NO_AUTORIZADO);

    const refrescos = mock.match('/api/v1/auth/refresh');
    expect(refrescos).toHaveLength(1);
    refrescos[0].flush(sesionDePrueba({}, 'token-2'));

    for (const url of ['/api/v1/a', '/api/v1/b', '/api/v1/c']) {
      const reintento = mock.expectOne(url);
      expect(reintento.request.headers.get('Authorization')).toBe('Bearer token-2');
      reintento.flush({ ok: url });
    }
    expect(respuestas).toHaveLength(3);
  });

  it('si el refresh falla, cierra la sesión y lleva al login con la URL de retorno', () => {
    iniciarSesionDePrueba();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/usuarios');
    let error: unknown;
    http.get('/api/v1/usuarios').subscribe({ error: (e) => (error = e) });

    mock.expectOne('/api/v1/usuarios').flush({ code: 'NO_AUTENTICADO' }, NO_AUTORIZADO);
    mock.expectOne('/api/v1/auth/refresh').flush({ code: 'SESION_INVALIDA' }, NO_AUTORIZADO);

    expect(error).toBeTruthy();
    expect(TestBed.inject(AuthService).estaAutenticado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/usuarios' } });
  });

  it('un 401 tras el reintento no vuelve a refrescar (sin bucles)', () => {
    iniciarSesionDePrueba();
    let error: unknown;
    http.get('/api/v1/x').subscribe({ error: (e) => (error = e) });

    mock.expectOne('/api/v1/x').flush(null, NO_AUTORIZADO);
    mock.expectOne('/api/v1/auth/refresh').flush(sesionDePrueba({}, 'token-2'));
    mock.expectOne('/api/v1/x').flush(null, NO_AUTORIZADO);

    mock.expectNone('/api/v1/auth/refresh');
    expect(error).toBeTruthy();
  });

  it('sin sesión, un 401 se propaga sin intentar refrescar', () => {
    let status = 0;
    http.get('/api/v1/x').subscribe({ error: (e: { status: number }) => (status = e.status) });

    mock.expectOne('/api/v1/x').flush(null, NO_AUTORIZADO);

    mock.expectNone('/api/v1/auth/refresh');
    expect(status).toBe(401);
  });

  it('el login fallido no dispara refresh', () => {
    http.post('/api/v1/auth/login', {}).subscribe({ error: () => undefined });
    mock.expectOne('/api/v1/auth/login').flush({ code: 'CREDENCIALES_INVALIDAS' }, NO_AUTORIZADO);
    mock.expectNone('/api/v1/auth/refresh');
  });
});
