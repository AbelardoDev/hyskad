import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';

import { ToastService } from '../../shared/ui/toast/toast';
import { conFormulario, erroresManejados } from './contexto-http';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let mock: HttpTestingController;
  let toasts: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(ToastService);
  });

  afterEach(() => mock.verify());

  const titulos = () => toasts.toasts().map((t) => t.titulo);

  it('traduce el code del ProblemDetail a un toast de error y propaga el error', () => {
    let propagado = false;
    http.get('/api/v1/usuarios/1').subscribe({ error: () => (propagado = true) });
    mock
      .expectOne('/api/v1/usuarios/1')
      .flush({ code: 'ULTIMO_ADMIN' }, { status: 409, statusText: 'Conflict' });

    expect(propagado).toBe(true);
    expect(titulos()).toEqual(['Debe quedar al menos un administrador activo']);
    expect(toasts.toasts()[0].tipo).toBe('error');
  });

  it('un code sin traducción usa el mensaje genérico; sin conexión, su propio mensaje', () => {
    http.get('/api/v1/a').subscribe({ error: () => undefined });
    http.get('/api/v1/b').subscribe({ error: () => undefined });
    mock.expectOne('/api/v1/a').flush({ code: 'NO_EXISTE' }, { status: 400, statusText: 'Bad' });
    mock.expectOne('/api/v1/b').error(new ProgressEvent('error'), { status: 0 });

    expect(titulos()).toEqual([
      'Ocurrió un error inesperado. Intenta de nuevo.',
      'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
    ]);
  });

  it('no muestra toast si el componente maneja el error ni en los 401', () => {
    http.get('/api/v1/a', { context: erroresManejados() }).subscribe({ error: () => undefined });
    http.get('/api/v1/b').subscribe({ error: () => undefined });
    mock.expectOne('/api/v1/a').flush({ code: 'ULTIMO_ADMIN' }, { status: 409, statusText: 'C' });
    mock.expectOne('/api/v1/b').flush({ code: 'NO_AUTENTICADO' }, { status: 401, statusText: 'U' });

    expect(titulos()).toEqual([]);
  });

  it('marca en el formulario los errores de campo que devuelve la validación', () => {
    const form = new FormGroup({
      email: new FormControl('ana@x.co'),
      telefono: new FormControl('123'),
    });
    http
      .post('/api/v1/usuarios', {}, { context: conFormulario(form) })
      .subscribe({ error: () => undefined });
    mock.expectOne('/api/v1/usuarios').flush(
      {
        code: 'VALIDACION',
        errors: [
          { campo: 'telefono', code: 'TELEFONO_INVALIDO' },
          { campo: 'otro', code: 'NOT_BLANK' },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(form.controls.telefono.errors).toEqual({ servidor: 'TELEFONO_INVALIDO' });
    expect(form.controls.telefono.touched).toBe(true);
    expect(form.controls.email.valid).toBe(true);
    expect(titulos()).toEqual(['Revisa los datos del formulario']);
  });
});
