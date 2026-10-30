import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { erroresManejados } from '../../core/http/contexto-http';
import { TiempoRelativoPipe } from '../../core/utils/formato.pipes';
import { HkStatusBadge } from '../../shared/ui/badge/status-badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkPagination } from '../../shared/ui/pagination/pagination';
import { HkPlaca } from '../../shared/ui/placa/placa';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { ESTADOS_ORDEN, OrdenesApiService } from './ordenes-api.service';

const TAMANO_PAGINA = 12;
const ESTADOS_ACTIVOS = ESTADOS_ORDEN.filter((e) => e !== 'ENTREGADA' && e !== 'CANCELADA');

/**
 * "Mis órdenes" (RN-27): las órdenes activas asignadas al usuario actual en tarjetas grandes,
 * pensadas para el celular del mecánico; las más recientes primero.
 */
@Component({
  selector: 'hk-mis-ordenes-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    LucideDynamicIcon,
    TiempoRelativoPipe,
    HkButton,
    HkEmptyState,
    HkPageHeader,
    HkPagination,
    HkPlaca,
    HkSkeleton,
    HkStatusBadge,
  ],
  template: `
    <hk-page-header
      [titulo]="'taller.mias.titulo' | transloco"
      [subtitulo]="'taller.mias.subtitulo' | transloco"
    />

    @if (ordenes.error()) {
      <hk-empty-state
        icono="circle-alert"
        [titulo]="'taller.tablero.error_titulo' | transloco"
        [texto]="'comun.error_texto' | transloco"
      >
        <button hk-button variante="secondary" icono="rotate-ccw" (click)="ordenes.reload()">
          {{ 'comun.reintentar' | transloco }}
        </button>
      </hk-empty-state>
    } @else if (ordenes.isLoading() && !ordenes.value()) {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        @for (i of [1, 2, 3]; track i) {
          <hk-skeleton variante="rectangulo" alto="9rem" />
        }
      </div>
    } @else if (ordenes.value(); as pagina) {
      @if (pagina.content.length === 0) {
        <hk-empty-state
          icono="wrench"
          [titulo]="'taller.mias.vacio_titulo' | transloco"
          [texto]="'taller.mias.vacio_texto' | transloco"
        />
      } @else {
        <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          @for (o of pagina.content; track o.id) {
            <li>
              <a
                class="flex min-h-36 flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card hk-foco transition-shadow hover:shadow-overlay"
                [routerLink]="['/ordenes', o.id]"
              >
                <span class="flex items-start justify-between gap-3">
                  <hk-placa tamano="lg" [placa]="o.placa" />
                  <hk-status-badge [estado]="o.estado" />
                </span>
                <span class="block">
                  <span class="block font-medium text-fg">{{ o.moto }}</span>
                  <span class="block text-sm text-muted">{{ o.cliente }}</span>
                </span>
                <span class="mt-auto flex items-center justify-between text-xs text-muted">
                  <span class="tabular">{{ o.numero }}</span>
                  <span class="inline-flex items-center gap-1">
                    <svg lucideIcon="calendar" class="size-3.5" aria-hidden="true" />
                    {{ o.fechaIngreso | tiempoRelativo }}
                  </span>
                </span>
              </a>
            </li>
          }
        </ul>
        @if (pagina.totalPages > 1) {
          <hk-pagination
            class="mt-6"
            [pagina]="pagina.page"
            [tamano]="tamanoPagina"
            [total]="pagina.totalElements"
            (paginaCambio)="paginaActual.set($event)"
          />
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisOrdenesPage {
  private readonly api = inject(OrdenesApiService);

  protected readonly tamanoPagina = TAMANO_PAGINA;
  protected readonly paginaActual = signal(0);
  protected readonly ordenes = rxResource({
    params: () => this.paginaActual(),
    stream: ({ params }) =>
      this.api.mias(
        {
          q: '',
          estados: ESTADOS_ACTIVOS,
          mecanicoId: null,
          desde: null,
          hasta: null,
          page: params,
          size: TAMANO_PAGINA,
          sort: 'fechaIngreso,desc',
        },
        erroresManejados(),
      ),
  });
}
