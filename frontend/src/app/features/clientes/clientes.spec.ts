import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { errorInterceptor } from '../../core/http/error.interceptor';
import { numeroConDv } from '../../core/utils/validadores';
import { ClienteFormDrawer, DatosFormCliente } from './cliente-form-drawer';
import { Cliente } from './clientes-api.service';

const CLIENTE: Cliente = {
  id: 3,
  tipoDocumento: 'CC',
  numeroDocumento: '1067845123',
  nombres: 'Carlos',
  apellidos: 'Pérez',
  razonSocial: null,
  nombreCompleto: 'Carlos Pérez',
  telefono: '3004567812',
  email: null,
  direccion: null,
  ciudad: null,
  aceptaTratamientoDatos: true,
  fechaAceptacionDatos: '2026-10-29T15:00:00Z',
  cantidadMotos: 0,
  activo: true,
  createdAt: '2026-10-29T15:00:00Z',
};

describe('numeroConDv', () => {
  it('al NIT de 9 dígitos le agrega el DV; con 10 lo deja para validarlo', () => {
    expect(numeroConDv('NIT', '900.123.456')).toBe('9001234568');
    expect(numeroConDv('NIT', '900123456-7')).toBe('9001234567');
    expect(numeroConDv('CC', '1.067.845.123')).toBe('1067845123');
  });
});

describe('ClienteFormDrawer', () => {
  let cerrar: ReturnType<typeof vi.fn>;

  function montar(datos: DatosFormCliente = {}) {
    cerrar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: DialogRef, useValue: { close: cerrar } },
        { provide: DIALOG_DATA, useValue: datos },
      ],
    });
    const fixture = TestBed.createComponent(ClienteFormDrawer);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const control = (etiqueta: string) => {
      const label = Array.from(el.querySelectorAll('label')).find(
        (l) => l.textContent?.trim().replace(/\s*\*$/, '') === etiqueta,
      );
      return label
        ? el.querySelector<HTMLInputElement | HTMLSelectElement>(`#${label.getAttribute('for')}`)
        : null;
    };
    const escribir = (etiqueta: string, valor: string) => {
      const campo = control(etiqueta)!;
      campo.value = valor;
      campo.dispatchEvent(new Event(campo instanceof HTMLSelectElement ? 'change' : 'input'));
      campo.dispatchEvent(new Event('blur'));
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
    return { fixture, el, control, escribir, enviar, errores };
  }

  it('con cédula pide nombres y apellidos, valida documento y teléfono sin llamar al backend', async () => {
    const { control, enviar, errores, escribir } = montar();
    expect(control('Nombres')).not.toBeNull();
    expect(control('Razón social')).toBeNull();

    await enviar();
    expect(errores()).toEqual([
      'Este campo es obligatorio',
      'Este campo es obligatorio',
      'Este campo es obligatorio',
      'Este campo es obligatorio',
    ]);

    escribir('Número de documento', '12');
    escribir('Teléfono', '2001234567');
    await enviar();
    expect(errores()).toContain('El número no corresponde al tipo de documento');
    expect(errores()).toContain('Escribe un celular o un fijo de 10 dígitos');
    TestBed.inject(HttpTestingController).expectNone('/api/v1/clientes');
  });

  it('con NIT pide razón social, calcula el DV en vivo y lo envía con el número', async () => {
    const { el, control, enviar, escribir } = montar();
    escribir('Tipo de documento', 'NIT');

    expect(control('Nombres')).toBeNull();
    expect(control('Razón social')).not.toBeNull();
    escribir('NIT (sin dígito de verificación)', '900.123.456');
    expect(el.querySelector('output')?.textContent).toContain('8');

    escribir('Razón social', ' Motos del Sinú S.A.S. ');
    escribir('Teléfono', '604 789 1234');
    await enviar();

    const req = TestBed.inject(HttpTestingController).expectOne('/api/v1/clientes');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      tipoDocumento: 'NIT',
      numeroDocumento: '9001234568',
      nombres: null,
      apellidos: null,
      razonSocial: 'Motos del Sinú S.A.S.',
      telefono: '6047891234',
      email: null,
      direccion: null,
      ciudad: null,
      aceptaTratamientoDatos: false,
    });
    req.flush({ ...CLIENTE, id: 9 });
    expect(cerrar).toHaveBeenCalled();
  });

  it('un NIT escrito con un DV que no corresponde no se envía', async () => {
    const { enviar, errores, escribir } = montar();
    escribir('Tipo de documento', 'NIT');
    escribir('NIT (sin dígito de verificación)', '900123456-7');
    escribir('Razón social', 'Mala S.A.S.');
    escribir('Teléfono', '3001234567');
    await enviar();

    expect(errores()).toEqual([
      'El NIT no es válido: revisa el número y el dígito de verificación',
    ]);
    TestBed.inject(HttpTestingController).expectNone('/api/v1/clientes');
  });

  it('al editar muestra la fecha de autorización y un documento repetido se marca en su campo', async () => {
    const { el, enviar, errores, fixture } = montar({ cliente: CLIENTE });
    expect(el.textContent).toContain('Autorizó el tratamiento de datos el');
    await enviar();

    const req = TestBed.inject(HttpTestingController).expectOne('/api/v1/clientes/3');
    expect(req.request.method).toBe('PUT');
    req.flush({ code: 'DOCUMENTO_DUPLICADO' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(errores()).toEqual(['Ya existe un registro con ese documento']);
    expect(cerrar).not.toHaveBeenCalled();
  });
});
