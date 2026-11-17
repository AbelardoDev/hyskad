import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { AuthService } from '../../core/auth/auth.service';
import { erroresManejados } from '../../core/http/contexto-http';
import { LanguageService } from '../../core/i18n/language.service';
import { contadorAnimado } from '../../core/utils/contador';
import {
  desdeParaPeriodo,
  formatoCantidad,
  formatoCop,
  hoyEnBogota,
} from '../../core/utils/formato';
import { CantidadPipe, TiempoRelativoPipe } from '../../core/utils/formato.pipes';
import { EstadoOrden, HkStatusBadge } from '../../shared/ui/badge/status-badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { HkStatCard } from '../../shared/ui/card/stat-card';
import { ColorGrafica, HkChart, SerieGrafica } from '../../shared/ui/chart/chart';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkPlaca } from '../../shared/ui/placa/placa';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { DashboardApiService } from './dashboard-api.service';

/** Periodos del selector, en días hasta hoy. */
export const PERIODOS = [7, 30, 90] as const;
type Periodo = (typeof PERIODOS)[number];

/** Color de cada estado en la dona (DESIGN-SYSTEM §1.3). */
export const COLOR_ESTADO: Record<EstadoOrden, ColorGrafica> = {
  RECIBIDA: 'muted',
  EN_DIAGNOSTICO: 'info',
  PENDIENTE_APROBACION: 'warning',
  EN_REPARACION: 'primary',
  FINALIZADA: 'accent-tone',
  ENTREGADA: 'success',
  CANCELADA: 'danger',
};
const ORDEN_ESTADOS: readonly EstadoOrden[] = [
  'RECIBIDA',
  'EN_DIAGNOSTICO',
  'PENDIENTE_APROBACION',
  'EN_REPARACION',
  'FINALIZADA',
  'ENTREGADA',
  'CANCELADA',
];

/**
 * Panel de control (RF34, DESIGN-SYSTEM §7): saludo, KPIs con contadores animados, ingresos de los
 * últimos días (área con degradado), órdenes por estado (dona), top de servicios y repuestos,
 * últimas órdenes y stock crítico. El mecánico ve su propia vista. Cada bloque aparece solo si el
 * backend lo envía (según permisos).
 */
@Component({
  selector: 'hk-dashboard-page',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslocoPipe,
    CantidadPipe,
    TiempoRelativoPipe,
    HkButton,
    HkCard,
    HkChart,
    HkEmptyState,
    HkPlaca,
    HkSkeleton,
    HkStatCard,
    HkStatusBadge,
  ],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-2xl font-bold tracking-tight text-fg md:text-3xl">
          {{ 'dashboard.saludo' | transloco: { nombre: primerNombre() } }}
        </h1>
        <p class="mt-1 text-sm text-muted first-letter:uppercase">{{ fechaLarga() }}</p>
      </div>
      @if (datos()?.vista !== 'MECANICO') {
        <div
          class="inline-flex rounded-xl border border-border bg-surface p-1"
          role="group"
          [attr.aria-label]="'dashboard.periodo' | transloco"
        >
          @for (p of periodos; track p) {
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-sm font-medium hk-foco"
              [class]="
                periodo() === p ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-surface-2'
              "
              [attr.aria-pressed]="periodo() === p"
              (click)="periodo.set(p)"
            >
              {{ 'dashboard.ultimos_dias' | transloco: { n: p } }}
            </button>
          }
        </div>
      }
    </header>

    @if (panel.error()) {
      <hk-empty-state
        icono="circle-alert"
        [titulo]="'dashboard.error' | transloco"
        [texto]="'comun.error_texto' | transloco"
      >
        <button hk-button variante="secondary" icono="rotate-ccw" (click)="panel.reload()">
          {{ 'comun.reintentar' | transloco }}
        </button>
      </hk-empty-state>
    } @else if (!panel.hasValue()) {
      <div class="space-y-6" aria-busy="true">
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          @for (i of [1, 2, 3]; track i) {
            <hk-skeleton variante="rectangulo" alto="7.5rem" />
          }
        </div>
        <div class="grid gap-6 lg:grid-cols-3">
          <hk-skeleton class="lg:col-span-2" variante="rectangulo" alto="20rem" />
          <hk-skeleton variante="rectangulo" alto="20rem" />
        </div>
      </div>
    } @else if (datos(); as d) {
      <section
        class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        [attr.aria-label]="'dashboard.indicadores' | transloco"
      >
        @for (k of kpis(); track k.clave) {
          <hk-stat-card
            [titulo]="'dashboard.kpis.' + k.clave | transloco"
            [valor]="k.texto"
            [icono]="k.icono"
            [detalle]="k.detalle"
          />
        }
      </section>

      @if (d.vista === 'GENERAL' && d.ingresosDiarios.length > 0) {
        <div class="mt-6 grid gap-6 lg:grid-cols-3">
          <hk-card class="lg:col-span-2" [titulo]="'dashboard.ingresos' | transloco">
            @if (sinIngresos()) {
              <hk-empty-state
                compacto
                icono="chart-column"
                [titulo]="'dashboard.sin_ingresos' | transloco"
              />
            } @else {
              <hk-chart
                tipo="area"
                formato="cop"
                alto="18rem"
                [leyenda]="true"
                [etiquetas]="diasCortos()"
                [series]="seriesIngresos()"
                [etiqueta]="'dashboard.ingresos' | transloco"
                [encabezado]="'dashboard.dia' | transloco"
              />
            }
          </hk-card>
          <hk-card [titulo]="'dashboard.por_estado' | transloco">
            <ng-container [ngTemplateOutlet]="dona" />
          </hk-card>
        </div>
      } @else if (totalOrdenes() > 0) {
        <div class="mt-6 grid gap-6 lg:grid-cols-3">
          <hk-card class="lg:col-span-1" [titulo]="'dashboard.por_estado' | transloco">
            <ng-container [ngTemplateOutlet]="dona" />
          </hk-card>
          <hk-card class="lg:col-span-2" [titulo]="'dashboard.ultimas' | transloco">
            <ng-container [ngTemplateOutlet]="ultimas" />
          </hk-card>
        </div>
      }

      @if (d.vista === 'GENERAL') {
        @if (d.topServicios.length > 0 || d.topRepuestos.length > 0) {
          <div class="mt-6 grid gap-6 lg:grid-cols-2">
            @if (d.topServicios.length > 0) {
              <hk-card
                [class]="d.topRepuestos.length > 0 ? '' : 'lg:col-span-2'"
                [titulo]="'dashboard.top_servicios' | transloco"
              >
                <hk-chart
                  tipo="barras"
                  alto="14rem"
                  [etiquetas]="nombres(d.topServicios)"
                  [series]="[
                    {
                      nombre: textoCantidad(),
                      datos: cantidades(d.topServicios),
                      color: 'primary',
                    },
                  ]"
                  [etiqueta]="'dashboard.top_servicios' | transloco"
                />
              </hk-card>
            }
            @if (d.topRepuestos.length > 0) {
              <hk-card
                [class]="d.topServicios.length > 0 ? '' : 'lg:col-span-2'"
                [titulo]="'dashboard.top_repuestos' | transloco"
              >
                <hk-chart
                  tipo="barras"
                  alto="14rem"
                  [etiquetas]="nombres(d.topRepuestos)"
                  [series]="[
                    {
                      nombre: textoCantidad(),
                      datos: cantidades(d.topRepuestos),
                      color: 'accent-tone',
                    },
                  ]"
                  [etiqueta]="'dashboard.top_repuestos' | transloco"
                />
              </hk-card>
            }
          </div>
        }
        <div class="mt-6 grid items-start gap-6 lg:grid-cols-2">
          @if (d.ultimasOrdenes.length > 0) {
            <hk-card [titulo]="'dashboard.ultimas' | transloco">
              <ng-container [ngTemplateOutlet]="ultimas" />
            </hk-card>
          }
          @if (d.kpis.productosStockBajo !== null) {
            <hk-card [titulo]="'dashboard.stock_critico' | transloco">
              @if (d.stockCritico.length === 0) {
                <hk-empty-state
                  compacto
                  icono="package-check"
                  [titulo]="'dashboard.sin_stock_critico' | transloco"
                />
              } @else {
                <ul class="divide-y divide-border">
                  @for (p of d.stockCritico; track p.id) {
                    <li>
                      <a
                        class="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hk-foco hover:bg-surface-2"
                        [routerLink]="['/inventario/productos', p.id]"
                      >
                        <span class="min-w-0">
                          <span class="block truncate text-sm font-medium text-fg">{{
                            p.nombre
                          }}</span>
                          <span class="block text-xs text-muted">{{ p.codigo }}</span>
                        </span>
                        <span class="shrink-0 text-end text-sm tabular">
                          <span
                            class="font-semibold"
                            [class]="p.disponible <= 0 ? 'text-danger-ink' : 'text-warning-ink'"
                            >{{ p.disponible | cantidad }}</span
                          >
                          <span class="text-muted">
                            /
                            {{ 'dashboard.minimo' | transloco: { n: (p.minimo | cantidad) } }}</span
                          >
                        </span>
                      </a>
                    </li>
                  }
                </ul>
              }
            </hk-card>
          }
        </div>
      } @else {
        <div class="mt-6">
          <a hk-button icono="clipboard-check" routerLink="/ordenes/mias">
            {{ 'dashboard.ir_mis_ordenes' | transloco }}
          </a>
        </div>
      }

      <ng-template #dona>
        @if (totalOrdenes() === 0) {
          <hk-empty-state compacto icono="wrench" [titulo]="'dashboard.sin_ordenes' | transloco" />
        } @else {
          <hk-chart
            tipo="dona"
            alto="16rem"
            [etiquetas]="estados().etiquetas"
            [series]="estados().series"
            [etiqueta]="'dashboard.por_estado' | transloco"
            [encabezado]="'comun.estado.titulo' | transloco"
          />
        }
      </ng-template>

      <ng-template #ultimas>
        <ul class="divide-y divide-border">
          @for (o of d.ultimasOrdenes; track o.id) {
            <li>
              <a
                class="flex items-center gap-3 rounded-lg px-2 py-2.5 hk-foco hover:bg-surface-2"
                [routerLink]="['/ordenes', o.id]"
              >
                <hk-placa [placa]="o.placa" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-fg"
                    >{{ o.numero }} · {{ o.moto }}</span
                  >
                  <span class="block truncate text-xs text-muted"
                    >{{ o.cliente }} · {{ o.actualizada | tiempoRelativo }}</span
                  >
                </span>
                <hk-status-badge class="max-sm:hidden" [estado]="o.estado" />
              </a>
            </li>
          }
        </ul>
      </ng-template>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly api = inject(DashboardApiService);
  private readonly auth = inject(AuthService);
  private readonly idioma = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  protected readonly periodos = PERIODOS;
  protected readonly periodo = signal<Periodo>(30);
  protected readonly panel = rxResource({
    params: () => {
      const hasta = hoyEnBogota();
      return { desde: desdeParaPeriodo(hasta, this.periodo()), hasta };
    },
    stream: ({ params }) => this.api.obtener(params.desde, params.hasta, erroresManejados()),
  });

  /** Datos del panel; `undefined` mientras carga o si falló (`value()` lanza en estado de error). */
  protected readonly datos = computed(() =>
    this.panel.hasValue() ? this.panel.value() : undefined,
  );

  private readonly traducciones = toSignal(this.transloco.selectTranslation());

  protected readonly primerNombre = computed(() => this.auth.usuario()?.nombre.split(' ')[0] ?? '');
  protected readonly fechaLarga = computed(() =>
    new Intl.DateTimeFormat(this.idioma.locale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Bogota',
    }).format(new Date()),
  );

  // Contadores animados de los KPIs
  private readonly k = computed(() => this.datos()?.kpis);
  private readonly ventasHoy = contadorAnimado(computed(() => this.k()?.ventasHoyTotal ?? null));
  private readonly ingresosOrdenes = contadorAnimado(
    computed(() => this.k()?.ingresosOrdenesHoy ?? null),
  );
  private readonly activas = contadorAnimado(computed(() => this.k()?.ordenesActivas ?? null));
  private readonly pendientes = contadorAnimado(
    computed(() => this.k()?.pendientesAprobacion ?? null),
  );
  private readonly porCobrar = contadorAnimado(computed(() => this.k()?.porCobrar ?? null));
  private readonly stockBajo = contadorAnimado(
    computed(() => this.k()?.productosStockBajo ?? null),
  );
  private readonly finalizadas = contadorAnimado(computed(() => this.k()?.finalizadasMes ?? null));

  protected readonly kpis = computed(() => {
    this.traducciones();
    const locale = this.idioma.locale();
    const k = this.k();
    if (!k) return [];
    const cop = (v: number) => formatoCop(Math.round(v), locale);
    const num = (v: number) => formatoCantidad(Math.round(v), locale);
    const lista: { clave: string; icono: string; texto: string; detalle?: string }[] = [];
    const agregar = (
      clave: string,
      icono: string,
      valor: number | null,
      formatear: (v: number) => string,
      detalle?: string,
    ) => {
      if (valor !== null) lista.push({ clave, icono, texto: formatear(valor), detalle });
    };
    agregar(
      'ventas_hoy',
      'shopping-cart',
      this.ventasHoy(),
      cop,
      k.ventasHoyCantidad === null
        ? undefined
        : this.transloco.translate('dashboard.n_ventas', { n: k.ventasHoyCantidad }),
    );
    agregar('ingresos_ordenes', 'package-check', this.ingresosOrdenes(), cop);
    agregar('activas', 'wrench', this.activas(), num);
    agregar('pendientes', 'hourglass', this.pendientes(), num);
    agregar('por_cobrar', 'banknote', this.porCobrar(), cop);
    agregar('stock_bajo', 'triangle-alert', this.stockBajo(), num);
    agregar('finalizadas_mes', 'circle-check', this.finalizadas(), num);
    return lista;
  });

  protected readonly diasCortos = computed(() => {
    const locale = this.idioma.locale();
    const formato = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
    return (this.datos()?.ingresosDiarios ?? []).map((d) =>
      formato.format(new Date(`${d.dia}T00:00:00Z`)),
    );
  });
  protected readonly seriesIngresos = computed<SerieGrafica[]>(() => {
    this.traducciones();
    const dias = this.datos()?.ingresosDiarios ?? [];
    return [
      {
        nombre: this.transloco.translate('dashboard.serie_ventas'),
        datos: dias.map((d) => d.ventas),
        color: 'primary',
      },
      {
        nombre: this.transloco.translate('dashboard.serie_ordenes'),
        datos: dias.map((d) => d.ordenes),
        color: 'accent-tone',
      },
    ];
  });
  protected readonly sinIngresos = computed(() =>
    (this.datos()?.ingresosDiarios ?? []).every((d) => d.ventas === 0 && d.ordenes === 0),
  );
  protected readonly totalOrdenes = computed(() =>
    Object.values(this.datos()?.ordenesPorEstado ?? {}).reduce((a, b) => a + (b ?? 0), 0),
  );
  protected readonly estados = computed(() => {
    this.traducciones();
    const porEstado = this.datos()?.ordenesPorEstado ?? {};
    const conDatos = ORDEN_ESTADOS.filter((e) => (porEstado[e] ?? 0) > 0);
    return {
      etiquetas: conDatos.map((e) => this.transloco.translate(`estados.orden.${e}`)),
      series: [
        {
          nombre: this.transloco.translate('dashboard.ordenes'),
          datos: conDatos.map((e) => porEstado[e] ?? 0),
          color: conDatos.map((e) => COLOR_ESTADO[e]),
        },
      ] satisfies SerieGrafica[],
    };
  });
  protected readonly textoCantidad = computed(() => {
    this.traducciones();
    return this.transloco.translate('dashboard.cantidad');
  });

  protected nombres(lista: readonly { nombre: string }[]): string[] {
    return lista.map((t) => t.nombre);
  }

  protected cantidades(lista: readonly { cantidad: number }[]): number[] {
    return lista.map((t) => t.cantidad);
  }
}
