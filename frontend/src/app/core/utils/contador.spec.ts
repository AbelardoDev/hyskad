import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { contadorAnimado, DURACION_CONTADOR_MS } from './contador';

describe('contadorAnimado', () => {
  let cuadros: ((t: number) => void)[];

  beforeEach(() => {
    cuadros = [];
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => cuadros.push(cb));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });

  afterEach(() => vi.unstubAllGlobals());

  /** Ejecuta los cuadros pendientes en el instante `t` y deja correr los efectos. */
  function cuadro(t: number) {
    const pendientes = cuadros;
    cuadros = [];
    pendientes.forEach((cb) => cb(t));
    TestBed.tick();
  }

  it('llega al valor final al terminar la animación y no se reinicia en cada cuadro', () => {
    const fuente = signal<number | null>(null);
    const valor = TestBed.runInInjectionContext(() => contadorAnimado(fuente));
    TestBed.tick();
    expect(valor()).toBeNull();

    fuente.set(1000);
    TestBed.tick();
    cuadro(0);
    cuadro(DURACION_CONTADOR_MS / 2);
    expect(valor()).toBeGreaterThan(500);
    expect(valor()).toBeLessThan(1000);
    cuadro(DURACION_CONTADOR_MS);

    expect(valor()).toBe(1000);
    expect(cuadros).toHaveLength(0);
  });

  it('con movimiento reducido salta directo al valor', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const fuente = signal<number | null>(7);
    const valor = TestBed.runInInjectionContext(() => contadorAnimado(fuente));
    TestBed.tick();

    expect(valor()).toBe(7);
  });
});
