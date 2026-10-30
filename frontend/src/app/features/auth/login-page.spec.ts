import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { sesionDePrueba } from '../../core/auth/sesion-de-prueba';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { ToastService } from '../../shared/ui/toast/toast';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let el: HTMLElement;
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LoginPage);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  function escribir(tipo: 'email' | 'password', valor: string) {
    const input = el.querySelector<HTMLInputElement>(
      tipo === 'email' ? 'input[type="email"]' : 'input[autocomplete="current-password"]',
    )!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  async function enviar() {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('valida los campos antes de llamar al backend', async () => {
    await enviar();
    expect(el.querySelectorAll('hk-form-field [role="alert"]')).toHaveLength(2);
    http.expectNone('/api/v1/auth/login');
  });

  it('con credenciales válidas entra a la URL de retorno', async () => {
    fixture.componentRef.setInput('returnUrl', '/usuarios');
    escribir('email', ' admin@hyskad.local ');
    escribir('password', 'Hyskad2026');
    await enviar();

    const req = http.expectOne('/api/v1/auth/login');
    expect(req.request.body).toEqual({ email: 'admin@hyskad.local', password: 'Hyskad2026' });
    req.flush(sesionDePrueba());
    expect(navegar).toHaveBeenCalledWith('/usuarios');
  });

  it('si debe cambiar la contraseña va a esa pantalla e ignora una URL de retorno externa', async () => {
    fixture.componentRef.setInput('returnUrl', 'https://malo.com');
    escribir('email', 'admin@hyskad.local');
    escribir('password', 'Hyskad2026');
    await enviar();
    http.expectOne('/api/v1/auth/login').flush(sesionDePrueba({ debeCambiarPassword: true }));

    expect(navegar).toHaveBeenCalledWith('/cambiar-password');
  });

  it('credenciales inválidas: mensaje genérico en el formulario, sin toast', async () => {
    escribir('email', 'admin@hyskad.local');
    escribir('password', 'mala12345');
    await enviar();
    http
      .expectOne('/api/v1/auth/login')
      .flush({ code: 'CREDENCIALES_INVALIDAS' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(el.querySelector('hk-aviso-formulario')?.textContent).toContain(
      'Correo o contraseña incorrectos',
    );
    expect(TestBed.inject(ToastService).toasts()).toEqual([]);
  });

  it('ante el 429 muestra cuánto esperar y bloquea el botón hasta que pase', async () => {
    vi.useFakeTimers();
    escribir('email', 'admin@hyskad.local');
    escribir('password', 'mala12345');
    await enviar();
    http
      .expectOne('/api/v1/auth/login')
      .flush(
        { code: 'DEMASIADAS_SOLICITUDES' },
        { status: 429, statusText: 'Too Many', headers: { 'Retry-After': '3' } },
      );
    fixture.detectChanges();
    const boton = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    expect(el.querySelector('hk-aviso-formulario')?.textContent).toContain(
      'Podrás intentarlo de nuevo en 3 s.',
    );
    expect(boton.disabled).toBe(true);

    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(el.querySelector('hk-aviso-formulario')).toBeNull();
    expect(boton.disabled).toBe(false);
  });
});
