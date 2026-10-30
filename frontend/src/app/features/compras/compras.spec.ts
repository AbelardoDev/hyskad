import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';

import { conFormulario, marcarErroresServidor } from '../../core/http/contexto-http';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { calcularTotales, subtotalLinea } from '../../core/utils/dinero';
import { hoyEnBogota } from '../../core/utils/formato';
import { diferenciaCosto, NuevaCompraPage } from './nueva-compra-page';

describe('calcularTotales (espejo de RN-04)', () => {
  it('suma líneas con centavos y redondea el IVA a pesos HALF_UP', () => {
    expect(subtotalLinea(2.5, 17500.33)).toBe(43750.83);
    expect(calcularTotales([{ cantidad: 2.5, precioUnitario: 17500.33 }], 0, 19)).toEqual({
      subtotal: 43750.83,
      descuento: 0,
      impuesto: 8313,
      total: 52063.83,
    });
    // 1.250 × 19 % = 237,5 → 238
    expect(calcularTotales([{ cantidad: 1, precioUnitario: 1250 }], 0, 19).impuesto).toBe(238);
  });

  it('aplica el descuento antes del IVA', () => {
    const t = calcularTotales(
      [
        { cantidad: 2, precioUnitario: 12345 },
        { cantidad: 1, precioUnitario: 50000 },
      ],
      4690,
      19,
    );
    expect(t).toEqual({ subtotal: 74690, descuento: 4690, impuesto: 13300, total: 83300 });
  });
});

describe('diferenciaCosto (aviso de más de 30 %)', () => {
  it.each([
    [13001, 10000, 0.3001],
    [6999, 10000, -0.3001],
    [13000, 10000, null],
    [7000, 10000, null],
    [5000, 0, null],
    [5000, undefined, null],
    [null, 10000, null],
  ])('costo %s con promedio %s → %s', (costo, promedio, esperado) => {
    const resultado = diferenciaCosto(costo, promedio);
    if (esperado === null) expect(resultado).toBeNull();
    else expect(resultado).toBeCloseTo(esperado, 4);
  });
});

describe('hoyEnBogota', () => {
  it('usa la fecha de Colombia aunque en UTC ya sea el día siguiente', () => {
    expect(hoyEnBogota(new Date('2026-10-31T03:00:00Z'))).toBe('2026-10-30');
    expect(hoyEnBogota(new Date('2026-10-31T06:00:00Z'))).toBe('2026-10-31');
  });
});

describe('marcarErroresServidor con índices', () => {
  it('ubica items[1].productoId dentro de un FormArray', () => {
    const fila = () => new FormGroup({ productoId: new FormControl<string | null>(null) });
    const form = new FormGroup({ items: new FormArray([fila(), fila()]) });
    marcarErroresServidor(form, [{ campo: 'items[1].productoId', code: 'PRODUCTO_INACTIVO' }]);
    expect(form.get('items.1.productoId')?.errors).toEqual({ servidor: 'PRODUCTO_INACTIVO' });
    expect(form.get('items.0.productoId')?.errors).toBeNull();
    expect(conFormulario(form)).toBeTruthy();
  });
});

describe('NuevaCompraPage', () => {
  async function montar() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const fixture = TestBed.createComponent(NuevaCompraPage);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/configuracion/iva').flush({ porcentaje: 19 });
    // Los buscadores de proveedor y producto consultan tras un timer(0)
    await new Promise((r) => setTimeout(r));
    const vacia = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 };
    http.match(() => true).forEach((r) => r.flush(vacia));
    fixture.detectChanges();
    return { fixture, http, el: fixture.nativeElement as HTMLElement };
  }

  it('valida factura, proveedor e ítems sin llamar al backend y calcula los totales en vivo', async () => {
    const { el, fixture, http } = await montar();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const errores = Array.from(el.querySelectorAll('hk-form-field [role="alert"]')).map((e) =>
      e.textContent?.trim(),
    );
    expect(errores).toEqual([
      'Este campo es obligatorio',
      'Este campo es obligatorio',
      'Este campo es obligatorio',
      'Este campo es obligatorio',
      'Este campo es obligatorio',
    ]);
    http.expectNone('/api/v1/compras');

    const cantidad = el.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    cantidad.value = '2,5';
    cantidad.dispatchEvent(new Event('input'));
    const costo = Array.from(el.querySelectorAll<HTMLInputElement>('hk-money-input input'))[0];
    costo.value = '10000';
    costo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(el.textContent).toContain('IVA 19 %');
    expect(el.textContent?.replace(/\s/g, '')).toContain('$29.750');
  });
});
