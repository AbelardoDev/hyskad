import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { HkIconButton } from '../../shared/ui/button/icon-button';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { TiempoRelativoPipe } from '../utils/formato.pipes';
import { ICONO_NOTIFICACION, textoNotificacion } from './notificacion-ui';
import { Notificacion } from './notificaciones-api.service';
import { NotificacionesStreamService } from './notificaciones-stream.service';

const POSICION_PANEL: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
];

/**
 * Campana de la topbar (RF30): contador de no leídas con un punto cian que pulsa y panel con las
 * últimas 10, "Marcar todas como leídas" y "Ver todas". Abrir una la marca como leída y lleva a su
 * enlace.
 */
@Component({
  selector: 'hk-campana-notificaciones',
  imports: [
    RouterLink,
    TranslocoPipe,
    LucideDynamicIcon,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    HkIconButton,
    HkEmptyState,
    TiempoRelativoPipe,
  ],
  template: `
    <span class="relative inline-flex">
      <button
        hk-icon-button
        icono="bell"
        cdkOverlayOrigin
        #origen="cdkOverlayOrigin"
        [etiqueta]="etiqueta()"
        [attr.aria-expanded]="abierta()"
        aria-haspopup="dialog"
        (click)="abierta.set(!abierta())"
      ></button>
      @if (stream.noLeidas() > 0) {
        <span
          class="pointer-events-none absolute top-1 right-1 inline-flex min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] leading-4 font-bold text-white tabular"
          aria-hidden="true"
          >{{ stream.noLeidas() > 99 ? '99+' : stream.noLeidas() }}</span
        >
        <span class="pointer-events-none absolute top-0.5 left-1 flex size-2" aria-hidden="true">
          <span
            class="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75"
          ></span>
          <span class="relative inline-flex size-2 rounded-full bg-accent"></span>
        </span>
      }
    </span>
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origen"
      [cdkConnectedOverlayOpen]="abierta()"
      [cdkConnectedOverlayPositions]="posicion"
      (overlayOutsideClick)="abierta.set(false)"
      (overlayKeydown)="$event.key === 'Escape' && abierta.set(false)"
      (detach)="abierta.set(false)"
    >
      <section
        role="dialog"
        class="w-[min(24rem,calc(100vw-2rem))] hk-overlay"
        [attr.aria-label]="'layout.notificaciones' | transloco"
      >
        <header class="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 class="text-sm font-semibold text-fg">{{ 'layout.notificaciones' | transloco }}</h2>
          @if (stream.noLeidas() > 0) {
            <button
              type="button"
              class="rounded-md px-1.5 py-1 text-xs font-medium text-primary hk-foco hover:underline"
              (click)="stream.marcarTodasLeidas()"
            >
              {{ 'notificaciones.marcar_todas' | transloco }}
            </button>
          }
        </header>
        @if (items().length === 0) {
          <hk-empty-state
            compacto
            icono="bell"
            [titulo]="'layout.sin_notificaciones' | transloco"
            [texto]="'layout.sin_notificaciones_texto' | transloco"
          />
        } @else {
          <ul class="max-h-[min(26rem,60dvh)] divide-y divide-border overflow-y-auto">
            @for (item of items(); track item.n.id) {
              <li>
                <button
                  type="button"
                  class="flex w-full gap-3 px-4 py-3 text-start hk-foco hover:bg-surface-2"
                  (click)="abrir(item.n)"
                >
                  <span
                    class="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary"
                    aria-hidden="true"
                  >
                    <svg [lucideIcon]="item.icono" class="size-4" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm text-fg" [class.font-semibold]="!item.n.leida">{{
                      item.titulo
                    }}</span>
                    <span class="block text-xs text-muted">{{ item.mensaje }}</span>
                    <span class="mt-0.5 block text-[0.6875rem] text-muted">{{
                      item.n.fecha | tiempoRelativo
                    }}</span>
                  </span>
                  @if (!item.n.leida) {
                    <span
                      class="mt-2 size-2 shrink-0 rounded-full bg-primary"
                      aria-hidden="true"
                    ></span>
                    <span class="sr-only">{{ 'notificaciones.no_leida' | transloco }}</span>
                  }
                </button>
              </li>
            }
          </ul>
        }
        <footer class="border-t border-border px-4 py-2.5 text-center">
          <a
            routerLink="/notificaciones"
            class="text-sm font-medium text-primary hk-foco hover:underline"
            (click)="abierta.set(false)"
            >{{ 'notificaciones.ver_todas' | transloco }}</a
          >
        </footer>
      </section>
    </ng-template>
  `,
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkCampanaNotificaciones {
  protected readonly stream = inject(NotificacionesStreamService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);

  protected readonly posicion = POSICION_PANEL;
  protected readonly abierta = signal(false);

  /** Cambia al cargar las traducciones o el idioma: los `computed` que traducen la leen. */
  private readonly traducciones = toSignal(this.transloco.selectTranslation());
  protected readonly items = computed(() => {
    this.traducciones();
    return this.stream.recientes().map((n) => ({
      n,
      icono: ICONO_NOTIFICACION[n.tipo],
      ...textoNotificacion(n, this.transloco),
    }));
  });
  protected readonly etiqueta = computed(() => {
    this.traducciones();
    const n = this.stream.noLeidas();
    return n > 0
      ? this.transloco.translate('notificaciones.campana_con', { n })
      : this.transloco.translate('layout.notificaciones');
  });

  protected abrir(n: Notificacion): void {
    this.stream.marcarLeida(n);
    this.abierta.set(false);
    if (n.enlace) void this.router.navigateByUrl(n.enlace);
  }
}
