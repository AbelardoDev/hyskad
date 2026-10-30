import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FiltroActivo, HkFilterBar } from './filter-bar/filter-bar';
import { HkPagination, paginasVisibles } from './pagination/pagination';
import { HkStepper, Paso } from './stepper/stepper';
import { HkTabs, Pestana } from './tabs/tabs';

async function crear<T>(tipo: new () => T) {
  const fixture = TestBed.createComponent(tipo);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const tecla = (el: Element, key: string) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

describe('HkTabs', () => {
  @Component({
    imports: [HkTabs],
    template: `<hk-tabs [pestanas]="pestanas" [(activa)]="activa" etiqueta="Detalle"
      >Panel {{ activa() }}</hk-tabs
    >`,
  })
  class Anfitrion {
    readonly pestanas: Pestana[] = [
      { id: 'a', etiqueta: 'Resumen' },
      { id: 'b', etiqueta: 'Diagnóstico', contador: 2 },
      { id: 'c', etiqueta: 'Historial', deshabilitada: true },
      { id: 'd', etiqueta: 'Pagos' },
    ];
    readonly activa = signal('a');
  }

  it('renderiza tablist/tab/tabpanel enlazados y con roving tabindex', async () => {
    const { el } = await crear(Anfitrion);
    const tabs = Array.from(el.querySelectorAll('[role="tab"]'));
    const panel = el.querySelector('[role="tabpanel"]')!;

    expect(el.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Detalle');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id);
    expect(tabs[1].textContent).toContain('2');
  });

  it('flechas, Inicio y Fin cambian de pestaña saltando las deshabilitadas', async () => {
    const { fixture, el } = await crear(Anfitrion);
    const tab = (i: number) => el.querySelectorAll('[role="tab"]')[i];

    tecla(tab(0), 'ArrowRight');
    await fixture.whenStable();
    expect(fixture.componentInstance.activa()).toBe('b');

    tecla(tab(1), 'ArrowRight');
    await fixture.whenStable();
    expect(fixture.componentInstance.activa()).toBe('d');
    expect(document.activeElement).toBe(tab(3));

    tecla(tab(3), 'ArrowRight');
    await fixture.whenStable();
    expect(fixture.componentInstance.activa()).toBe('a');

    tecla(tab(0), 'End');
    await fixture.whenStable();
    expect(fixture.componentInstance.activa()).toBe('d');
    expect(el.querySelector('[role="tabpanel"]')?.textContent).toContain('Panel d');
  });

  it('el clic cambia la pestaña activa', async () => {
    const { fixture, el } = await crear(Anfitrion);

    (el.querySelectorAll('[role="tab"]')[1] as HTMLElement).click();
    await fixture.whenStable();

    expect(fixture.componentInstance.activa()).toBe('b');
  });
});

describe('HkStepper', () => {
  @Component({
    imports: [HkStepper],
    template: `<hk-stepper [pasos]="pasos" actual="b" [cancelado]="cancelado()" />`,
  })
  class Anfitrion {
    readonly pasos: Paso[] = [
      { id: 'a', etiqueta: 'Recibida', detalle: '02/10' },
      { id: 'b', etiqueta: 'En diagnóstico' },
      { id: 'c', etiqueta: 'En reparación' },
    ];
    readonly cancelado = signal(false);
  }

  it('marca completados, el paso actual (aria-current) y pendientes', async () => {
    const { el } = await crear(Anfitrion);
    const pasos = Array.from(el.querySelectorAll('li'));

    expect(pasos[0].textContent).toContain('(completado)');
    expect(pasos[0].textContent).toContain('02/10');
    expect(pasos[1].getAttribute('aria-current')).toBe('step');
    expect(pasos[1].textContent).toContain('(paso actual)');
    expect(pasos[2].textContent).toContain('(pendiente)');
  });

  it('en una orden cancelada el paso actual se marca como cancelado', async () => {
    const { fixture, el } = await crear(Anfitrion);

    fixture.componentInstance.cancelado.set(true);
    await fixture.whenStable();

    const actual = el.querySelectorAll('li')[1];
    expect(actual.textContent).toContain('(cancelado)');
    expect(actual.querySelector('.border-danger')).not.toBeNull();
  });
});

describe('HkPagination', () => {
  it('calcula páginas visibles con elipsis', () => {
    expect(paginasVisibles(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(paginasVisibles(0, 20)).toEqual([0, 1, 2, 3, 4, null, 19]);
    expect(paginasVisibles(10, 20)).toEqual([0, null, 9, 10, 11, null, 19]);
    expect(paginasVisibles(19, 20)).toEqual([0, null, 15, 16, 17, 18, 19]);
  });

  @Component({
    imports: [HkPagination],
    template: `<hk-pagination
      [pagina]="pagina()"
      [tamano]="20"
      [total]="45"
      (paginaCambio)="pagina.set($event)"
    />`,
  })
  class Anfitrion {
    readonly pagina = signal(0);
  }

  it('muestra el rango, marca la página actual y navega', async () => {
    const { fixture, el } = await crear(Anfitrion);
    const botones = () => Array.from(el.querySelectorAll<HTMLButtonElement>('nav button'));

    expect(el.textContent).toContain('1–20 de 45');
    expect(botones()[0].disabled).toBe(true);
    expect(el.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('1');

    botones().at(-1)!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.pagina()).toBe(1);
    expect(el.textContent).toContain('21–40 de 45');

    el.querySelector<HTMLButtonElement>('[aria-label="Página 3"]')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.pagina()).toBe(2);
    expect(botones().at(-1)!.disabled).toBe(true);
  });
});

describe('HkFilterBar', () => {
  @Component({
    imports: [HkFilterBar],
    template: `
      <hk-filter-bar
        [filtros]="filtros()"
        (busquedaCambio)="busquedas.push($event)"
        (quitar)="quitados.push($event)"
        (limpiar)="limpiezas = limpiezas + 1"
      />
    `,
  })
  class Anfitrion {
    readonly filtros = signal<FiltroActivo[]>([{ clave: 'estado', etiqueta: 'Estado: Recibida' }]);
    readonly busquedas: string[] = [];
    readonly quitados: string[] = [];
    limpiezas = 0;
  }

  it('emite la búsqueda tras 300 ms sin escribir', async () => {
    const { fixture, el } = await crear(Anfitrion);
    vi.useFakeTimers();
    try {
      const input = el.querySelector('input')!;

      expect(input.getAttribute('aria-label')).toBe('Buscar…');
      input.value = 'ab';
      input.dispatchEvent(new Event('input'));
      input.value = 'abc ';
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(299);
      expect(fixture.componentInstance.busquedas).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(fixture.componentInstance.busquedas).toEqual(['abc']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cada chip se puede quitar y hay un botón para limpiar todo', async () => {
    const { fixture, el } = await crear(Anfitrion);
    const quitar = el.querySelector<HTMLButtonElement>(
      '[aria-label="Quitar filtro Estado: Recibida"]',
    )!;

    quitar.click();
    expect(fixture.componentInstance.quitados).toEqual(['estado']);

    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Limpiar filtros'))!
      .click();
    expect(fixture.componentInstance.limpiezas).toBe(1);
  });
});
