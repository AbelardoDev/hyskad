import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { erroresManejados } from '../../core/http/contexto-http';
import { TiempoRelativoPipe } from '../../core/utils/formato.pipes';
import { EstadoOrden, HkStatusBadge } from '../../shared/ui/badge/status-badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkPlaca } from '../../shared/ui/placa/placa';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { OrdenesApiService, OrdenResumen } from './ordenes-api.service';

/** Cuántas órdenes activas se traen de una vez (un mecánico tiene pocas a la vez). */
const MAXIMO = 100;

/** Grupos de "Mis órdenes", en el orden en que el mecánico las trabaja. */
export const GRUPOS_MIS_ORDENES: readonly { clave: string; estados: readonly EstadoOrden[] }[] = [
  { clave: 'por_diagnosticar', estados: ['RECIBIDA', 'EN_DIAGNOSTICO'] },
  { clave: 'esperando_aprobacion', estados: ['PENDIENTE_APROBACION'] },
  { clave: 'en_reparacion', estados: ['EN_REPARACION'] },
  { clave: 'finalizadas', estados: ['FINALIZADA'] },
];

export interface GrupoOrdenes {
  clave: string;
  ordenes: OrdenResumen[];
}

/** Agrupa las órdenes por estado; omite los grupos vacíos y conserva el orden recibido. */
export function agruparMisOrdenes(ordenes: readonly OrdenResumen[]): GrupoOrdenes[] {
  return GRUPOS_MIS_ORDENES.map((g) => ({
    clave: g.clave,
    ordenes: ordenes.filter((o) => g.estados.includes(o.estado)),
  })).filter((g) => g.ordenes.length > 0);
}

/**
 * "Mis órdenes" (RN-27, IU6): las órdenes activas asignadas al usuario actual, pensada para el
 * celular del mecánico. Tarjetas grandes agrupadas por estado, con la placa, la moto, el motivo y
 * cuánto lleva en el taller; las más antiguas primero dentro de cada grupo. Es la página de inicio
 * de quien solo ve sus órdenes asignadas.
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
    } @else if (ordenes.isLoading() && !ordenes.hasValue()) {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        @for (i of [1, 2, 3]; track i) {
          <hk-skeleton variante="rectangulo" alto="10rem" />
        }
      </div>
    } @else if (grupos().length === 0) {
      <hk-empty-state
        icono="wrench"
        [titulo]="'taller.mias.vacio_titulo' | transloco"
        [texto]="'taller.mias.vacio_texto' | transloco"
      />
    } @else {
      <div class="space-y-8">
        @for (g of grupos(); track g.clave) {
          <section [attr.aria-labelledby]="'grupo-' + g.clave">
            <h2
              [id]="'grupo-' + g.clave"
              class="mb-3 flex items-center gap-2 font-display text-base font-semibold text-fg"
            >
              {{ 'taller.mias.grupos.' + g.clave | transloco }}
              <span
                class="inline-flex min-w-6 items-center justify-center rounded-full bg-surface-2 px-2 text-xs text-muted tabular"
                >{{ g.ordenes.length }}</span
              >
            </h2>
            <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              @for (o of g.ordenes; track o.id) {
                <li>
                  <a
                    class="flex min-h-40 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card hk-foco transition-shadow hover:shadow-overlay active:bg-surface-2"
                    [routerLink]="['/ordenes', o.id]"
                  >
                    <span class="flex items-start justify-between gap-3">
                      <hk-placa tamano="lg" [placa]="o.placa" />
                      <hk-status-badge [estado]="o.estado" />
                    </span>
                    <span class="block">
                      <span class="block text-base font-semibold text-fg">{{ o.moto }}</span>
                      <span class="mt-0.5 line-clamp-2 block text-sm text-muted">{{
                        o.motivoIngreso
                      }}</span>
                    </span>
                    <span class="mt-auto flex items-center justify-between text-sm text-muted">
                      <span class="tabular">{{ o.numero }}</span>
                      <span class="inline-flex items-center gap-1.5">
                        <svg lucideIcon="clock" class="size-4" aria-hidden="true" />
                        {{ o.fechaIngreso | tiempoRelativo }}
                      </span>
                    </span>
                  </a>
                </li>
              }
            </ul>
          </section>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisOrdenesPage {
  private readonly api = inject(OrdenesApiService);

  protected readonly ordenes = rxResource({
    stream: () =>
      this.api.mias(
        {
          q: '',
          estados: GRUPOS_MIS_ORDENES.flatMap((g) => g.estados),
          mecanicoId: null,
          desde: null,
          hasta: null,
          page: 0,
          size: MAXIMO,
          sort: 'fechaIngreso,asc',
        },
        erroresManejados(),
      ),
  });
  protected readonly grupos = computed(() =>
    agruparMisOrdenes(this.ordenes.value()?.content ?? []),
  );
}
