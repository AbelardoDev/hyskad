import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { errorInterceptor } from '../../core/http/error.interceptor';
import { ajustesDesde } from './permisos-usuario-page';
import { DatosFormUsuario, UsuarioFormDrawer } from './usuario-form-drawer';
import { PermisoDeUsuario, Usuario } from './usuarios-api.service';

const USUARIO: Usuario = {
  id: 7,
  nombre: 'Victor Vendedor',
  email: 'victor@hyskad.test',
  telefono: null,
  rol: 'VENDEDOR',
  activo: true,
  idioma: 'es',
  ultimoAcceso: null,
  debeCambiarPassword: false,
  createdAt: '2026-10-29T00:00:00Z',
};

describe('UsuarioFormDrawer', () => {
  let cerrar: ReturnType<typeof vi.fn>;

  function montar(datos: DatosFormUsuario = {}) {
    cerrar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: DialogRef, useValue: { close: cerrar } },
        { provide: DIALOG_DATA, useValue: datos },
      ],
    });
    const fixture = TestBed.createComponent(UsuarioFormDrawer);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const escribir = (etiqueta: string, valor: string) => {
      const label = Array.from(el.querySelectorAll('label')).find((l) =>
        l.textContent?.includes(etiqueta),
      )!;
      const control = el.querySelector<HTMLInputElement | HTMLSelectElement>(
        `#${label.getAttribute('for')}`,
      )!;
      control.value = valor;
      control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input'));
      control.dispatchEvent(new Event('blur'));
    };
    const enviar = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const errores = () =>
      Array.from(el.querySelectorAll('[role="alert"]')).map((e) => e.textContent?.trim());
    return { fixture, el, escribir, enviar, errores };
  }

  it('al crear valida nombre, correo, rol y la política de contraseñas sin llamar al backend', async () => {
    const { enviar, errores, escribir } = montar();
    await enviar();

    expect(errores()).toEqual([
      'Este campo es obligatorio',
      'Este campo es obligatorio',
      'Este campo es obligatorio',
      'Este campo es obligatorio',
    ]);

    escribir('Correo electrónico', 'no-es-correo');
    escribir('Teléfono', '12-34');
    escribir('Contraseña inicial', 'corta');
    await enviar();
    expect(errores()).toContain('Escribe un correo válido');
    expect(errores()).toContain('El formato no es válido');
    expect(errores()).toContain('Usa al menos 8 caracteres, con letras y números');
    TestBed.inject(HttpTestingController).expectNone('/api/v1/usuarios');
  });

  it('crea el usuario con los datos limpios y cierra devolviéndolo', async () => {
    const { enviar, escribir } = montar();
    escribir('Nombre', '  Victor Vendedor ');
    escribir('Correo electrónico', 'victor@hyskad.test');
    escribir('Rol', 'VENDEDOR');
    escribir('Contraseña inicial', 'Clave2026');
    await enviar();

    const req = TestBed.inject(HttpTestingController).expectOne('/api/v1/usuarios');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      nombre: 'Victor Vendedor',
      email: 'victor@hyskad.test',
      telefono: null,
      rol: 'VENDEDOR',
      idioma: 'es',
      password: 'Clave2026',
    });
    req.flush(USUARIO);
    expect(cerrar).toHaveBeenCalledWith(USUARIO);
  });

  it('al editar no pide contraseña y un correo repetido se marca en su campo', async () => {
    const { el, enviar, errores, fixture } = montar({ usuario: USUARIO });
    expect(el.textContent).not.toContain('Contraseña inicial');
    await enviar();

    const req = TestBed.inject(HttpTestingController).expectOne('/api/v1/usuarios/7');
    expect(req.request.method).toBe('PUT');
    req.flush({ code: 'EMAIL_DUPLICADO' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(errores()).toContain('Ya existe un usuario con ese correo');
    expect(cerrar).not.toHaveBeenCalled();
  });
});

describe('ajustesDesde', () => {
  const permiso = (p: Partial<PermisoDeUsuario>): PermisoDeUsuario => ({
    permiso: 'VENTAS_VER',
    delRol: true,
    ajuste: null,
    efectivo: true,
    editable: true,
    soloAdmin: false,
    ...p,
  });

  it('envía solo lo que difiere del rol: retirar uno del rol y conceder uno extra', () => {
    const permisos = [
      permiso({ permiso: 'VENTAS_VER' }),
      permiso({ permiso: 'VENTAS_CREAR' }),
      permiso({ permiso: 'INVENTARIO_AJUSTAR', delRol: false, efectivo: false }),
      permiso({ permiso: 'USUARIOS_GESTIONAR', delRol: false, efectivo: false, editable: false }),
    ];
    const elegidos = new Map([
      ['VENTAS_VER', true],
      ['VENTAS_CREAR', false],
      ['INVENTARIO_AJUSTAR', true],
      ['USUARIOS_GESTIONAR', false],
    ] as const);

    expect(ajustesDesde(permisos, elegidos)).toEqual([
      { permiso: 'VENTAS_CREAR', concedido: false },
      { permiso: 'INVENTARIO_AJUSTAR', concedido: true },
    ]);
  });
});
