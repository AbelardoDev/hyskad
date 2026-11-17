import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { catchError, finalize, map, of } from 'rxjs';

import { erroresManejados } from '../../core/http/contexto-http';
import { descargarArchivo } from '../../core/utils/descarga';
import { CantidadPipe, CopPipe } from '../../core/utils/formato.pipes';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { HkStatCard } from '../../shared/ui/card/stat-card';
import { HkChart, SerieGrafica } from '../../shared/ui/chart/chart';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { ColumnaTabla, HkCelda, HkTable } from '../../shared/ui/table/table';
import { EstadoStock, InventarioApiService } from '../inventario/inventario-api.service';
import { HkEstadoStock } from '../inventario/nivel-stock';
import { HkAccionesReporte, HkPeriodoReporte, paginar, periodoInicial } from './base-reporte';
import {
  FiltrosReporteInventario,
  NivelInventario,
  nombreCsv,
  ReporteInventario,
  ReportesApiService,
} from './reportes-api.service';

/** Nivel del reporte → estado del badge de inventario. */
export const ESTADO_POR_NIVEL: Record<NivelInventario, EstadoStock> = {
  NORMAL: 'OK',
  BAJO: 'BAJO',
  AGOTADO: 'AGOTADO',
};

/**
 * Reporte de inventario (RF33): existencias valorizadas a costo promedio, productos con stock bajo
 * o agotados y movimientos del periodo por tipo. Filtra por categoría y, en la tabla, por nivel.
 */
@Component({
  selector: 'hk-reporte-inventario',
  imports: [
    TranslocoPipe,
    CantidadPipe,
    CopPipe,
    HkAccionesReporte,
    HkButton,
    HkCard,
    HkCelda,
    HkChart,
    HkEmptyState,
    HkEstadoStock,
    HkFormField,
    HkPeriodoReporte,
    HkSelect,
    HkSkeleton,
    HkStatCard,
    HkTable,
  ],
  template: `
    <hk-card class="mb-6 print:hidden">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <hk-periodo-reporte [periodo]="filtros()" (cambio)="filtrar($event)" />
        <hk-form-field [etiqueta]="'inventario.campos.categoria' | transloco">
          <hk-select
            [valor]="filtros().categoriaId?.toString() ?? null"
            [opciones]="categorias()"
            [placeholder]="'inventario.filtros.todas_categorias' | transloco"
            (valorChange)="filtrar({ categoriaId: $event ? +$event : null })"
          />
        </hk-form-field>
        <hk-form-field [etiqueta]="'reportes.inventario.nivel' | transloco">
          <hk-select
            [valor]="nivel()"
            [opciones]="niveles()"
            [placeholder]="'reportes.inventario.todos_niveles' | transloco"
            (valorChange)="elegirNivel($event)"
          />
        </hk-form-field>
      </div>
      <hk-acciones-reporte
        class="mt-4 justify-end"
        [listo]="reporte.hasValue()"
        [exportando]="exportando()"
        (exportar)="exportar()"
      />
    </hk-card>
    <p class="mb-4 hidden text-sm text-muted print:block">
      {{ 'reportes.periodo_impreso' | transloco: filtros() }}
    </p>

    @if (reporte.error()) {
      <hk-empty-state
        icono="circle-alert"
        [titulo]="'reportes.error' | transloco"
        [texto]="'comun.error_texto' | transloco"
      >
        <button hk-button variante="secondary" icono="rotate-ccw" (click)="reporte.reload()">
          {{ 'comun.reintentar' | transloco }}
        </button>
      </hk-empty-state>
    } @else if (!reporte.hasValue()) {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
        @for (i of [1, 2, 3, 4]; track i) {
          <hk-skeleton variante="rectangulo" alto="7.5rem" />
        }
        <hk-skeleton class="sm:col-span-2 xl:col-span-4" variante="rectangulo" alto="18rem" />
      </div>
    } @else if (reporte.value(); as r) {
      <section
        class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        [attr.aria-label]="'dashboard.indicadores' | transloco"
      >
        <hk-stat-card
          [titulo]="'reportes.inventario.valor' | transloco"
          [valor]="r.valorInventario | cop"
          icono="banknote"
        />
        <hk-stat-card
          [titulo]="'reportes.inventario.productos' | transloco"
          [valor]="r.productos | cantidad"
          icono="package"
          [detalle]="'reportes.inventario.n_unidades' | transloco: { n: (r.unidades | cantidad) }"
        />
        <hk-stat-card
          [titulo]="'inventario.estado_stock.BAJO' | transloco"
          [valor]="r.conStockBajo | cantidad"
          icono="triangle-alert"
        />
        <hk-stat-card
          [titulo]="'inventario.estado_stock.AGOTADO' | transloco"
          [valor]="r.agotados | cantidad"
          icono="circle-x"
        />
      </section>

      <div class="mt-6 grid gap-6 lg:grid-cols-5">
        <hk-card
          class="break-inside-avoid lg:col-span-3"
          [titulo]="'reportes.inventario.movimientos' | transloco"
        >
          @if (r.movimientos.length === 0) {
            <hk-empty-state
              compacto
              icono="arrow-left-right"
              [titulo]="'reportes.inventario.sin_movimientos' | transloco"
            />
          } @else {
            <hk-chart
              tipo="barras"
              alto="16rem"
              [etiquetas]="tiposMovimiento()"
              [series]="seriesMovimientos()"
              [etiqueta]="'reportes.inventario.movimientos' | transloco"
              [encabezado]="'reportes.inventario.tipo' | transloco"
            />
          }
        </hk-card>
        <hk-card class="break-inside-avoid lg:col-span-2" [titulo]="'reportes.resumen' | transloco">
          <dl class="divide-y divide-border text-sm">
            @for (m of r.movimientos; track m.tipo) {
              <div class="flex items-start justify-between gap-3 py-2.5">
                <dt class="text-muted">{{ 'inventario.tipos.' + m.tipo | transloco }}</dt>
                <dd class="text-end tabular">
                  <span class="block font-medium text-fg">{{ m.valor | cop }}</span>
                  <span class="block text-xs text-muted">{{
                    'reportes.inventario.n_movimientos'
                      | transloco: { n: m.cantidad, unidades: (m.unidades | cantidad) }
                  }}</span>
                </dd>
              </div>
            } @empty {
              <p class="py-2.5 text-muted">
                {{ 'reportes.inventario.sin_movimientos' | transloco }}
              </p>
            }
          </dl>
        </hk-card>
      </div>

      <hk-card class="mt-6" [titulo]="'reportes.inventario.existencias' | transloco" sinRelleno>
        <hk-table
          [columnas]="columnas()"
          [filas]="pagina.visibles()"
          [etiqueta]="'reportes.inventario.existencias' | transloco"
          [pagina]="pagina.pagina()"
          [tamano]="pagina.tamano"
          [total]="pagina.total()"
          (paginaCambio)="pagina.ir($event)"
          filasClicables
          (filaClic)="verProducto($event)"
          vacioIcono="package"
          [vacioTitulo]="'reportes.sin_datos' | transloco"
        >
          <ng-template hkCelda="nombre" let-p>
            <p class="font-medium text-fg">{{ p.nombre }}</p>
            <p class="text-xs text-muted">{{ p.codigo }} · {{ p.categoria }}</p>
          </ng-template>
          <ng-template hkCelda="disponible" let-p>
            {{ p.disponible | cantidad }}
            <span class="text-xs text-muted">/ {{ p.minimo | cantidad }}</span>
          </ng-template>
          <ng-template hkCelda="costoPromedio" let-p>{{ p.costoPromedio | cop }}</ng-template>
          <ng-template hkCelda="valor" let-p>
            <span class="font-semibold">{{ p.valor | cop }}</span>
          </ng-template>
          <ng-template hkCelda="nivel" let-p>
            <hk-estado-stock [estado]="estado(p.nivel)" />
          </ng-template>
        </hk-table>
      </hk-card>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReporteInventarioPage {
  private readonly api = inject(ReportesApiService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  protected readonly filtros = signal<FiltrosReporteInventario>({
    ...periodoInicial(),
    categoriaId: null,
  });
  protected readonly reporte = rxResource({
    params: () => this.filtros(),
    stream: ({ params }) => this.api.inventario(params, erroresManejados()),
  });
  /** Resultado cargado; `undefined` mientras carga o si falló (`value()` lanza en error). */
  private readonly datos = computed(() =>
    this.reporte.hasValue() ? this.reporte.value() : undefined,
  );
  protected readonly exportando = signal(false);
  /** Filtro local de la tabla por nivel de stock. */
  protected readonly nivel = signal<NivelInventario | null>(null);
  private readonly productos = computed(() => {
    const detalle = this.datos()?.detalle ?? [];
    const nivel = this.nivel();
    return nivel ? detalle.filter((p) => p.nivel === nivel) : detalle;
  });
  protected readonly pagina = paginar(this.productos);

  protected readonly categorias = toSignal(
    inject(InventarioApiService)
      .categorias(null, erroresManejados())
      .pipe(
        map((l) => l.map<OpcionSelect>((c) => ({ valor: `${c.id}`, etiqueta: c.nombre }))),
        catchError(() => of([])),
      ),
    { initialValue: [] },
  );
  private readonly traducciones = toSignal(this.transloco.selectTranslation());
  protected readonly niveles = computed<OpcionSelect[]>(() => {
    this.traducciones();
    return (['BAJO', 'AGOTADO'] as const).map((n) => ({
      valor: n,
      etiqueta: this.transloco.translate(`inventario.estado_stock.${n}`),
    }));
  });

  protected readonly tiposMovimiento = computed(() => {
    this.traducciones();
    return (this.datos()?.movimientos ?? []).map((m) =>
      this.transloco.translate(`inventario.tipos.${m.tipo}`),
    );
  });
  protected readonly seriesMovimientos = computed<SerieGrafica[]>(() => {
    this.traducciones();
    return [
      {
        nombre: this.transloco.translate('reportes.inventario.cantidad_movimientos'),
        datos: (this.datos()?.movimientos ?? []).map((m) => m.cantidad),
        color: 'accent-tone',
      },
    ];
  });

  private readonly textos = translateSignal([
    'reportes.inventario.producto',
    'reportes.inventario.existencias_col',
    'reportes.inventario.disponible',
    'reportes.inventario.costo_promedio',
    'reportes.inventario.valor_col',
    'reportes.inventario.nivel',
  ]);
  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [producto, existencias, disponible, costo, valor, nivel] = this.textos();
    return [
      { clave: 'nombre', etiqueta: producto, principal: true },
      { clave: 'stockActual', etiqueta: existencias, numerica: true, ocultarEnMovil: true },
      { clave: 'disponible', etiqueta: disponible, numerica: true },
      { clave: 'costoPromedio', etiqueta: costo, numerica: true, ocultarEnMovil: true },
      { clave: 'valor', etiqueta: valor, numerica: true },
      { clave: 'nivel', etiqueta: nivel },
    ];
  });

  protected elegirNivel(valor: string | null): void {
    this.nivel.set(valor === 'BAJO' || valor === 'AGOTADO' ? valor : null);
  }

  protected estado(nivel: NivelInventario): EstadoStock {
    return ESTADO_POR_NIVEL[nivel];
  }

  protected filtrar(cambio: Partial<FiltrosReporteInventario>): void {
    this.filtros.update((f) => ({ ...f, ...cambio }));
  }

  protected exportar(): void {
    if (this.exportando()) return;
    this.exportando.set(true);
    const filtros = this.filtros();
    this.api
      .exportar('inventario', filtros)
      .pipe(finalize(() => this.exportando.set(false)))
      .subscribe((csv) => descargarArchivo(csv, nombreCsv('inventario', filtros)));
  }

  protected verProducto(p: ReporteInventario['detalle'][number]): void {
    void this.router.navigate(['/inventario/productos', p.id]);
  }
}
