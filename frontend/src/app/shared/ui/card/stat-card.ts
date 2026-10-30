import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { LanguageService } from '../../../core/i18n/language.service';
import { nuevoId } from '../forms/campo';

const ANCHO = 120;
const ALTO = 36;

/** Puntos de una línea SVG que ocupa todo el ancho/alto disponible. */
export function puntosSparkline(valores: readonly number[], ancho = ANCHO, alto = ALTO): string {
  if (valores.length < 2) return '';
  const min = Math.min(...valores);
  const rango = Math.max(...valores) - min || 1;
  const paso = ancho / (valores.length - 1);
  return valores
    .map(
      (v, i) =>
        `${(i * paso).toFixed(1)},${(alto - 2 - ((v - min) / rango) * (alto - 4)).toFixed(1)}`,
    )
    .join(' ');
}

/**
 * Indicador (KPI): ícono, valor grande, variación respecto al periodo anterior y sparkline opcional.
 * El sparkline es un SVG propio; las gráficas completas usan hk-chart (F11).
 */
@Component({
  selector: 'hk-stat-card',
  imports: [LucideDynamicIcon, TranslocoPipe],
  template: `
    <div class="flex items-start justify-between gap-3">
      <p class="text-xs font-medium text-muted">{{ titulo() }}</p>
      @if (icono()) {
        <span
          class="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-ink"
        >
          <svg [lucideIcon]="icono()!" class="size-4.5" aria-hidden="true" />
        </span>
      }
    </div>
    <p class="mt-2 font-display text-3xl font-bold tracking-tight text-fg tabular">{{ valor() }}</p>
    <div class="mt-3 flex items-end justify-between gap-3">
      @if (variacion() !== undefined) {
        <p class="flex min-w-0 flex-wrap items-center gap-x-1 text-xs">
          <span
            class="inline-flex items-center gap-1 font-medium whitespace-nowrap"
            [class]="claseVariacion()"
          >
            <svg
              [lucideIcon]="variacion()! >= 0 ? 'trending-up' : 'trending-down'"
              class="size-3.5"
              aria-hidden="true"
            />
            <span class="tabular">{{ variacionTexto() }}</span>
          </span>
          <span class="text-muted">{{ 'ui.stat.vs_anterior' | transloco }}</span>
        </p>
      } @else {
        <span></span>
      }
      @if (puntos()) {
        <svg
          class="h-9 w-24 shrink-0 text-primary"
          [attr.viewBox]="'0 0 ' + ancho + ' ' + alto"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient [attr.id]="idDegradado" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="currentColor" stop-opacity="0.28" />
              <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
            </linearGradient>
          </defs>
          <polygon [attr.points]="area()" [attr.fill]="'url(#' + idDegradado + ')'" />
          <polyline
            [attr.points]="puntos()"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        </svg>
      }
    </div>
  `,
  host: { class: 'block p-4 md:p-5 hk-panel' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkStatCard {
  private readonly idioma = inject(LanguageService);

  readonly titulo = input.required<string>();
  /** Valor ya formateado (`'$ 1.250.000'`, `'12'`). */
  readonly valor = input.required<string>();
  readonly icono = input<string>();
  /** Variación porcentual frente al periodo anterior (12.5 = +12,5 %). */
  readonly variacion = input<number>();
  /** Si subir es malo (p. ej. órdenes pendientes), el color se invierte. */
  readonly subirEsMalo = input(false);
  readonly tendencia = input<readonly number[]>([]);

  protected readonly ancho = ANCHO;
  protected readonly alto = ALTO;
  protected readonly idDegradado = nuevoId('hk-sparkline');
  protected readonly puntos = computed(() => puntosSparkline(this.tendencia()));
  protected readonly area = computed(() =>
    this.puntos() ? `0,${ALTO} ${this.puntos()} ${ANCHO},${ALTO}` : '',
  );

  protected readonly variacionTexto = computed(() => {
    const v = this.variacion() ?? 0;
    return `${v > 0 ? '+' : ''}${v.toLocaleString(this.idioma.locale(), { maximumFractionDigits: 1 })} %`;
  });

  protected readonly claseVariacion = computed(() => {
    const v = this.variacion() ?? 0;
    if (v === 0) return 'text-muted';
    return v > 0 !== this.subirEsMalo() ? 'text-success-ink' : 'text-danger-ink';
  });
}
