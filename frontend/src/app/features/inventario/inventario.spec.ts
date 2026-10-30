import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { errorInterceptor } from '../../core/http/error.interceptor';
import { formatoCantidad } from '../../core/utils/formato';
import { aCantidad, cantidad } from '../../core/utils/validadores';
import { stockResultante } from './ajuste-drawer';
import { inicioDelDia } from './movimientos-page';
import { ProductoFormDrawer } from './producto-form-drawer';

describe('cantidades de inventario', () => {
  it.each([
    ['12', 12],
    ['12,5', 12.5],
    ['0.25', 0.25],
    [' 3 ', 3],
    ['1.005', null],
    ['-1', null],
    ['abc', null],
  ])('"%s" → %s', (texto, esperado) => {
    expect(aCantidad(texto)).toBe(esperado);
  });

  it('el validador exige máximo 2 decimales y, si se pide, mayor que cero', () => {
    const positiva = cantidad({ positiva: true });
    expect(positiva(new FormControl('2,5'))).toBeNull();
    expect(positiva(new FormControl('0'))).toEqual({ cantidadPositiva: true });
    expect(positiva(new FormControl('1,234'))).toEqual({ cantidadInvalida: true });
    expect(positiva(new FormControl(''))).toBeNull();
    expect(cantidad({ positiva: false })(new FormControl('0'))).toBeNull();
  });

  it('se muestran con separador de miles y hasta 2 decimales', () => {
    expect(formatoCantidad(12345.5, 'es-CO')).toBe('12.345,5');
    expect(formatoCantidad('2.50', 'en-US')).toBe('2.5');
  });
});

describe('stockResultante (vista previa del ajuste)', () => {
  const producto = { stockActual: 10, stockDisponible: 7 };

  it('una entrada suma y una salida resta, sin errores de coma flotante', () => {
    expect(stockResultante(producto, 'ENTRADA', 2.5)).toEqual({ resultante: 12.5, excede: false });
    expect(stockResultante({ stockActual: 0.3, stockDisponible: 0.3 }, 'SALIDA', 0.1)).toEqual({
      resultante: 0.2,
      excede: false,
    });
  });

  it('una salida mayor que el disponible (RN-13: no tocar lo reservado) excede', () => {
    expect(stockResultante(producto, 'SALIDA', 8)).toEqual({ resultante: 2, excede: true });
  });

  it('sin cantidad válida no hay vista previa', () => {
    expect(stockResultante(producto, 'SALIDA', null)).toBeNull();
    expect(stockResultante(producto, 'SALIDA', 0)).toBeNull();
  });
});

describe('inicioDelDia (filtro de fechas de movimientos)', () => {
  it('toma la medianoche de Bogotá en UTC y puede sumar días', () => {
    expect(inicioDelDia('2026-10-30')).toBe('2026-10-30T05:00:00.000Z');
    expect(inicioDelDia('2026-12-31', 1)).toBe('2027-01-01T05:00:00.000Z');
  });
});

describe('ProductoFormDrawer', () => {
  function montar() {
    const cerrar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: DialogRef, useValue: { close: cerrar } },
        { provide: DIALOG_DATA, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(ProductoFormDrawer);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('/api/v1/categorias?activo=true')
      .flush([{ id: 4, nombre: 'Filtros', descripcion: null, activo: true }]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const campo = (etiqueta: string) => {
      const label = Array.from(el.querySelectorAll('label')).find(
        (l) =>
          l.textContent
            ?.trim()
            .replace(/\s*\*$/, '')
            .replace(/\s*\(opcional\)$/, '') === etiqueta,
      )!;
      return el.querySelector<HTMLInputElement | HTMLSelectElement>(
        `#${label.getAttribute('for')}`,
      )!;
    };
    const escribir = (etiqueta: string, valor: string) => {
      const control = campo(etiqueta);
      control.value = valor;
      control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input'));
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
    return { el, http, cerrar, escribir, enviar, errores, fixture };
  }

  it('valida código, precio y mínimo, y envía el código en mayúsculas sin stock', async () => {
    const { http, cerrar, escribir, enviar, errores } = montar();
    escribir('Código', 'mal código');
    escribir('Stock mínimo', '1,234');
    await enviar();
    expect(errores()).toEqual([
      'El formato no es válido',
      'Este campo es obligatorio',
      'Este campo es obligatorio',
      'Este campo es obligatorio',
      'Escribe una cantidad con máximo 2 decimales',
    ]);
    http.expectNone('/api/v1/productos');

    escribir('Código', ' fil-ace-ybr ');
    escribir('Nombre', 'Filtro de aceite YBR');
    escribir('Categoría', '4');
    escribir('Precio de venta', '16000');
    escribir('Stock mínimo', '2,5');
    await enviar();

    const req = http.expectOne('/api/v1/productos');
    expect(req.request.body).toEqual({
      codigo: 'FIL-ACE-YBR',
      nombre: 'Filtro de aceite YBR',
      descripcion: null,
      marca: null,
      categoriaId: 4,
      unidad: 'UNIDAD',
      precioVenta: 16000,
      stockMinimo: 2.5,
    });
    req.flush({ id: 1 });
    expect(cerrar).toHaveBeenCalled();
  });

  it('crea una categoría sin salir del formulario y la deja elegida', async () => {
    const { el, http, fixture } = montar();
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Nueva categoría'))!
      .click();
    fixture.detectChanges();
    const input = el.querySelector<HTMLInputElement>('input[maxlength="80"]')!;
    input.value = 'Frenos';
    input.dispatchEvent(new Event('input'));
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Crear')!
      .click();

    http
      .expectOne('/api/v1/categorias')
      .flush({ id: 9, nombre: 'Frenos', descripcion: null, activo: true });
    fixture.detectChanges();
    await fixture.whenStable();

    const select = Array.from(el.querySelectorAll('select')).find((s) =>
      Array.from(s.options).some((o) => o.value === '9'),
    )!;
    expect(select.value).toBe('9');
  });
});
