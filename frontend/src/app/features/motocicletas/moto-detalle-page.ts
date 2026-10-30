import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { HkTienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import { erroresManejados } from '../../core/http/contexto-http';
import { CopPipe, FechaPipe } from '../../core/utils/formato.pipes';
import { HkBadge } from '../../shared/ui/badge/badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkPlaca } from '../../shared/ui/placa/placa';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { HkTabs, Pestana } from '../../shared/ui/tabs/tabs';
import { ToastService } from '../../shared/ui/toast/toast';
import { CambiarPropietarioModal } from './cambiar-propietario-modal';
import { Motocicleta, MotocicletasApiService } from './motocicletas-api.service';
import { DatosFormMoto, MotoFormDrawer } from './moto-form-drawer';

/** Ficha de una moto (RF8, RF9): datos técnicos, propietario (RN-43) e historial de servicios. */
@Component({
  selector: 'hk-moto-detalle-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    LucideDynamicIcon,
    CopPipe,
    FechaPipe,
    HkTienePermisoDirective,
    HkBadge,
    HkButton,
    HkCard,
    HkEmptyState,
    HkPageHeader,
    HkPlaca,
    HkSkeleton,
    HkTabs,
  ],
  template: `
    @if (moto.error()) {
      <hk-empty-state
        class="mt-10"
        icono="bike"
        [titulo]="'motos.detalle.no_encontrada' | transloco"
        [texto]="'motos.detalle.no_encontrada_texto' | transloco"
      >
        <a hk-button variante="secondary" icono="chevron-left" routerLink="/motocicletas">
          {{ 'motos.detalle.volver' | transloco }}
        </a>
      </hk-empty-state>
    } @else if (moto.value(); as m) {
      <hk-page-header [titulo]="m.marca + ' ' + m.modelo" [subtitulo]="subtitulo(m)">
        <ng-container *hkTienePermiso="'MOTOS_GESTIONAR'">
          <button hk-button variante="secondary" icono="pencil" (click)="editar(m)">
            {{ 'comun.editar' | transloco }}
          </button>
          <button
            hk-button
            variante="secondary"
            icono="power"
            (click)="cambiarEstado(m, !m.activo)"
          >
            {{ (m.activo ? 'comun.desactivar' : 'comun.activar') | transloco }}
          </button>
        </ng-container>
      </hk-page-header>

      <div class="mb-6 flex flex-wrap items-center gap-3">
        <hk-placa [placa]="m.placa" tamano="lg" />
        <hk-badge
          [tono]="m.activo ? 'success' : 'neutral'"
          [icono]="m.activo ? 'circle-check' : 'circle-x'"
        >
          {{ (m.activo ? 'comun.estado.activa' : 'comun.estado.inactiva') | transloco }}
        </hk-badge>
      </div>

      <hk-tabs [pestanas]="pestanas()" [(activa)]="pestana" [etiqueta]="'motos.titulo' | transloco">
        @if (pestana() === 'ficha') {
          <div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <hk-card [titulo]="'motos.detalle.ficha' | transloco">
              <dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                @for (dato of ficha(m); track dato.clave) {
                  <div>
                    <dt class="text-xs text-muted">{{ dato.clave | transloco }}</dt>
                    <dd class="mt-0.5 font-medium break-all text-fg">
                      {{ dato.valor ?? ('comun.sin_dato' | transloco) }}
                    </dd>
                  </div>
                }
              </dl>
            </hk-card>
            <hk-card [titulo]="'motos.campos.propietario' | transloco">
              <a
                class="-m-2 flex items-center gap-3 rounded-xl p-2 hk-foco transition-colors hover:bg-surface-2"
                [routerLink]="['/clientes', m.propietario.id]"
              >
                <span
                  class="inline-flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-ink"
                >
                  <svg lucideIcon="user" class="size-5" aria-hidden="true" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium text-fg">
                    {{ m.propietario.nombreCompleto }}
                  </span>
                  <span class="text-xs text-muted">{{
                    'motos.detalle.ver_cliente' | transloco
                  }}</span>
                </span>
                <svg lucideIcon="chevron-right" class="size-4 text-muted" aria-hidden="true" />
              </a>
              <p class="mt-4 text-xs text-muted">{{ 'motos.propietario.ayuda' | transloco }}</p>
              <button
                *hkTienePermiso="'MOTOS_GESTIONAR'"
                hk-button
                variante="secondary"
                icono="users-round"
                class="mt-4 w-full"
                (click)="cambiarPropietario(m)"
              >
                {{ 'motos.propietario.titulo' | transloco }}
              </button>
            </hk-card>
          </div>
        } @else {
          <hk-card>
            @if (historial.isLoading()) {
              <hk-skeleton [lineas]="4" />
            } @else if (historial.error()) {
              <hk-empty-state
                compacto
                icono="circle-alert"
                [titulo]="'motos.historial.error' | transloco"
              >
                <button
                  hk-button
                  variante="secondary"
                  icono="rotate-ccw"
                  (click)="historial.reload()"
                >
                  {{ 'comun.reintentar' | transloco }}
                </button>
              </hk-empty-state>
            } @else {
              @let ordenes = historial.value() ?? [];
              @if (ordenes.length === 0) {
                <hk-empty-state
                  compacto
                  icono="wrench"
                  [titulo]="'motos.historial.vacio_titulo' | transloco"
                  [texto]="'motos.historial.vacio_texto' | transloco"
                />
              } @else {
                <ol class="divide-y divide-border">
                  @for (orden of ordenes; track orden.ordenId) {
                    <li class="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div>
                        <p class="font-medium text-fg">{{ orden.numero }}</p>
                        <p class="text-xs text-muted">{{ orden.fechaIngreso | fecha }}</p>
                      </div>
                      <p class="font-semibold text-fg tabular">{{ orden.total | cop }}</p>
                    </li>
                  }
                </ol>
              }
            }
          </hk-card>
        }
      </hk-tabs>
    } @else {
      <div class="space-y-6" aria-busy="true">
        <hk-skeleton ancho="40%" alto="2rem" />
        <hk-skeleton variante="rectangulo" alto="12rem" />
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotoDetallePage {
  private readonly api = inject(MotocicletasApiService);
  private readonly dialogos = inject(DialogosService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly id = input.required({ transform: numberAttribute });

  protected readonly pestana = signal('ficha');
  protected readonly moto = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.obtener(params, erroresManejados()),
  });
  protected readonly historial = rxResource({
    params: () => (this.pestana() === 'historial' ? this.id() : undefined),
    stream: ({ params }) => this.api.historial(params, erroresManejados()),
  });

  private readonly textosPestanas = translateSignal([
    'motos.detalle.ficha',
    'motos.historial.titulo',
  ]);
  protected readonly pestanas = computed<Pestana[]>(() => {
    const [ficha, historial] = this.textosPestanas();
    return [
      { id: 'ficha', etiqueta: ficha, icono: 'bike' },
      { id: 'historial', etiqueta: historial, icono: 'clipboard-list' },
    ];
  });

  protected subtitulo(moto: Motocicleta): string {
    return this.transloco.translate('motos.detalle.subtitulo', {
      propietario: moto.propietario.nombreCompleto,
    });
  }

  protected ficha(moto: Motocicleta): { clave: string; valor: string | number | null }[] {
    return [
      { clave: 'motos.campos.marca', valor: moto.marca },
      { clave: 'motos.campos.modelo', valor: moto.modelo },
      { clave: 'motos.campos.anio', valor: moto.anio },
      {
        clave: 'motos.campos.cilindrada',
        valor: moto.cilindradaCc ? `${moto.cilindradaCc} cc` : null,
      },
      { clave: 'motos.campos.color', valor: moto.color },
      { clave: 'motos.campos.vin', valor: moto.vin },
    ];
  }

  protected editar(moto: Motocicleta): void {
    this.dialogos
      .abrirDrawer<MotoFormDrawer, DatosFormMoto, Motocicleta>(MotoFormDrawer, { datos: { moto } })
      .closed.subscribe((guardada) => {
        if (!guardada) return;
        this.toast.exito(this.transloco.translate('motos.actualizada', { placa: guardada.placa }));
        this.moto.set(guardada);
      });
  }

  protected cambiarPropietario(moto: Motocicleta): void {
    this.dialogos
      .abrirModal<CambiarPropietarioModal, Motocicleta, Motocicleta>(CambiarPropietarioModal, {
        datos: moto,
      })
      .closed.subscribe((actualizada) => {
        if (!actualizada) return;
        this.toast.exito(
          this.transloco.translate('motos.propietario.cambiado', {
            placa: actualizada.placa,
            nombre: actualizada.propietario.nombreCompleto,
          }),
        );
        this.moto.set(actualizada);
      });
  }

  protected async cambiarEstado(moto: Motocicleta, activo: boolean): Promise<void> {
    const prefijo = activo ? 'motos.confirmar_activar' : 'motos.confirmar_desactivar';
    const confirmado = await this.confirmacion.pedir({
      titulo: this.transloco.translate(`${prefijo}.titulo`),
      mensaje: this.transloco.translate(`${prefijo}.mensaje`, { placa: moto.placa }),
      textoConfirmar: this.transloco.translate(activo ? 'comun.activar' : 'comun.desactivar'),
      peligrosa: !activo,
    });
    if (!confirmado) return;
    this.api.cambiarEstado(moto.id, activo).subscribe((actualizada) => {
      this.toast.exito(
        this.transloco.translate(activo ? 'motos.activada' : 'motos.desactivada', {
          placa: actualizada.placa,
        }),
      );
      this.moto.set(actualizada);
    });
  }
}
