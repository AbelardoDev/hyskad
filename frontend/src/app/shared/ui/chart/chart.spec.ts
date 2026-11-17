import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChartConfiguration } from 'chart.js';

import { ThemeService } from '../../../core/theme/theme.service';
import { conAlfa, CREAR_GRAFICA, HkChart, recortar, SerieGrafica, TipoGrafica } from './chart';

@Component({
  imports: [HkChart],
  template: `<hk-chart
    [tipo]="tipo()"
    formato="cop"
    etiqueta="Ingresos"
    encabezado="Día"
    [etiquetas]="['1 nov', '2 nov']"
    [series]="series()"
  />`,
})
class Anfitrion {
  readonly tipo = signal<TipoGrafica>('barras');
  readonly series = signal<SerieGrafica[]>([
    { nombre: 'Ventas', datos: [150000, 2500000], color: 'primary' },
  ]);
}

function montar() {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const configs: ChartConfiguration[] = [];
  const destruir = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: CREAR_GRAFICA,
        useValue: (_: HTMLCanvasElement, config: ChartConfiguration) => {
          configs.push(config);
          return { destroy: destruir };
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();
  return { fixture, configs, destruir, el: fixture.nativeElement as HTMLElement };
}

const raiz = document.documentElement.style;

afterEach(() => {
  raiz.removeProperty('--primary');
  document.documentElement.classList.remove('dark');
});

// CP-134
describe('HkChart', () => {
  it('toma los colores de los tokens y se vuelve a dibujar al cambiar el tema', async () => {
    raiz.setProperty('--primary', '#1d58e0');
    const { fixture, configs, destruir } = montar();
    await fixture.whenStable();

    expect(configs.at(-1)!.data.datasets[0].backgroundColor).toBe('#1d58e0');

    // El tema oscuro redefine el token
    raiz.setProperty('--primary', '#5b8cff');
    TestBed.inject(ThemeService).cambiar('dark');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(configs.at(-1)!.data.datasets[0].backgroundColor).toBe('#5b8cff');
    expect(destruir).toHaveBeenCalled();
  });

  it('la tabla oculta expone los datos en COP para lectores de pantalla', async () => {
    const { fixture, el } = montar();
    await fixture.whenStable();

    const tabla = el.querySelector('.sr-only table')!;
    expect(tabla.querySelector('caption')?.textContent?.trim()).toBe('Ingresos');
    expect(Array.from(tabla.querySelectorAll('thead th')).map((t) => t.textContent)).toEqual([
      'Día',
      'Ventas',
    ]);
    const fila = Array.from(tabla.querySelectorAll('tbody tr')[1].children).map((c) =>
      c.textContent?.replace(/\s/g, ' '),
    );
    expect(fila).toEqual(['2 nov', '$ 2.500.000']);
    expect(el.querySelector('canvas')?.getAttribute('aria-label')).toBe('Ingresos');
  });

  it('la dona usa un color por sector y no dibuja ejes', async () => {
    raiz.setProperty('--primary', '#1d58e0');
    const { fixture, configs } = montar();
    fixture.componentInstance.tipo.set('dona');
    fixture.componentInstance.series.set([
      { nombre: 'Órdenes', datos: [3, 2], color: ['primary', 'primary'] },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const config = configs.at(-1)!;
    expect(config.type).toBe('doughnut');
    expect(config.data.datasets[0].backgroundColor).toEqual(['#1d58e0', '#1d58e0']);
    expect(config.options?.scales).toEqual({});
    // La dona conserva la leyenda por sector de Chart.js
    expect(config.options?.plugins?.legend?.labels?.generateLabels).toBeUndefined();
  });

  it('una serie de línea con un solo dato muestra su punto', async () => {
    const { fixture, configs } = montar();
    fixture.componentInstance.tipo.set('area');
    fixture.componentInstance.series.set([{ nombre: 'Ventas', datos: [119000] }]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(configs.at(-1)!.data.datasets[0]).toMatchObject({ pointRadius: 4 });
  });

  it('recortar acorta las etiquetas largas del eje', () => {
    expect(recortar('Filtro')).toBe('Filtro');
    expect(recortar('E2E-EKG66669 · Casco captura 1794926593106')).toBe('E2E-EKG66669 · Casco …');
  });

  it('conAlfa convierte un hex en rgba y deja otros formatos igual', () => {
    expect(conAlfa('#1d58e0', 0.3)).toBe('rgba(29, 88, 224, 0.3)');
    expect(conAlfa('oklch(0.6 0.2 260)', 0.3)).toBe('oklch(0.6 0.2 260)');
  });
});
