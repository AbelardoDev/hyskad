import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { erroresManejados } from '../../core/http/contexto-http';
import { ICONO_NOTIFICACION, textoNotificacion } from '../../core/realtime/notificacion-ui';
import {
  Notificacion,
  NotificacionesApiService,
} from '../../core/realtime/notificaciones-api.service';
import { NotificacionesStreamService } from '../../core/realtime/notificaciones-stream.service';
import { FechaPipe, TiempoRelativoPipe } from '../../core/utils/formato.pipes';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkPagination } from '../../shared/ui/pagination/pagination';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';

const TAMANO = 20;

/** Todas las notificaciones del usuario (RF30), con filtro de no leídas. */
@Component({
  selector: 'hk-notificaciones-page',
  imports: [
    TranslocoPipe,
    LucideDynamicIcon,
    FechaPipe,
    TiempoRelativoPipe,
    HkButton,
    HkCard,
    HkEmptyState,
    HkPageHeader,
    HkPagination,
    HkSkeleton,
  ],
  template: `
    <hk-page-header
      [titulo]="'notificaciones.titulo' | transloco"
      [subtitulo]="'notificaciones.subtitulo' | transloco"
    >
      @if (stream.noLeidas() > 0) {
        <button hk-button variante="secondary" icono="check" (click)="marcarTodas()">
          {{ 'notificaciones.marcar_todas' | transloco }}
        </button>
      }
    </hk-page-header>

    <hk-card>
      <div
        class="mb-4 inline-flex rounded-xl border border-border bg-surface p-1"
        role="group"
        [attr.aria-label]="'notificaciones.filtro' | transloco"
      >
        @for (f of filtros; track f.id) {
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 text-sm font-medium hk-foco"
            [class]="
              soloNoLeidas() === f.valor
                ? 'bg-primary text-primary-fg'
                : 'text-fg hover:bg-surface-2'
            "
            [attr.aria-pressed]="soloNoLeidas() === f.valor"
            (click)="filtrar(f.valor)"
          >
            {{ 'notificaciones.filtros.' + f.id | transloco }}
          </button>
        }
      </div>

      @if (pagina.error()) {
        <hk-empty-state
          compacto
          icono="circle-alert"
          [titulo]="'notificaciones.error' | transloco"
          [texto]="'comun.error_texto' | transloco"
        >
          <button hk-button variante="secondary" icono="rotate-ccw" (click)="pagina.reload()">
            {{ 'comun.reintentar' | transloco }}
          </button>
        </hk-empty-state>
      } @else if (pagina.isLoading() && !pagina.hasValue()) {
        <hk-skeleton [lineas]="5" />
      } @else if (items().length === 0) {
        <hk-empty-state
          compacto
          icono="bell"
          [titulo]="
            (soloNoLeidas() ? 'notificaciones.vacio_no_leidas' : 'layout.sin_notificaciones')
              | transloco
          "
          [texto]="'layout.sin_notificaciones_texto' | transloco"
        />
      } @else {
        <ul class="divide-y divide-border" [attr.aria-busy]="pagina.isLoading()">
          @for (item of items(); track item.n.id) {
            <li>
              <button
                type="button"
                class="flex w-full gap-3 rounded-xl px-3 py-3 text-start hk-foco hover:bg-surface-2"
                (click)="abrir(item.n)"
              >
                <span
                  class="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary"
                  aria-hidden="true"
                >
                  <svg [lucideIcon]="item.icono" class="size-4" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-fg" [class.font-semibold]="!item.n.leida">{{
                    item.titulo
                  }}</span>
                  <span class="block text-sm text-muted">{{ item.mensaje }}</span>
                </span>
                <span class="shrink-0 text-end text-xs text-muted">
                  <span class="block">{{ item.n.fecha | tiempoRelativo }}</span>
                  <span class="block max-sm:hidden">{{ item.n.fecha | fecha: 'fechaHora' }}</span>
                  @if (!item.n.leida) {
                    <span
                      class="mt-1 inline-block size-2 rounded-full bg-primary"
                      aria-hidden="true"
                    ></span>
                    <span class="sr-only">{{ 'notificaciones.no_leida' | transloco }}</span>
                  }
                </span>
              </button>
            </li>
          }
        </ul>
        @if ((pagina.value()?.totalElements ?? 0) > tamano) {
          <hk-pagination
            class="mt-4"
            [pagina]="numeroPagina()"
            [tamano]="tamano"
            [total]="pagina.value()?.totalElements ?? 0"
            (paginaCambio)="numeroPagina.set($event)"
          />
        }
      }
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificacionesPage {
  private readonly api = inject(NotificacionesApiService);
  protected readonly stream = inject(NotificacionesStreamService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);

  protected readonly tamano = TAMANO;
  protected readonly filtros = [
    { id: 'todas', valor: false },
    { id: 'no_leidas', valor: true },
  ] as const;
  protected readonly soloNoLeidas = signal(false);
  protected readonly numeroPagina = signal(0);
  protected readonly pagina = rxResource({
    params: () => ({
      soloNoLeidas: this.soloNoLeidas(),
      page: this.numeroPagina(),
      nuevas: this.stream.noLeidas(),
    }),
    stream: ({ params }) =>
      this.api.listar(
        { soloNoLeidas: params.soloNoLeidas, page: params.page, size: TAMANO },
        erroresManejados(),
      ),
  });

  private readonly traducciones = toSignal(this.transloco.selectTranslation());
  protected readonly items = computed(() => {
    this.traducciones();
    return (this.pagina.value()?.content ?? []).map((n) => ({
      n,
      icono: ICONO_NOTIFICACION[n.tipo],
      ...textoNotificacion(n, this.transloco),
    }));
  });

  protected filtrar(soloNoLeidas: boolean): void {
    this.soloNoLeidas.set(soloNoLeidas);
    this.numeroPagina.set(0);
  }

  protected abrir(n: Notificacion): void {
    this.stream.marcarLeida(n);
    if (n.enlace) void this.router.navigateByUrl(n.enlace);
  }

  protected marcarTodas(): void {
    this.stream.marcarTodasLeidas();
  }
}
