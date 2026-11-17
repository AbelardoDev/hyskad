import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  InjectionToken,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

import { LanguageService } from '../../../core/i18n/language.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { formatoCantidad, formatoCop } from '../../../core/utils/formato';

// Solo los controladores y elementos que usa el kit (el bundle no carga el resto de Chart.js).
Chart.register(
  LineController,
  BarController,
  DoughnutController,
  LineElement,
  PointElement,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
);

export type TipoGrafica = 'linea' | 'area' | 'barras' | 'dona';
/** Tokens de color de `styles.css` que puede usar una serie (DESIGN-SYSTEM §1.2 y §1.3). */
export type ColorGrafica =
  'primary' | 'accent-tone' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'border-strong';

export interface SerieGrafica {
  nombre: string;
  datos: readonly number[];
  /** Un color para la serie o, en la dona, uno por sector. */
  color?: ColorGrafica | readonly ColorGrafica[];
}

export interface ColoresTema {
  texto: string;
  rejilla: string;
  superficie: string;
  token: (nombre: ColorGrafica) => string;
}

/** Crea la gráfica; en las pruebas se reemplaza (jsdom no dibuja en `canvas`). */
export const CREAR_GRAFICA = new InjectionToken<
  (canvas: HTMLCanvasElement, config: ChartConfiguration) => { destroy(): void }
>('CREAR_GRAFICA', {
  providedIn: 'root',
  factory: () => (canvas, config) => new Chart(canvas, config),
});

/** Lee los colores de los tokens CSS vigentes (cambian con la clase `.dark`). */
export function coloresTema(documento: Document): ColoresTema {
  const raiz = documento.documentElement;
  const estilos = documento.defaultView?.getComputedStyle(raiz);
  const leer = (variable: string, porDefecto: string) =>
    (estilos?.getPropertyValue(variable) || raiz.style.getPropertyValue(variable)).trim() ||
    porDefecto;
  return {
    texto: leer('--muted', '#5b6b8a'),
    rejilla: leer('--border', '#e2e8f3'),
    superficie: leer('--surface', '#ffffff'),
    token: (nombre) => leer(`--${nombre}`, '#1d58e0'),
  };
}

/** Color con transparencia: `#1d58e0` + 0.3 → `rgba(29, 88, 224, 0.3)`. */
export function conAlfa(color: string, alfa: number): string {
  const hex = color.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

const COLORES_POR_DEFECTO: readonly ColorGrafica[] = [
  'primary',
  'accent-tone',
  'success',
  'warning',
];

/**
 * Gráfica del kit (Chart.js): línea, área con degradado, barras o dona. Toma los colores de los
 * tokens del tema y se vuelve a dibujar al cambiar el tema, el idioma o los datos. El tooltip y los
 * ejes formatean en COP o como cantidad. Para lectores de pantalla, el lienzo tiene una etiqueta y
 * los datos van en una tabla oculta visualmente.
 */
@Component({
  selector: 'hk-chart',
  template: `
    <div class="relative" [style.height]="alto()">
      <canvas #lienzo role="img" [attr.aria-label]="etiqueta()"></canvas>
    </div>
    <table class="sr-only">
      <caption>
        {{
          etiqueta()
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ encabezado() }}</th>
          @for (s of series(); track s.nombre) {
            <th scope="col">{{ s.nombre }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (fila of filasTabla(); track $index) {
          <tr>
            <th scope="row">{{ fila.etiqueta }}</th>
            @for (v of fila.valores; track $index) {
              <td>{{ v }}</td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkChart {
  private readonly tema = inject(ThemeService);
  private readonly idioma = inject(LanguageService);
  private readonly documento = inject(DOCUMENT);
  private readonly crear = inject(CREAR_GRAFICA);

  readonly tipo = input<TipoGrafica>('linea');
  readonly etiquetas = input.required<readonly string[]>();
  readonly series = input.required<readonly SerieGrafica[]>();
  /** Texto accesible de la gráfica y título de la tabla oculta. */
  readonly etiqueta = input.required<string>();
  /** Encabezado de la columna de etiquetas en la tabla oculta (p. ej. "Día"). */
  readonly encabezado = input('');
  readonly formato = input<'cop' | 'cantidad'>('cantidad');
  readonly alto = input('16rem');
  readonly leyenda = input(false);

  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private grafica: { destroy(): void } | null = null;

  protected readonly filasTabla = computed(() => {
    const locale = this.idioma.locale();
    return this.etiquetas().map((etiqueta, i) => ({
      etiqueta,
      valores: this.series().map((s) => this.formatear(s.datos[i] ?? 0, locale)),
    }));
  });

  constructor() {
    afterRenderEffect(() => {
      // Dependencias: tema, idioma y datos
      this.tema.oscuro();
      const locale = this.idioma.locale();
      const config = this.configuracion(locale);
      untracked(() => this.dibujar(config));
    });
    inject(DestroyRef).onDestroy(() => this.grafica?.destroy());
  }

  private dibujar(config: ChartConfiguration): void {
    this.grafica?.destroy();
    this.grafica = this.crear(this.lienzo().nativeElement, config);
  }

  /** Configuración de Chart.js con los colores del tema vigente. */
  configuracion(locale: string): ChartConfiguration {
    const colores = coloresTema(this.documento);
    const tipo = this.tipo();
    const series = this.series();
    const formatear = (v: number) => this.formatear(v, locale);
    const colorDe = (s: SerieGrafica, i: number): ColorGrafica | readonly ColorGrafica[] =>
      s.color ?? COLORES_POR_DEFECTO[i % COLORES_POR_DEFECTO.length];
    const unColor = (c: ColorGrafica | readonly ColorGrafica[]) =>
      colores.token(typeof c === 'string' ? c : (c[0] ?? 'primary'));

    const datasets = series.map((s, i) => {
      const color = colorDe(s, i);
      if (tipo === 'dona') {
        const lista = typeof color === 'string' ? [color] : color;
        return {
          label: s.nombre,
          data: [...s.datos],
          backgroundColor: s.datos.map((_, j) => colores.token(lista[j % lista.length])),
          borderColor: colores.superficie,
          borderWidth: 2,
        };
      }
      const base = unColor(color);
      return {
        label: s.nombre,
        data: [...s.datos],
        borderColor: base,
        backgroundColor:
          tipo === 'area' ? degradado(base) : tipo === 'barras' ? base : conAlfa(base, 0.2),
        fill: tipo === 'area',
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
        borderRadius: tipo === 'barras' ? 6 : 0,
        maxBarThickness: 32,
      };
    });

    const ejes =
      tipo === 'dona'
        ? {}
        : {
            x: {
              grid: { display: false },
              ticks: { color: colores.texto, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
              border: { color: colores.rejilla },
            },
            y: {
              beginAtZero: true,
              grid: { color: colores.rejilla },
              border: { display: false },
              ticks: {
                color: colores.texto,
                callback: (v: string | number) => formatear(Number(v)),
              },
            },
          };

    return {
      type: tipo === 'dona' ? 'doughnut' : tipo === 'barras' ? 'bar' : 'line',
      data: { labels: [...this.etiquetas()], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: 'index', intersect: false },
        cutout: tipo === 'dona' ? '68%' : undefined,
        scales: ejes,
        plugins: {
          legend: {
            display: this.leyenda() || tipo === 'dona',
            position: 'bottom',
            labels: { color: colores.texto, usePointStyle: true, boxWidth: 8 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label ?? ''}: ${formatear(Number(ctx.parsed.y ?? ctx.parsed))}`,
            },
          },
        },
      },
    } as ChartConfiguration;
  }

  private formatear(valor: number, locale: string): string {
    return this.formato() === 'cop' ? formatoCop(valor, locale) : formatoCantidad(valor, locale);
  }
}

/** Relleno del área: el color de la serie que se desvanece hacia abajo. */
function degradado(color: string) {
  return (ctx: { chart: Chart }) => {
    const { ctx: lienzo, chartArea } = ctx.chart;
    if (!chartArea) return conAlfa(color, 0.2);
    const g = lienzo.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    g.addColorStop(0, conAlfa(color, 0.35));
    g.addColorStop(1, conAlfa(color, 0));
    return g;
  };
}
