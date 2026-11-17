import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { catchError, finalize, map, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { erroresManejados } from '../../core/http/contexto-http';
import { LanguageService } from '../../core/i18n/language.service';
import { descargarArchivo } from '../../core/utils/descarga';
import { CantidadPipe, CopPipe, FechaPipe } from '../../core/utils/formato.pipes';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { HkStatCard } from '../../shared/ui/card/stat-card';
import { ColorGrafica, HkChart, SerieGrafica } from '../../shared/ui/chart/chart';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { METODOS_PAGO, MetodoPago } from '../../shared/ui/forms/campos-pago';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { ColumnaTabla, HkCelda, HkTable } from '../../shared/ui/table/table';
import { UsuariosApiService } from '../usuarios/usuarios-api.service';
import { HkAccionesReporte, HkPeriodoReporte, paginar, periodoInicial } from './base-reporte';
import {
  FiltrosReporteVentas,
  nombreCsv,
  ReportesApiService,
  ReporteVentas,
} from './reportes-api.service';

const COLOR_METODO: Record<MetodoPago, ColorGrafica> = {
  EFECTIVO: 'success',
  TRANSFERENCIA: 'primary',
  TARJETA: 'accent-tone',
  OTRO: 'muted',
};

/**
 * Reporte de ventas: ventas pagadas del periodo con su utilidad bruta (precio − costo congelado al
 * vender) y margen, ventas por día y por método de pago, y detalle. Filtra por vendedor (si quien lo
 * consulta puede listar usuarios) y por método de pago.
 */
@Component({
  selector: 'hk-reporte-ventas',
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
    HkSelect,
    HkSkeleton,
    HkStatCard,
    HkTable,
  ],
  template: `
    <hk-card class="mb-6 print:hidden">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <hk-periodo-reporte [periodo]="filtros()" (cambio)="filtrar($event)" />
        @if (puedeFiltrarVendedor) {
          <hk-form-field [etiqueta]="'ventas.campos.vendedor' | transloco">
            <hk-select
              [valor]="filtros().vendedorId?.toString() ?? null"
              [opciones]="vendedores()"
              [placeholder]="'reportes.ventas.todos_vendedores' | transloco"
              (valorChange)="filtrar({ vendedorId: $event ? +$event : null })"
            />
          </hk-form-field>
        }
        <hk-form-field [etiqueta]="'pago.metodo' | transloco">
          <hk-select
            [valor]="filtros().metodo"
            [opciones]="metodos()"
            [placeholder]="'ventas.todos_metodos' | transloco"
            (valorChange)="elegirMetodo($event)"
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
          [titulo]="'reportes.ventas.total' | transloco"
          [valor]="r.total | cop"
          icono="shopping-cart"
          [detalle]="'dashboard.n_ventas' | transloco: { n: r.ventas }"
        />
        <hk-stat-card
          [titulo]="'reportes.ventas.costo' | transloco"
          [valor]="r.costo | cop"
          icono="package"
        />
        <hk-stat-card
          [titulo]="'reportes.ventas.utilidad' | transloco"
          [valor]="r.utilidadBruta | cop"
          icono="trending-up"
        />
        <hk-stat-card
          [titulo]="'reportes.ventas.margen' | transloco"
          [valor]="(r.margenPorcentaje | cantidad) + ' %'"
          icono="chart-column"
        />
      </section>

      @if (r.ventas === 0) {
        <hk-empty-state
          class="mt-6"
          icono="search-x"
          [titulo]="'reportes.sin_datos' | transloco"
          [texto]="'reportes.sin_datos_texto' | transloco"
        />
      } @else {
        <div class="mt-6 grid gap-6 lg:grid-cols-3">
          <hk-card
            class="break-inside-avoid lg:col-span-2"
            [titulo]="'reportes.ventas.por_dia' | transloco"
          >
            <hk-chart
              tipo="area"
              formato="cop"
              alto="16rem"
              [etiquetas]="dias()"
              [series]="seriesDias()"
              [etiqueta]="'reportes.ventas.por_dia' | transloco"
              [encabezado]="'dashboard.dia' | transloco"
            />
          </hk-card>
          <hk-card class="break-inside-avoid" [titulo]="'reportes.ventas.por_metodo' | transloco">
            <hk-chart
              tipo="dona"
              formato="cop"
              alto="16rem"
              [etiquetas]="metodosGrafica().etiquetas"
              [series]="metodosGrafica().series"
              [etiqueta]="'reportes.ventas.por_metodo' | transloco"
              [encabezado]="'pago.metodo' | transloco"
            />
          </hk-card>
        </div>

        <hk-card class="mt-6" [titulo]="'reportes.detalle' | transloco">
          <hk-table
            [columnas]="columnas()"
            [filas]="pagina.visibles()"
            claveFila="ventaId"
            [etiqueta]="'reportes.ventas.detalle' | transloco"
            [pagina]="pagina.pagina()"
            [tamano]="pagina.tamano"
            [total]="pagina.total()"
            (paginaCambio)="pagina.ir($event)"
            filasClicables
            (filaClic)="verVenta($event)"
          >
            <ng-template hkCelda="numero" let-v>
              <p class="font-medium text-fg">{{ v.numero }}</p>
              <p class="text-xs text-muted">{{ v.fecha | fecha: 'fechaHora' }}</p>
            </ng-template>
            <ng-template hkCelda="metodo" let-v>{{
              'pago.metodos.' + v.metodo | transloco
            }}</ng-template>
            <ng-template hkCelda="total" let-v>{{ v.total | cop }}</ng-template>
            <ng-template hkCelda="costo" let-v>{{ v.costo | cop }}</ng-template>
            <ng-template hkCelda="utilidad" let-v>
              <span class="font-semibold" [class.text-danger-ink]="v.utilidad < 0">{{
                v.utilidad | cop
              }}</span>
            </ng-template>
          </hk-table>
        </hk-card>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReporteVentasPage {
  private readonly api = inject(ReportesApiService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly idioma = inject(LanguageService);

  /** Solo quien gestiona usuarios puede listarlos para el filtro de vendedor. */
  protected readonly puedeFiltrarVendedor = inject(AuthService).tienePermiso('USUARIOS_GESTIONAR');

  protected readonly filtros = signal<FiltrosReporteVentas>({
    ...periodoInicial(),
    vendedorId: null,
    metodo: null,
  });
  protected readonly reporte = rxResource({
    params: () => this.filtros(),
    stream: ({ params }) => this.api.ventas(params, erroresManejados()),
  });
  /** Resultado cargado; `undefined` mientras carga o si falló (`value()` lanza en error). */
  private readonly datos = computed(() =>
    this.reporte.hasValue() ? this.reporte.value() : undefined,
  );
  protected readonly exportando = signal(false);
  protected readonly pagina = paginar(computed(() => this.datos()?.detalle ?? []));

  protected readonly vendedores = toSignal(
    this.puedeFiltrarVendedor
      ? inject(UsuariosApiService)
          .listar(
            { q: '', rol: null, activo: null, page: 0, size: 100, sort: 'nombre,asc' },
            erroresManejados(),
          )
          .pipe(
            map((p) =>
              p.content
                .filter((u) => u.rol !== 'MECANICO')
                .map<OpcionSelect>((u) => ({ valor: `${u.id}`, etiqueta: u.nombre })),
            ),
            catchError(() => of([])),
          )
      : of([]),
    { initialValue: [] },
  );

  private readonly traducciones = toSignal(this.transloco.selectTranslation());
  protected readonly metodos = computed<OpcionSelect[]>(() => {
    this.traducciones();
    return METODOS_PAGO.map((m) => ({
      valor: m,
      etiqueta: this.transloco.translate(`pago.metodos.${m}`),
    }));
  });

  protected readonly dias = computed(() => {
    const formato = new Intl.DateTimeFormat(this.idioma.locale(), {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
    return (this.datos()?.porDia ?? []).map((d) =>
      formato.format(new Date(`${d.clave}T00:00:00Z`)),
    );
  });
  protected readonly seriesDias = computed<SerieGrafica[]>(() => {
    this.traducciones();
    return [
      {
        nombre: this.transloco.translate('dashboard.serie_ventas'),
        datos: (this.datos()?.porDia ?? []).map((d) => d.valor),
        color: 'primary',
      },
    ];
  });
  protected readonly metodosGrafica = computed(() => {
    this.traducciones();
    const porMetodo = this.datos()?.porMetodo ?? [];
    return {
      etiquetas: porMetodo.map((m) => this.transloco.translate(`pago.metodos.${m.clave}`)),
      series: [
        {
          nombre: this.transloco.translate('reportes.ventas.total'),
          datos: porMetodo.map((m) => m.valor),
          color: porMetodo.map((m) => COLOR_METODO[m.clave as MetodoPago] ?? 'muted'),
        },
      ] satisfies SerieGrafica[],
    };
  });

  private readonly textos = translateSignal([
    'ventas.campos.numero',
    'ventas.campos.vendedor',
    'pago.metodo',
    'compras.total',
    'reportes.ventas.costo',
    'reportes.ventas.utilidad',
  ]);
  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [numero, vendedor, metodo, total, costo, utilidad] = this.textos();
    return [
      { clave: 'numero', etiqueta: numero, principal: true },
      { clave: 'vendedor', etiqueta: vendedor, ocultarEnMovil: true },
      { clave: 'metodo', etiqueta: metodo },
      { clave: 'total', etiqueta: total, numerica: true },
      { clave: 'costo', etiqueta: costo, numerica: true, ocultarEnMovil: true },
      { clave: 'utilidad', etiqueta: utilidad, numerica: true },
    ];
  });

  protected elegirMetodo(valor: string | null): void {
    const metodo = METODOS_PAGO.find((m) => m === valor) ?? null;
    this.filtrar({ metodo });
  }

  protected filtrar(cambio: Partial<FiltrosReporteVentas>): void {
    this.filtros.update((f) => ({ ...f, ...cambio }));
  }

  protected exportar(): void {
    if (this.exportando()) return;
    this.exportando.set(true);
    const filtros = this.filtros();
    this.api
      .exportar('ventas', filtros)
      .pipe(finalize(() => this.exportando.set(false)))
      .subscribe((csv) => descargarArchivo(csv, nombreCsv('ventas', filtros)));
  }

  protected verVenta(v: ReporteVentas['detalle'][number]): void {
    void this.router.navigate(['/ventas', v.ventaId]);
  }
}
