import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';

import { HkTienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import { erroresManejados } from '../../core/http/contexto-http';
import { CopPipe, FechaPipe } from '../../core/utils/formato.pipes';
import { HkBadge, TonoBadge } from '../../shared/ui/badge/badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { HkStatCard } from '../../shared/ui/card/stat-card';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkCombobox } from '../../shared/ui/forms/combobox';
import { HkDateInput } from '../../shared/ui/forms/date-input';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkPlaca } from '../../shared/ui/placa/placa';
import { ColumnaTabla, HkCelda, HkTable } from '../../shared/ui/table/table';
import { buscadorClientes } from '../clientes/buscador-clientes';
import {
  CuentaPendiente,
  FiltrosCuentasPendientes,
  ReportesApiService,
} from './reportes-api.service';

const TAMANO_PAGINA = 20;

/** Antigüedad de la deuda: hasta 3 días neutro, hasta 7 advertencia y más de 7 peligro. */
export function tonoAntiguedad(dias: number): TonoBadge {
  if (dias <= 3) return 'neutral';
  return dias <= 7 ? 'warning' : 'danger';
}

/**
 * Cuentas pendientes (RF26, RN-37): órdenes finalizadas sin pago, la más antigua primero, con los
 * días transcurridos coloreados por antigüedad, el total adeudado y el acceso directo al pago.
 */
@Component({
  selector: 'hk-cuentas-pendientes-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    CopPipe,
    FechaPipe,
    HkTienePermisoDirective,
    HkBadge,
    HkButton,
    HkCard,
    HkCombobox,
    HkDateInput,
    HkEmptyState,
    HkFormField,
    HkPageHeader,
    HkPlaca,
    HkStatCard,
    HkTable,
    HkCelda,
  ],
  template: `
    <hk-page-header
      [titulo]="'reportes.cuentas.titulo' | transloco"
      [subtitulo]="'reportes.cuentas.subtitulo' | transloco"
    />

    <div class="mb-6 grid gap-4 sm:grid-cols-2">
      <hk-stat-card
        [titulo]="'reportes.cuentas.total_adeudado' | transloco"
        [valor]="cuentas.value()?.totalAdeudado ?? 0 | cop"
        icono="banknote"
      />
      <hk-stat-card
        [titulo]="'reportes.cuentas.cantidad' | transloco"
        [valor]="(cuentas.value()?.cuentas?.totalElements ?? 0).toString()"
        icono="hourglass"
      />
    </div>

    <hk-card>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <hk-form-field class="sm:col-span-2" [etiqueta]="'taller.campos.cliente' | transloco">
          <hk-combobox
            [valor]="filtros().clienteId?.toString() ?? null"
            [opciones]="clientes.opciones()"
            [cargando]="clientes.cargando()"
            [filtrarLocal]="false"
            [placeholder]="'reportes.cuentas.todos_clientes' | transloco"
            (busqueda)="clientes.buscar($event)"
            (valorChange)="filtrar({ clienteId: aCliente($event) })"
          />
        </hk-form-field>
        <hk-form-field [etiqueta]="'reportes.cuentas.finalizada_desde' | transloco">
          <hk-date-input
            [valor]="filtros().desde"
            (valorChange)="filtrar({ desde: $event || null })"
          />
        </hk-form-field>
        <hk-form-field [etiqueta]="'reportes.cuentas.finalizada_hasta' | transloco">
          <hk-date-input
            [valor]="filtros().hasta"
            (valorChange)="filtrar({ hasta: $event || null })"
          />
        </hk-form-field>
      </div>

      <div class="mt-5">
        @if (cuentas.error()) {
          <hk-empty-state
            icono="circle-alert"
            [titulo]="'reportes.cuentas.error' | transloco"
            [texto]="'comun.error_texto' | transloco"
          >
            <button hk-button variante="secondary" icono="rotate-ccw" (click)="cuentas.reload()">
              {{ 'comun.reintentar' | transloco }}
            </button>
          </hk-empty-state>
        } @else {
          <hk-table
            [columnas]="columnas()"
            [filas]="cuentas.value()?.cuentas?.content ?? []"
            [cargando]="cuentas.isLoading()"
            [etiqueta]="'reportes.cuentas.titulo' | transloco"
            [pagina]="filtros().page"
            [tamano]="tamanoPagina"
            [total]="cuentas.value()?.cuentas?.totalElements"
            (paginaCambio)="filtrar({ page: $event }, false)"
            filasClicables
            (filaClic)="verOrden($event)"
            vacioIcono="circle-check"
            [vacioTitulo]="'reportes.cuentas.vacio_titulo' | transloco"
            [vacioTexto]="'reportes.cuentas.vacio_texto' | transloco"
          >
            <ng-template hkCelda="numero" let-c>
              <p class="font-medium text-fg">{{ c.numero }}</p>
              <p class="text-xs text-muted">{{ c.moto }}</p>
            </ng-template>
            <ng-template hkCelda="placa" let-c><hk-placa [placa]="c.placa" /></ng-template>
            <ng-template hkCelda="cliente" let-c>
              <p class="text-fg">{{ c.cliente }}</p>
              <p class="text-xs text-muted">{{ c.telefono }}</p>
            </ng-template>
            <ng-template hkCelda="fechaFinalizacion" let-c>{{
              c.fechaFinalizacion | fecha
            }}</ng-template>
            <ng-template hkCelda="diasTranscurridos" let-c>
              <hk-badge [tono]="tono(c.diasTranscurridos)" icono="clock">
                {{ 'reportes.cuentas.dias' | transloco: { n: c.diasTranscurridos } }}
              </hk-badge>
            </ng-template>
            <ng-template hkCelda="total" let-c>
              <span class="font-semibold tabular">{{ c.total | cop }}</span>
            </ng-template>
            <ng-template hkCelda="accion" let-c>
              <a
                *hkTienePermiso="'PAGOS_REGISTRAR'"
                hk-button
                variante="secondary"
                tamano="sm"
                icono="banknote"
                [routerLink]="['/ordenes', c.ordenId]"
                [queryParams]="{ pestana: 'pago' }"
                (click)="$event.stopPropagation()"
              >
                {{ 'reportes.cuentas.registrar_pago' | transloco }}
              </a>
            </ng-template>
          </hk-table>
        }
      </div>
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuentasPendientesPage {
  private readonly api = inject(ReportesApiService);
  private readonly router = inject(Router);

  protected readonly tamanoPagina = TAMANO_PAGINA;
  protected readonly clientes = buscadorClientes();
  protected readonly filtros = signal<FiltrosCuentasPendientes>({
    clienteId: null,
    desde: null,
    hasta: null,
    page: 0,
    size: TAMANO_PAGINA,
  });
  protected readonly cuentas = rxResource({
    params: () => this.filtros(),
    stream: ({ params }) => this.api.cuentasPendientes(params, erroresManejados()),
  });

  private readonly textos = translateSignal([
    'reportes.cuentas.orden',
    'taller.campos.placa',
    'taller.campos.cliente',
    'reportes.cuentas.finalizada',
    'reportes.cuentas.dias_transcurridos',
    'compras.total',
    'reportes.cuentas.accion',
  ]);
  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [orden, placa, cliente, finalizada, dias, total, acciones] = this.textos();
    return [
      { clave: 'numero', etiqueta: orden, principal: true },
      { clave: 'placa', etiqueta: placa },
      { clave: 'cliente', etiqueta: cliente },
      { clave: 'fechaFinalizacion', etiqueta: finalizada, ocultarEnMovil: true },
      { clave: 'diasTranscurridos', etiqueta: dias },
      { clave: 'total', etiqueta: total, numerica: true },
      { clave: 'accion', etiqueta: acciones, alinear: 'fin' },
    ];
  });

  protected aCliente(valor: string | null): number | null {
    return valor ? Number(valor) : null;
  }

  protected tono(dias: number): TonoBadge {
    return tonoAntiguedad(dias);
  }

  protected filtrar(cambio: Partial<FiltrosCuentasPendientes>, reiniciarPagina = true): void {
    this.filtros.update((f) => ({ ...f, ...(reiniciarPagina ? { page: 0 } : {}), ...cambio }));
  }

  protected verOrden(cuenta: CuentaPendiente): void {
    void this.router.navigate(['/ordenes', cuenta.ordenId]);
  }
}
