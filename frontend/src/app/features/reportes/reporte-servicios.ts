import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';
import { catchError, finalize, map, of } from 'rxjs';

import { erroresManejados } from '../../core/http/contexto-http';
import { descargarArchivo } from '../../core/utils/descarga';
import { CantidadPipe, CopPipe, FechaPipe } from '../../core/utils/formato.pipes';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { HkStatCard } from '../../shared/ui/card/stat-card';
import { HkChart } from '../../shared/ui/chart/chart';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkPlaca } from '../../shared/ui/placa/placa';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { ColumnaTabla, HkCelda, HkTable } from '../../shared/ui/table/table';
import { ServiciosApiService } from '../servicios/servicios-api.service';
import { OrdenesApiService } from '../taller/ordenes-api.service';
import { HkAccionesReporte, HkPeriodoReporte, paginar, periodoInicial } from './base-reporte';
import {
  FiltrosReporteServicios,
  nombreCsv,
  ReporteServicios,
  ReportesApiService,
} from './reportes-api.service';

/**
 * Reporte de servicios (RF32): órdenes entregadas o finalizadas en el periodo, servicios realizados,
 * ingresos por mano de obra y repuestos, tiempo promedio en taller, servicios más realizados y
 * detalle por orden. Filtra por servicio del catálogo y por mecánico.
 */
@Component({
  selector: 'hk-reporte-servicios',
  imports: [
    TranslocoPipe,
    CantidadPipe,
    CopPipe,
    FechaPipe,
    HkAccionesReporte,
    HkButton,
    HkCard,
    HkCelda,
    HkChart,
    HkEmptyState,
    HkFormField,
    HkPeriodoReporte,
    HkPlaca,
    HkSelect,
    HkSkeleton,
    HkStatCard,
    HkTable,
  ],
  template: `
    <hk-card class="mb-6 print:hidden">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <hk-periodo-reporte [periodo]="filtros()" (cambio)="filtrar($event)" />
        <hk-form-field [etiqueta]="'reportes.servicios.servicio' | transloco">
          <hk-select
            [valor]="filtros().servicioId?.toString() ?? null"
            [opciones]="servicios()"
            [placeholder]="'reportes.servicios.todos_servicios' | transloco"
            (valorChange)="filtrar({ servicioId: $event ? +$event : null })"
          />
        </hk-form-field>
        <hk-form-field [etiqueta]="'reportes.servicios.mecanico' | transloco">
          <hk-select
            [valor]="filtros().mecanicoId?.toString() ?? null"
            [opciones]="mecanicos()"
            [placeholder]="'reportes.servicios.todos_mecanicos' | transloco"
            (valorChange)="filtrar({ mecanicoId: $event ? +$event : null })"
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
          [titulo]="'reportes.servicios.ordenes' | transloco"
          [valor]="r.ordenes | cantidad"
          icono="clipboard-check"
          [detalle]="'reportes.servicios.n_servicios' | transloco: { n: r.servicios }"
        />
        <hk-stat-card
          [titulo]="'reportes.servicios.mano_obra' | transloco"
          [valor]="r.ingresosManoObra | cop"
          icono="wrench"
        />
        <hk-stat-card
          [titulo]="'reportes.servicios.repuestos' | transloco"
          [valor]="r.ingresosRepuestos | cop"
          icono="package"
        />
        <hk-stat-card
          [titulo]="'reportes.servicios.tiempo_promedio' | transloco"
          [valor]="'reportes.horas' | transloco: { n: (r.horasPromedioEnTaller | cantidad) }"
          icono="clock"
        />
      </section>

      @if (r.ordenes === 0) {
        <hk-empty-state
          class="mt-6"
          icono="search-x"
          [titulo]="'reportes.sin_datos' | transloco"
          [texto]="'reportes.sin_datos_texto' | transloco"
        />
      } @else {
        @if (r.porServicio.length > 0) {
          <hk-card class="mt-6 break-inside-avoid" [titulo]="'dashboard.top_servicios' | transloco">
            <hk-chart
              tipo="barras"
              alto="16rem"
              [etiquetas]="etiquetasServicios()"
              [series]="seriesServicios()"
              [etiqueta]="'dashboard.top_servicios' | transloco"
              [encabezado]="'reportes.servicios.servicio' | transloco"
            />
          </hk-card>
        }
        <hk-card class="mt-6" [titulo]="'reportes.detalle' | transloco" sinRelleno>
          <hk-table
            [columnas]="columnas()"
            [filas]="pagina.visibles()"
            claveFila="ordenId"
            [etiqueta]="'reportes.servicios.detalle' | transloco"
            [pagina]="pagina.pagina()"
            [tamano]="pagina.tamano"
            [total]="pagina.total()"
            (paginaCambio)="pagina.ir($event)"
            filasClicables
            (filaClic)="verOrden($event)"
          >
            <ng-template hkCelda="numero" let-d>
              <p class="font-medium text-fg">{{ d.numero }}</p>
              <p class="text-xs text-muted">{{ d.fechaFinalizacion | fecha }}</p>
            </ng-template>
            <ng-template hkCelda="placa" let-d><hk-placa [placa]="d.placa" /></ng-template>
            <ng-template hkCelda="manoObra" let-d>{{ d.manoObra | cop }}</ng-template>
            <ng-template hkCelda="repuestos" let-d>{{ d.repuestos | cop }}</ng-template>
            <ng-template hkCelda="total" let-d>
              <span class="font-semibold">{{ d.total | cop }}</span>
            </ng-template>
            <ng-template hkCelda="horasEnTaller" let-d>{{
              'reportes.horas' | transloco: { n: (d.horasEnTaller | cantidad) }
            }}</ng-template>
          </hk-table>
        </hk-card>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReporteServiciosPage {
  private readonly api = inject(ReportesApiService);
  private readonly router = inject(Router);

  protected readonly filtros = signal<FiltrosReporteServicios>({
    ...periodoInicial(),
    servicioId: null,
    mecanicoId: null,
  });
  protected readonly reporte = rxResource({
    params: () => this.filtros(),
    stream: ({ params }) => this.api.servicios(params, erroresManejados()),
  });
  /** Resultado cargado; `undefined` mientras carga o si falló (`value()` lanza en error). */
  private readonly datos = computed(() =>
    this.reporte.hasValue() ? this.reporte.value() : undefined,
  );
  protected readonly exportando = signal(false);
  protected readonly pagina = paginar(computed(() => this.datos()?.detalle ?? []));

  protected readonly servicios = toSignal(
    inject(ServiciosApiService)
      .listar({ q: '', activo: null, page: 0, size: 100, sort: 'nombre,asc' }, erroresManejados())
      .pipe(
        map((p) => p.content.map<OpcionSelect>((s) => ({ valor: `${s.id}`, etiqueta: s.nombre }))),
        catchError(() => of([])),
      ),
    { initialValue: [] },
  );
  protected readonly mecanicos = toSignal(
    inject(OrdenesApiService)
      .mecanicos(erroresManejados())
      .pipe(
        map((l) => l.map<OpcionSelect>((m) => ({ valor: `${m.id}`, etiqueta: m.nombre }))),
        catchError(() => of([])),
      ),
    { initialValue: [] },
  );

  protected readonly etiquetasServicios = computed(() =>
    (this.datos()?.porServicio ?? []).map((s) => s.nombre),
  );
  private readonly textoCantidad = translateSignal('dashboard.cantidad');
  protected readonly seriesServicios = computed(() => [
    {
      nombre: this.textoCantidad(),
      datos: (this.datos()?.porServicio ?? []).map((s) => s.cantidad),
      color: 'primary' as const,
    },
  ]);

  private readonly textos = translateSignal([
    'reportes.cuentas.orden',
    'taller.campos.placa',
    'taller.campos.cliente',
    'reportes.servicios.mecanicos',
    'reportes.servicios.mano_obra',
    'reportes.servicios.repuestos',
    'compras.total',
    'reportes.servicios.en_taller',
  ]);
  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [orden, placa, cliente, mecanicos, manoObra, repuestos, total, horas] = this.textos();
    return [
      { clave: 'numero', etiqueta: orden, principal: true },
      { clave: 'placa', etiqueta: placa },
      { clave: 'cliente', etiqueta: cliente, ocultarEnMovil: true },
      { clave: 'mecanicos', etiqueta: mecanicos, ocultarEnMovil: true },
      { clave: 'manoObra', etiqueta: manoObra, numerica: true, ocultarEnMovil: true },
      { clave: 'repuestos', etiqueta: repuestos, numerica: true, ocultarEnMovil: true },
      { clave: 'total', etiqueta: total, numerica: true },
      { clave: 'horasEnTaller', etiqueta: horas, numerica: true },
    ];
  });

  protected filtrar(cambio: Partial<FiltrosReporteServicios>): void {
    this.filtros.update((f) => ({ ...f, ...cambio }));
  }

  protected exportar(): void {
    if (this.exportando()) return;
    this.exportando.set(true);
    const filtros = this.filtros();
    this.api
      .exportar('servicios', filtros)
      .pipe(finalize(() => this.exportando.set(false)))
      .subscribe((csv) => descargarArchivo(csv, nombreCsv('servicios', filtros)));
  }

  protected verOrden(d: ReporteServicios['detalle'][number]): void {
    void this.router.navigate(['/ordenes', d.ordenId]);
  }
}
