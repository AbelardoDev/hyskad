import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { errorInterceptor } from '../../core/http/error.interceptor';
import { DatosFormServicio, ServicioFormDrawer } from './servicio-form-drawer';

describe('ServicioFormDrawer', () => {
  let cerrar: ReturnType<typeof vi.fn>;

  function montar(datos: DatosFormServicio = {}) {
    cerrar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: DialogRef, useValue: { close: cerrar } },
        { provide: DIALOG_DATA, useValue: datos },
      ],
    });
    const fixture = TestBed.createComponent(ServicioFormDrawer);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const campo = (etiqueta: string) => {
      const label = Array.from(el.querySelectorAll('label')).find((l) =>
        l.textContent?.trim().startsWith(etiqueta),
      )!;
      return el.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `#${label.getAttribute('for')}`,
      )!;
    };
    const escribir = (etiqueta: string, valor: string) => {
      const control = campo(etiqueta);
      control.value = valor;
      control.dispatchEvent(new Event('input'));
      control.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
    };
    const enviar = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const errores = () =>
      Array.from(el.querySelectorAll('hk-form-field [role="alert"]')).map((e) =>
        e.textContent?.trim(),
      );
    return { fixture, escribir, enviar, errores };
  }

  it('exige nombre, precio y tiempo positivos sin llamar al backend', async () => {
    const { enviar, errores, escribir } = montar();
    await enviar();
    expect(errores()).toEqual([
      'Este campo es obligatorio',
      'Este campo es obligatorio',
      'Este campo es obligatorio',
    ]);
    escribir('Tiempo estimado', '0');
    await enviar();
    expect(errores()).toContain('El valor mínimo es 1');
    TestBed.inject(HttpTestingController).expectNone('/api/v1/servicios');
  });

  it('envía los datos limpios y un nombre repetido se marca en su campo', async () => {
    const { fixture, enviar, errores, escribir } = montar();
    escribir('Nombre', '  Sincronización  ');
    escribir('Precio base', '80000');
    escribir('Tiempo estimado', '120');
    await enviar();

    const req = TestBed.inject(HttpTestingController).expectOne('/api/v1/servicios');
    expect(req.request.body).toEqual({
      nombre: 'Sincronización',
      descripcion: null,
      precioBase: 80000,
      tiempoEstimadoMin: 120,
    });
    req.flush({ code: 'SERVICIO_DUPLICADO', status: 409 }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(errores()).toEqual(['Ya existe un servicio con ese nombre']);
    expect(cerrar).not.toHaveBeenCalled();
  });
});
