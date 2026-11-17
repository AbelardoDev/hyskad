import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { iniciarSesionDePrueba } from '../../core/auth/sesion-de-prueba';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { ToastService } from '../../shared/ui/toast/toast';
import { ConfiguracionTaller } from './configuracion-api.service';
import { aPorcentaje, ConfiguracionPage } from './configuracion-page';

const API = '/api/v1/configuracion';

const GUARDADA: ConfiguracionTaller = {
  nombre: 'Taller HYSKAD',
  nit: '9001234568',
  direccion: 'Calle 1 # 2-3, Montería',
  telefono: '3001234567',
  email: null,
  ivaPorcentaje: 19,
  textoAutorizacionDatos: 'Autorizo el tratamiento de mis datos.',
  alertaStockHabilitada: true,
};

async function montar() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  iniciarSesionDePrueba();
  const fixture = TestBed.createComponent(ConfiguracionPage);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  const el = fixture.nativeElement as HTMLElement;
  http.expectOne(API).flush(GUARDADA);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  const campo = (etiqueta: string) => {
    const label = Array.from(el.querySelectorAll('label')).find((l) =>
      l.textContent?.trim().startsWith(etiqueta),
    )!;
    return el.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${label.htmlFor}`)!;
  };
  const escribir = (etiqueta: string, valor: string) => {
    const control = campo(etiqueta);
    control.value = valor;
    control.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const guardar = () =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Guardar cambios'),
    )!;
  return { fixture, http, el, campo, escribir, guardar };
}

// CP-136
describe('ConfiguracionPage', () => {
  it('carga los datos por secciones con el NIT y su DV, y no deja guardar sin cambios', async () => {
    const m = await montar();

    const secciones = Array.from(m.el.querySelectorAll('hk-card h2, hk-card h3')).map((h) =>
      h.textContent?.trim(),
    );
    expect(secciones).toEqual(['Taller', 'Impuestos', 'Privacidad', 'Alertas']);
    expect(m.campo('NIT').value).toBe('900123456-8');
    expect(m.campo('IVA (%)').value).toBe('19');
    expect(m.guardar().disabled || m.guardar().getAttribute('aria-disabled') === 'true').toBe(true);
  });

  it('con 9 dígitos muestra el DV y lo agrega al guardar; el IVA acepta coma decimal', async () => {
    const m = await montar();
    const exito = vi.spyOn(TestBed.inject(ToastService), 'exito');
    m.escribir('NIT', '800197268');
    expect(m.el.textContent).toContain('Dígito de verificación: 4');
    m.escribir('IVA (%)', '19,5');

    m.guardar().click();
    m.fixture.detectChanges();
    const req = m.http.expectOne((r) => r.url === API && r.method === 'PUT');
    expect(req.request.body).toMatchObject({
      nit: '800197268-4',
      ivaPorcentaje: 19.5,
      email: null,
    });
    req.flush({ ...GUARDADA, nit: '8001972684', ivaPorcentaje: 19.5 });
    m.fixture.detectChanges();
    await m.fixture.whenStable();

    expect(exito).toHaveBeenCalledWith('Configuración guardada');
    expect(m.campo('NIT').value).toBe('800197268-4');
  });

  it('no envía con un NIT de DV equivocado ni con un IVA mayor que 100', async () => {
    const m = await montar();
    m.escribir('NIT', '900123456-1');
    m.escribir('IVA (%)', '150');

    m.guardar().click();
    m.fixture.detectChanges();

    m.http.expectNone((r) => r.method === 'PUT');
    expect(m.campo('NIT').getAttribute('aria-invalid')).toBe('true');
    expect(m.campo('IVA (%)').getAttribute('aria-invalid')).toBe('true');
  });

  it('aPorcentaje acepta punto o coma con hasta 2 decimales, de 0 a 100', () => {
    expect(aPorcentaje('19')).toBe(19);
    expect(aPorcentaje(' 5,25 ')).toBe(5.25);
    expect(aPorcentaje('100.00')).toBe(100);
    expect(aPorcentaje('100.01')).toBeNull();
    expect(aPorcentaje('1.234')).toBeNull();
    expect(aPorcentaje('-1')).toBeNull();
  });
});
