import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';

import { AuthService } from '../../core/auth/auth.service';
import { HkTienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import { erroresManejados } from '../../core/http/contexto-http';
import { hoyEnBogota } from '../../core/utils/formato';
import { CopPipe, FechaPipe } from '../../core/utils/formato.pipes';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { HkStatCard } from '../../shared/ui/card/stat-card';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkCheckbox } from '../../shared/ui/forms/checkbox';
import { HkDateInput } from '../../shared/ui/forms/date-input';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { ColumnaTabla, HkCelda, HkTable } from '../../shared/ui/table/table';
import { HkEstadoVenta } from './estado-venta';
import {
  EstadoVenta,
  FiltrosVentas,
  MetodoPago,
  METODOS_PAGO,
  VentaResumen,
  VentasApiService,
} from './ventas-api.service';

const TAMANO_PAGINA = 20;
const ESTADOS: readonly EstadoVenta[] = ['PAGADA', 'ANULADA'];
const ESPERA_BUSQUEDA_MS = 300;

/** Ventas (RF29): filtros, totales del periodo filtrado y acceso al detalle y al punto de venta. */
@Component({
  selector: 'hk-ventas-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    CopPipe,
    FechaPipe,
    HkTienePermisoDirective,
    HkButton,
    HkCard,
    HkCheckbox,
    HkDateInput,
    HkEmptyState,
    HkEstadoVenta,
    HkFormField,
    HkInput,
    HkSelect,
    HkPageHeader,
    HkStatCard,
    HkTable,
    HkCelda,
  ],
  template: `
    <hk-page-header
      [titulo]="'menu.ventas' | transloco"
      [subtitulo]="'ventas.subtitulo' | transloco"
    >
      <a
        *hkTienePermiso="'VENTAS_CREAR'"
        hk-button
        icono="plus"
        hkAccionPrincipal
        routerLink="/ventas/nueva"
      >
        {{ 'ventas.nueva' | transloco }}
      </a>
    </hk-page-header>

    <div class="mb-6 grid gap-4 sm:grid-cols-2">
      <hk-stat-card
        [titulo]="'ventas.resumen.cantidad' | transloco"
        [valor]="(resumen.value()?.cantidad ?? 0).toString()"
        icono="shopping-cart"
      />
      <hk-stat-card
        [titulo]="'ventas.resumen.total' | transloco"
        [valor]="resumen.value()?.total ?? 0 | cop"
        icono="banknote"
      />
    </div>

    <hk-card>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <hk-form-field [etiqueta]="'ventas.campos.numero' | transloco">
          <hk-input
            tipo="search"
            icono="search"
            [placeholder]="'V-000001'"
            [valor]="filtros().numero"
            (valorChange)="buscarNumero($event)"
          />
        </hk-form-field>
        <hk-form-field [etiqueta]="'inventario.movimientos.desde' | transloco">
          <hk-date-input
            [valor]="filtros().desde"
            (valorChange)="filtrar({ desde: $event || null })"
          />
        </hk-form-field>
        <hk-form-field [etiqueta]="'inventario.movimientos.hasta' | transloco">
          <hk-date-input
            [valor]="filtros().hasta"
            (valorChange)="filtrar({ hasta: $event || null })"
          />
        </hk-form-field>
        <hk-form-field [etiqueta]="'ventas.campos.metodo' | transloco">
          <hk-select
            [opciones]="opcionesMetodo()"
            [placeholder]="'ventas.todos_metodos' | transloco"
            [valor]="filtros().metodo"
            (valorChange)="filtrar({ metodo: aMetodo($event) })"
          />
        </hk-form-field>
        <hk-form-field [etiqueta]="'comun.estado.titulo' | transloco">
          <hk-select
            [opciones]="opcionesEstado()"
            [placeholder]="'comun.filtros.todos_estados' | transloco"
            [valor]="filtros().estado"
            (valorChange)="filtrar({ estado: aEstado($event) })"
          />
        </hk-form-field>
        <div class="flex items-end pb-2">
          <hk-checkbox [valor]="filtros().vendedorId !== null" (valorChange)="soloMias($event)">
            {{ 'ventas.solo_mias' | transloco }}
          </hk-checkbox>
        </div>
      </div>

      <div class="mt-5">
        @if (ventas.error()) {
          <hk-empty-state
            icono="circle-alert"
            [titulo]="'ventas.error_titulo' | transloco"
            [texto]="'comun.error_texto' | transloco"
          >
            <button hk-button variante="secondary" icono="rotate-ccw" (click)="ventas.reload()">
              {{ 'comun.reintentar' | transloco }}
            </button>
          </hk-empty-state>
        } @else {
          <hk-table
            [columnas]="columnas()"
            [filas]="ventas.value()?.content ?? []"
            [cargando]="ventas.isLoading()"
            [etiqueta]="'menu.ventas' | transloco"
            [pagina]="filtros().page"
            [tamano]="tamanoPagina"
            [total]="ventas.value()?.totalElements"
            (paginaCambio)="filtrar({ page: $event }, false)"
            filasClicables
            (filaClic)="verDetalle($event)"
            vacioIcono="shopping-cart"
            [vacioTitulo]="'ventas.vacio_titulo' | transloco"
            [vacioTexto]="'ventas.vacio_texto' | transloco"
          >
            <ng-template hkCelda="numero" let-v>
              <p class="font-medium text-fg">{{ v.numero }}</p>
              <p class="text-xs text-muted">{{ v.fecha | fecha: 'fechaHora' }}</p>
            </ng-template>
            <ng-template hkCelda="cliente" let-v>
              {{ v.cliente ?? ('ventas.consumidor_final' | transloco) }}
            </ng-template>
            <ng-template hkCelda="vendedor" let-v>{{ v.vendedor?.nombre ?? '—' }}</ng-template>
            <ng-template hkCelda="metodoPago" let-v>{{
              'ventas.metodos.' + v.metodoPago | transloco
            }}</ng-template>
            <ng-template hkCelda="total" let-v>
              <span class="font-semibold tabular">{{ v.total | cop }}</span>
            </ng-template>
            <ng-template hkCelda="estado" let-v
              ><hk-estado-venta [estado]="v.estado"
            /></ng-template>
          </hk-table>
        }
      </div>
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VentasPage {
  private readonly api = inject(VentasApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly tamanoPagina = TAMANO_PAGINA;
  /** Por defecto, las ventas de hoy. */
  protected readonly filtros = signal<FiltrosVentas>({
    desde: hoyEnBogota(),
    hasta: hoyEnBogota(),
    vendedorId: null,
    metodo: null,
    estado: null,
    numero: '',
    page: 0,
    size: TAMANO_PAGINA,
  });
  protected readonly ventas = rxResource({
    params: () => this.filtros(),
    stream: ({ params }) => this.api.listar(params, erroresManejados()),
  });
  /** Totales del periodo: solo ventas pagadas, salvo que se filtre por otro estado. */
  protected readonly resumen = rxResource({
    params: () => {
      const filtros = this.filtros();
      return { ...filtros, page: 0, estado: filtros.estado ?? ('PAGADA' as const) };
    },
    stream: ({ params }) => this.api.resumen(params, erroresManejados()),
  });

  private readonly textos = translateSignal([
    'ventas.campos.numero',
    'ventas.campos.cliente',
    'ventas.campos.vendedor',
    'ventas.campos.metodo',
    'compras.total',
    'comun.estado.titulo',
  ]);
  private readonly textosMetodo = translateSignal(METODOS_PAGO.map((m) => `ventas.metodos.${m}`));
  private readonly textosEstado = translateSignal(ESTADOS.map((e) => `ventas.estados.${e}`));
  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [numero, cliente, vendedor, metodo, total, estado] = this.textos();
    return [
      { clave: 'numero', etiqueta: numero, principal: true },
      { clave: 'cliente', etiqueta: cliente },
      { clave: 'vendedor', etiqueta: vendedor, ocultarEnMovil: true },
      { clave: 'metodoPago', etiqueta: metodo, ocultarEnMovil: true },
      { clave: 'total', etiqueta: total, numerica: true },
      { clave: 'estado', etiqueta: estado },
    ];
  });
  protected readonly opcionesMetodo = computed<OpcionSelect[]>(() =>
    METODOS_PAGO.map((valor, i) => ({ valor, etiqueta: this.textosMetodo()[i] })),
  );
  protected readonly opcionesEstado = computed<OpcionSelect[]>(() =>
    ESTADOS.map((valor, i) => ({ valor, etiqueta: this.textosEstado()[i] })),
  );

  private temporizador: ReturnType<typeof setTimeout> | undefined;

  protected aMetodo(valor: string | null): MetodoPago | null {
    return METODOS_PAGO.find((m) => m === valor) ?? null;
  }

  protected aEstado(valor: string | null): EstadoVenta | null {
    return ESTADOS.find((e) => e === valor) ?? null;
  }

  protected filtrar(cambio: Partial<FiltrosVentas>, reiniciarPagina = true): void {
    this.filtros.update((f) => ({ ...f, ...(reiniciarPagina ? { page: 0 } : {}), ...cambio }));
  }

  protected soloMias(activo: boolean): void {
    this.filtrar({ vendedorId: activo ? (this.auth.usuario()?.id ?? null) : null });
  }

  protected buscarNumero(texto: string | null): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(
      () => this.filtrar({ numero: (texto ?? '').trim() }),
      ESPERA_BUSQUEDA_MS,
    );
  }

  protected verDetalle(venta: VentaResumen): void {
    void this.router.navigate(['/ventas', venta.id]);
  }
}
