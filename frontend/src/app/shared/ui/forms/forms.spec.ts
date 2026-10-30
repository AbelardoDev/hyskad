import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { HkCheckbox } from './checkbox';
import { HkDateInput } from './date-input';
import { errorCampo, HkFormField } from './form-field';
import { HkInput } from './input';
import { HkMoneyInput } from './money-input';
import { HkSelect } from './select';
import { HkSwitch } from './switch';
import { HkTextarea } from './textarea';

@Component({
  imports: [
    ReactiveFormsModule,
    HkFormField,
    HkInput,
    HkTextarea,
    HkSelect,
    HkCheckbox,
    HkSwitch,
    HkDateInput,
    HkMoneyInput,
  ],
  template: `
    <form [formGroup]="form">
      <hk-form-field etiqueta="Nombre" ayuda="Como en el documento">
        <hk-input formControlName="nombre" />
      </hk-form-field>
      <hk-form-field etiqueta="Clave"
        ><hk-input formControlName="clave" tipo="password"
      /></hk-form-field>
      <hk-form-field etiqueta="Notas" [opcional]="true">
        <hk-textarea formControlName="notas" [maxCaracteres]="50" />
      </hk-form-field>
      <hk-form-field etiqueta="Tipo">
        <hk-select formControlName="tipo" placeholder="Elige" [opciones]="opciones" />
      </hk-form-field>
      <hk-checkbox formControlName="acepta">Acepto</hk-checkbox>
      <hk-switch formControlName="activo">Activo</hk-switch>
      <hk-form-field etiqueta="Fecha"><hk-date-input formControlName="fecha" /></hk-form-field>
      <hk-form-field etiqueta="Monto"><hk-money-input formControlName="monto" /></hk-form-field>
    </form>
  `,
})
class Anfitrion {
  readonly opciones = [
    { valor: 'CC', etiqueta: 'Cédula' },
    { valor: 'NIT', etiqueta: 'NIT' },
  ];
  readonly form = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(3)]),
    clave: new FormControl(''),
    notas: new FormControl(''),
    tipo: new FormControl<string | null>(null),
    acepta: new FormControl(false),
    activo: new FormControl(false),
    fecha: new FormControl<string | null>(null),
    monto: new FormControl<number | null>(null),
  });
}

async function montar() {
  localStorage.clear();
  const fixture = TestBed.createComponent(Anfitrion);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const q = <T extends Element>(selector: string) => el.querySelector<T>(selector)!;
  const escribir = async (campo: HTMLInputElement | HTMLTextAreaElement, texto: string) => {
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  return { fixture, el, q, form: fixture.componentInstance.form, escribir };
}

describe('errorCampo', () => {
  it('traduce validadores de Angular a validacion.* y códigos del servidor a errors.*', () => {
    expect(errorCampo(null)).toBeNull();
    expect(errorCampo({ required: true })).toEqual({ clave: 'validacion.required', params: {} });
    expect(errorCampo({ minlength: { requiredLength: 3, actualLength: 1 } })).toEqual({
      clave: 'validacion.minlength',
      params: { requiredLength: 3, actualLength: 1 },
    });
    expect(errorCampo({ servidor: 'PLACA_INVALIDA' })).toEqual({
      clave: 'errors.PLACA_INVALIDA',
      params: {},
    });
  });
});

describe('hk-form-field + hk-input', () => {
  it('asocia la etiqueta al control, marca obligatorio y describe con la ayuda', async () => {
    const { q } = await montar();
    const label = q<HTMLLabelElement>('label');
    const input = q<HTMLInputElement>('hk-input input');

    expect(label.textContent).toContain('Nombre');
    expect(label.htmlFor).toBe(input.id);
    expect(label.textContent).toContain('*');
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toContain(
      'Como en el documento',
    );
  });

  it('propaga lo escrito al formulario y muestra el error traducido solo tras tocar', async () => {
    const { fixture, q, form, escribir } = await montar();
    const input = q<HTMLInputElement>('hk-input input');

    await escribir(input, 'Al');
    expect(form.value.nombre).toBe('Al');
    expect(q('[role="alert"]')).toBeNull();

    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    const error = q<HTMLElement>('[role="alert"]');
    expect(error.textContent).toContain('Escribe al menos 3 caracteres');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
  });

  it('muestra errores del servidor con su código', async () => {
    const { fixture, q, form } = await montar();

    form.controls.nombre.setErrors({ servidor: 'DOCUMENTO_INVALIDO' });
    form.controls.nombre.markAsTouched();
    await fixture.whenStable();

    expect(q('[role="alert"]').textContent).toContain('El número de documento no es válido');
  });

  it('refleja el valor y el estado deshabilitado que pone el formulario', async () => {
    const { fixture, q, form } = await montar();

    form.controls.nombre.setValue('Ana');
    form.controls.nombre.disable();
    await fixture.whenStable();

    const input = q<HTMLInputElement>('hk-input input');
    expect(input.value).toBe('Ana');
    expect(input.disabled).toBe(true);
  });

  it('el campo de contraseña alterna su visibilidad con un botón accesible', async () => {
    const { fixture, el } = await montar();
    const contenedor = el.querySelectorAll('hk-input')[1];
    const input = contenedor.querySelector('input')!;
    const boton = contenedor.querySelector('button')!;

    expect(input.type).toBe('password');
    expect(boton.getAttribute('aria-label')).toBe('Mostrar contraseña');

    boton.click();
    await fixture.whenStable();

    expect(input.type).toBe('text');
    expect(boton.getAttribute('aria-pressed')).toBe('true');
    expect(boton.getAttribute('aria-label')).toBe('Ocultar contraseña');
  });
});

describe('hk-textarea', () => {
  it('escribe en el formulario, cuenta caracteres y muestra "(opcional)"', async () => {
    const { q, form, escribir, el } = await montar();

    await escribir(q<HTMLTextAreaElement>('textarea'), 'Ruido en el motor');

    expect(form.value.notas).toBe('Ruido en el motor');
    expect(q('hk-textarea p').textContent).toContain('17 / 50');
    expect(el.textContent).toContain('(opcional)');
  });
});

describe('hk-select', () => {
  it('muestra el placeholder y entrega el valor elegido (o null)', async () => {
    const { fixture, q, form } = await montar();
    const select = q<HTMLSelectElement>('select');

    expect(select.options[0].textContent?.trim()).toBe('Elige');
    expect(select.options).toHaveLength(3);

    select.value = 'NIT';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(form.value.tipo).toBe('NIT');

    select.value = '';
    select.dispatchEvent(new Event('change'));
    expect(form.value.tipo).toBeNull();
  });
});

describe('hk-checkbox y hk-switch', () => {
  it('el checkbox entrega booleanos y se etiqueta con su contenido', async () => {
    const { fixture, q, form } = await montar();
    const casilla = q<HTMLInputElement>('hk-checkbox input');

    expect(q('hk-checkbox label').textContent).toContain('Acepto');
    casilla.click();
    await fixture.whenStable();
    expect(form.value.acepta).toBe(true);
  });

  it('el switch usa role="switch", aria-checked y se activa con su etiqueta', async () => {
    const { fixture, q, form } = await montar();
    const interruptor = q<HTMLButtonElement>('[role="switch"]');

    expect(interruptor.getAttribute('aria-checked')).toBe('false');
    interruptor.click();
    await fixture.whenStable();
    expect(form.value.activo).toBe(true);
    expect(interruptor.getAttribute('aria-checked')).toBe('true');

    q<HTMLLabelElement>('hk-switch label').click();
    await fixture.whenStable();
    expect(form.value.activo).toBe(false);
  });
});

describe('hk-date-input', () => {
  it('entrega la fecha ISO o null', async () => {
    const { q, form } = await montar();
    const campo = q<HTMLInputElement>('input[type="date"]');

    campo.value = '2026-10-29';
    campo.dispatchEvent(new Event('change'));
    expect(form.value.fecha).toBe('2026-10-29');

    campo.value = '';
    campo.dispatchEvent(new Event('change'));
    expect(form.value.fecha).toBeNull();
  });
});

describe('hk-money-input', () => {
  it('formatea miles mientras se escribe y entrega un número entero', async () => {
    const { q, form, escribir } = await montar();
    const campo = q<HTMLInputElement>('hk-money-input input');

    await escribir(campo, '1250000');
    expect(campo.value).toBe('1.250.000');
    expect(form.value.monto).toBe(1250000);

    await escribir(campo, '$ 0045.6a');
    expect(campo.value).toBe('456');
    expect(form.value.monto).toBe(456);

    await escribir(campo, '');
    expect(form.value.monto).toBeNull();
  });

  it('muestra el valor que llega del formulario', async () => {
    const { fixture, q, form } = await montar();

    form.controls.monto.setValue(98000);
    await fixture.whenStable();

    expect(q<HTMLInputElement>('hk-money-input input').value).toBe('98.000');
  });
});
