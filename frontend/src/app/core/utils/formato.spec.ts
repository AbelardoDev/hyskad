import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { LanguageService } from '../i18n/language.service';
import { aNumero, formatoCop, formatoFecha, formatoMiles, tiempoRelativo } from './formato';
import { CopPipe, TiempoRelativoPipe } from './formato.pipes';

/** Normaliza los espacios duros que usa Intl para comparar textos. */
const plano = (texto: string) => texto.replace(/\s/g, ' ');

describe('formatoCop', () => {
  it('formatea pesos sin decimales con separador de miles de la locale', () => {
    expect(plano(formatoCop(1250000, 'es-CO'))).toBe('$ 1.250.000');
    expect(plano(formatoCop(1250000, 'en-US'))).toBe('$1,250,000');
  });

  it('redondea HALF_UP a 0 decimales', () => {
    expect(plano(formatoCop(99999.5, 'es-CO'))).toBe('$ 100.000');
    expect(plano(formatoCop(99999.49, 'es-CO'))).toBe('$ 99.999');
    expect(plano(formatoCop('2500.50', 'es-CO'))).toBe('$ 2.501');
  });

  it('acepta montos como texto (BigDecimal) y devuelve vacío si no hay valor válido', () => {
    expect(plano(formatoCop('15000.00', 'es-CO'))).toBe('$ 15.000');
    expect(formatoCop(null, 'es-CO')).toBe('');
    expect(formatoCop('abc', 'es-CO')).toBe('');
    expect(plano(formatoCop(-5000, 'es-CO'))).toBe('-$ 5.000');
  });

  it('aNumero y formatoMiles', () => {
    expect(aNumero('')).toBeNull();
    expect(aNumero(undefined)).toBeNull();
    expect(aNumero('12.5')).toBe(12.5);
    expect(formatoMiles(1234567, 'es-CO')).toBe('1.234.567');
  });
});

describe('tiempoRelativo', () => {
  const ahora = Date.UTC(2026, 9, 29, 12, 0, 0);

  it('describe el tiempo transcurrido en la unidad más grande que aplique', () => {
    expect(tiempoRelativo(ahora - 5 * 60_000, 'es-CO', ahora)).toBe('hace 5 min');
    expect(tiempoRelativo(ahora - 3 * 3600_000, 'es-CO', ahora)).toBe('hace 3 h');
    expect(tiempoRelativo(ahora - 24 * 3600_000, 'es-CO', ahora)).toBe('ayer');
    expect(tiempoRelativo(ahora - 10_000, 'es-CO', ahora)).toBe('ahora');
    expect(tiempoRelativo(ahora - 5 * 60_000, 'en-US', ahora)).toBe('5 min. ago');
  });

  it('acepta fechas ISO y devuelve vacío si no son válidas', () => {
    expect(tiempoRelativo(new Date(ahora - 120_000).toISOString(), 'es-CO', ahora)).toBe(
      'hace 2 min',
    );
    expect(tiempoRelativo('no-es-fecha', 'es-CO', ahora)).toBe('');
  });
});

describe('formatoFecha', () => {
  it('usa el orden día/mes en es-CO y mes/día en en-US', () => {
    const fecha = new Date(2026, 9, 29, 15, 30);
    expect(formatoFecha(fecha, 'es-CO', 'corta')).toBe('29/10/26');
    expect(formatoFecha(fecha, 'en-US', 'corta')).toBe('10/29/26');
    expect(formatoFecha('x', 'es-CO')).toBe('');
  });
});

describe('pipes de formato', () => {
  @Component({
    imports: [CopPipe, TiempoRelativoPipe],
    template: `<span>{{ monto() | cop }}</span
      ><i>{{ fecha | tiempoRelativo }}</i>`,
  })
  class Anfitrion {
    readonly monto = signal<number | null>(1500);
    readonly fecha = new Date(Date.now() - 5 * 60_000);
  }

  it('siguen al idioma activo sin recargar', async () => {
    localStorage.clear();
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(plano(el.querySelector('span')!.textContent!)).toBe('$ 1.500');
    expect(el.querySelector('i')!.textContent).toBe('hace 5 min');

    TestBed.inject(LanguageService).cambiar('en');
    fixture.componentInstance.monto.set(2500);
    await fixture.whenStable();

    expect(plano(el.querySelector('span')!.textContent!)).toBe('$2,500');
    expect(el.querySelector('i')!.textContent).toBe('5 min. ago');
  });
});
