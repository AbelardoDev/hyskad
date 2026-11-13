import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { HkTienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import { erroresManejados } from '../../core/http/contexto-http';
import { CantidadPipe, CopPipe, FechaPipe } from '../../core/utils/formato.pipes';
import { HkStatusBadge } from '../../shared/ui/badge/status-badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkSwitch } from '../../shared/ui/forms/switch';
import { HkPagination } from '../../shared/ui/pagination/pagination';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { HistorialServicio, MotocicletasApiService } from './motocicletas-api.service';

const TAMANO = 10;

/** Una entrada del historial con su lectura de kilometraje y lo recorrido desde la anterior. */
export interface EntradaHistorial {
  orden: HistorialServicio;
  kilometraje: number;
  recorrido: number | null;
}

/**
 * La lectura de cada orden (la de inspección si la hay; si no, la de ingreso) y la diferencia con
 * la orden anterior de la lista, que viene de la más reciente a la más antigua.
 */
export function progresionKilometraje(ordenes: readonly HistorialServicio[]): EntradaHistorial[] {
  const lectura = (o: HistorialServicio) => o.kilometrajeInspeccion ?? o.kilometrajeIngreso;
  return ordenes.map((orden, i) => {
    const anterior = ordenes[i + 1];
    return {
      orden,
      kilometraje: lectura(orden),
      recorrido: anterior ? lectura(orden) - lectura(anterior) : null,
    };
  });
}

/**
 * Historial de servicios de la moto (RF9): línea de tiempo vertical, de la orden más reciente a la
 * más antigua, con cada entrada expandible y el kilometraje como progresión.
 */
@Component({
  selector: 'hk-historial-moto',
  imports: [
    FormsModule,
    RouterLink,
    TranslocoPipe,
    LucideDynamicIcon,
    CantidadPipe,
    CopPipe,
    FechaPipe,
    HkTienePermisoDirective,
    HkButton,
    HkEmptyState,
    HkPagination,
    HkSkeleton,
    HkStatusBadge,
    HkSwitch,
  ],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 class="font-display text-base font-semibold text-fg">
        {{ 'motos.historial.titulo' | transloco }}
      </h2>
      <hk-switch [ngModel]="incluirCanceladas()" (ngModelChange)="cambiarCanceladas($event)">
        {{ 'motos.historial.incluir_canceladas' | transloco }}
      </hk-switch>
    </div>

    @if (historial.isLoading() && !historial.hasValue()) {
      <hk-skeleton [lineas]="4" />
    } @else if (historial.error()) {
      <hk-empty-state compacto icono="circle-alert" [titulo]="'motos.historial.error' | transloco">
        <button hk-button variante="secondary" icono="rotate-ccw" (click)="historial.reload()">
          {{ 'comun.reintentar' | transloco }}
        </button>
      </hk-empty-state>
    } @else if (entradas().length === 0) {
      <hk-empty-state
        compacto
        icono="wrench"
        [titulo]="'motos.historial.vacio_titulo' | transloco"
        [texto]="'motos.historial.vacio_texto' | transloco"
      />
    } @else {
      <ol class="relative ms-4 border-s-2 border-border" [attr.aria-busy]="historial.isLoading()">
        @for (e of entradas(); track e.orden.ordenId) {
          @let abierta = abiertas().has(e.orden.ordenId);
          <li class="relative ps-6 pb-6 last:pb-0">
            <span
              class="absolute -start-[0.5625rem] top-1.5 size-4 rounded-full border-2 border-surface"
              [class]="e.orden.estado === 'CANCELADA' ? 'bg-danger' : 'bg-primary'"
              aria-hidden="true"
            ></span>
            <button
              type="button"
              class="flex w-full flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-xl p-2 text-start hk-foco hover:bg-surface-2"
              [attr.aria-expanded]="abierta"
              [attr.aria-controls]="'historial-' + e.orden.ordenId"
              (click)="alternar(e.orden.ordenId)"
            >
              <span class="min-w-0">
                <span class="flex flex-wrap items-center gap-2">
                  <span class="font-semibold text-fg">{{ e.orden.numero }}</span>
                  <hk-status-badge [estado]="e.orden.estado" />
                </span>
                <span class="mt-1 block text-xs text-muted">
                  {{ e.orden.fechaIngreso | fecha }} · {{ e.orden.motivoIngreso }}
                </span>
              </span>
              <span class="flex items-center gap-4">
                <span class="text-end">
                  <span class="block text-sm font-medium text-fg tabular"
                    >{{ e.kilometraje | cantidad }} km</span
                  >
                  @if (e.recorrido !== null) {
                    <span class="block text-xs text-muted tabular">
                      {{
                        'motos.historial.recorrido' | transloco: { km: (e.recorrido | cantidad) }
                      }}
                    </span>
                  }
                </span>
                <span class="font-semibold text-fg tabular">{{ e.orden.total | cop }}</span>
                <svg
                  [lucideIcon]="abierta ? 'chevron-up' : 'chevron-down'"
                  class="size-4 text-muted"
                  aria-hidden="true"
                />
              </span>
            </button>

            @if (abierta) {
              <div [id]="'historial-' + e.orden.ordenId" class="mt-2 space-y-4 px-2 text-sm">
                @if (e.orden.diagnostico) {
                  <div>
                    <p class="text-xs font-medium text-muted">
                      {{ 'taller.detalle.pestanas.diagnostico' | transloco }}
                    </p>
                    <p class="mt-1 whitespace-pre-line text-fg">{{ e.orden.diagnostico }}</p>
                  </div>
                }
                @if (e.orden.servicios.length > 0) {
                  <div>
                    <p class="text-xs font-medium text-muted">
                      {{ 'taller.items.servicios' | transloco }}
                    </p>
                    <ul class="mt-1 divide-y divide-border">
                      @for (s of e.orden.servicios; track $index) {
                        <li class="flex justify-between gap-3 py-1.5">
                          <span class="text-fg">{{ s.descripcion }}</span>
                          <span class="text-fg tabular">{{ s.precio | cop }}</span>
                        </li>
                      }
                    </ul>
                  </div>
                }
                @if (e.orden.repuestos.length > 0) {
                  <div>
                    <p class="text-xs font-medium text-muted">
                      {{ 'taller.items.repuestos' | transloco }}
                    </p>
                    <ul class="mt-1 divide-y divide-border">
                      @for (r of e.orden.repuestos; track $index) {
                        <li class="flex justify-between gap-3 py-1.5">
                          <span class="text-fg">
                            {{ r.cantidad | cantidad }} × {{ r.nombre }}
                            <span class="text-xs text-muted">· {{ r.codigo }}</span>
                          </span>
                          <span class="text-fg tabular">{{ r.subtotal | cop }}</span>
                        </li>
                      }
                    </ul>
                  </div>
                }
                <p class="text-xs text-muted">
                  {{ 'taller.campos.mecanicos' | transloco }}:
                  {{ e.orden.mecanicos.join(', ') || ('comun.sin_dato' | transloco) }}
                  @if (e.orden.fechaEntrega) {
                    ·
                    {{
                      'motos.historial.entregada'
                        | transloco: { fecha: (e.orden.fechaEntrega | fecha) }
                    }}
                  }
                </p>
                <a
                  *hkTienePermiso="'ORDENES_VER_TODAS'"
                  class="inline-flex items-center gap-1 text-sm text-primary underline hk-foco"
                  [routerLink]="['/ordenes', e.orden.ordenId]"
                >
                  {{ 'motos.historial.ver_orden' | transloco }}
                  <svg lucideIcon="chevron-right" class="size-4" aria-hidden="true" />
                </a>
              </div>
            }
          </li>
        }
      </ol>
      @if (totalElementos() > tamano) {
        <hk-pagination
          class="mt-6"
          [pagina]="pagina()"
          [tamano]="tamano"
          [total]="totalElementos()"
          (paginaCambio)="pagina.set($event)"
        />
      }
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkHistorialMoto {
  private readonly api = inject(MotocicletasApiService);

  readonly motocicletaId = input.required<number>();

  protected readonly tamano = TAMANO;
  protected readonly pagina = signal(0);
  protected readonly incluirCanceladas = signal(false);
  protected readonly abiertas = signal<ReadonlySet<number>>(new Set());

  protected readonly historial = rxResource({
    params: () => ({
      id: this.motocicletaId(),
      incluirCanceladas: this.incluirCanceladas(),
      page: this.pagina(),
    }),
    stream: ({ params }) =>
      this.api.historial(
        params.id,
        { incluirCanceladas: params.incluirCanceladas, page: params.page, size: TAMANO },
        erroresManejados(),
      ),
  });
  protected readonly entradas = computed(() =>
    progresionKilometraje(this.historial.value()?.content ?? []),
  );
  protected readonly totalElementos = computed(() => this.historial.value()?.totalElements ?? 0);

  protected cambiarCanceladas(valor: boolean): void {
    this.incluirCanceladas.set(valor);
    this.pagina.set(0);
  }

  protected alternar(ordenId: number): void {
    this.abiertas.update((actual) => {
      const nuevas = new Set(actual);
      if (!nuevas.delete(ordenId)) nuevas.add(ordenId);
      return nuevas;
    });
  }
}
