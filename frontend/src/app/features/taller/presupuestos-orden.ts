import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Observable } from 'rxjs';

import { erroresManejados } from '../../core/http/contexto-http';
import { CantidadPipe, CopPipe, FechaPipe } from '../../core/utils/formato.pipes';
import { HkBadge, TonoBadge } from '../../shared/ui/badge/badge';
import { HkButton } from '../../shared/ui/button/button';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { ToastService } from '../../shared/ui/toast/toast';
import { EnviarPresupuestoModal } from './enviar-presupuesto-modal';
import { EstadoPresupuesto, Orden, OrdenesApiService, Presupuesto } from './ordenes-api.service';

const ESTILO: Record<EstadoPresupuesto, { tono: TonoBadge; icono: string }> = {
  PENDIENTE: { tono: 'warning', icono: 'hourglass' },
  APROBADO: { tono: 'success', icono: 'circle-check' },
  RECHAZADO: { tono: 'danger', icono: 'circle-x' },
  REEMPLAZADO: { tono: 'neutral', icono: 'undo-2' },
};

/**
 * Presupuestos de la orden (RF22, RF23): enviar uno nuevo, ver todas las versiones con su estado y,
 * para la pendiente, aprobar, rechazar o retirar con confirmación (RN-33). Cada decisión cambia el
 * estado de la orden, así que avisa al detalle para que la relea.
 */
@Component({
  selector: 'hk-presupuestos-orden',
  imports: [
    RouterLink,
    TranslocoPipe,
    CantidadPipe,
    CopPipe,
    FechaPipe,
    HkBadge,
    HkButton,
    HkEmptyState,
    HkSkeleton,
  ],
  template: `
    @if (puedeEnviar()) {
      <div class="mb-5 flex justify-end">
        <button hk-button icono="hourglass" class="max-sm:w-full" (click)="enviar()">
          {{ 'taller.acciones.enviar_presupuesto' | transloco }}
        </button>
      </div>
    }
    @if (presupuestos.error()) {
      <hk-empty-state
        compacto
        icono="circle-alert"
        [titulo]="'taller.presupuestos.error' | transloco"
      >
        <button hk-button variante="secondary" icono="rotate-ccw" (click)="presupuestos.reload()">
          {{ 'comun.reintentar' | transloco }}
        </button>
      </hk-empty-state>
    } @else if (presupuestos.isLoading() && !presupuestos.value()) {
      <hk-skeleton variante="rectangulo" alto="8rem" />
    } @else if ((presupuestos.value() ?? []).length === 0) {
      <hk-empty-state
        compacto
        icono="hourglass"
        [titulo]="'taller.presupuestos.vacio' | transloco"
        [texto]="'taller.presupuestos.vacio_texto' | transloco"
      />
    } @else {
      <ol class="space-y-4">
        @for (p of presupuestos.value(); track p.id) {
          <li class="rounded-xl border border-border p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="font-display font-semibold text-fg">
                  {{ p.numero }}
                  <span class="text-sm font-normal text-muted">
                    · {{ 'taller.presupuestos.version' | transloco: { version: p.version } }}
                  </span>
                </p>
                <p class="text-xs text-muted">
                  {{ p.fechaEnvio | fecha: 'fechaHora' }} · {{ p.enviadoPor?.nombre ?? '—' }}
                </p>
              </div>
              <div class="flex items-center gap-3">
                <hk-badge [tono]="estilo(p).tono" [icono]="estilo(p).icono">
                  {{ 'taller.presupuestos.estados.' + p.estado | transloco }}
                </hk-badge>
                <span class="font-display text-lg font-bold text-fg tabular">{{
                  p.total | cop
                }}</span>
              </div>
            </div>
            <details class="mt-3 text-sm">
              <summary class="cursor-pointer text-primary hk-foco">
                {{ 'taller.presupuestos.ver_items' | transloco: { n: p.items.length } }}
              </summary>
              <ul class="mt-2 divide-y divide-border">
                @for (i of p.items; track $index) {
                  <li class="flex justify-between gap-3 py-1.5">
                    <span class="text-fg">
                      {{ i.descripcion }}
                      @if (i.tipo === 'REPUESTO') {
                        × {{ i.cantidad | cantidad }}
                      }
                    </span>
                    <span class="text-fg tabular">{{ i.subtotal | cop }}</span>
                  </li>
                }
              </ul>
            </details>
            @if (p.observaciones) {
              <p class="mt-2 text-sm text-muted">{{ p.observaciones }}</p>
            }
            @if (p.observacionesDecision) {
              <p class="mt-1 text-sm text-fg">
                {{ p.decididoPor?.nombre }}: “{{ p.observacionesDecision }}”
              </p>
            }
            <div class="mt-4 flex flex-wrap gap-2">
              <a
                hk-button
                variante="secondary"
                icono="printer"
                tamano="sm"
                [routerLink]="['/presupuestos', p.id]"
              >
                {{ 'taller.presupuestos.imprimir' | transloco }}
              </a>
              @if (p.estado === 'PENDIENTE' && orden().accionesPermitidas.gestionarPresupuestos) {
                <button
                  hk-button
                  icono="circle-check"
                  tamano="sm"
                  [cargando]="trabajando() === 'APROBADO'"
                  (click)="decidir(p, 'APROBADO')"
                >
                  {{ 'taller.presupuestos.aprobar' | transloco }}
                </button>
                <button
                  hk-button
                  variante="danger"
                  icono="circle-x"
                  tamano="sm"
                  [cargando]="trabajando() === 'RECHAZADO'"
                  (click)="decidir(p, 'RECHAZADO')"
                >
                  {{ 'taller.presupuestos.rechazar' | transloco }}
                </button>
                <button
                  hk-button
                  variante="ghost"
                  icono="undo-2"
                  tamano="sm"
                  [cargando]="trabajando() === 'RETIRO'"
                  (click)="retirar(p)"
                >
                  {{ 'taller.acciones.retirar_presupuesto' | transloco }}
                </button>
              }
            </div>
          </li>
        }
      </ol>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkPresupuestosOrden {
  private readonly api = inject(OrdenesApiService);
  private readonly dialogos = inject(DialogosService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly orden = input.required<Orden>();
  /** La orden cambió de estado: el detalle la relee. */
  readonly cambio = output<void>();
  protected readonly trabajando = signal<'APROBADO' | 'RECHAZADO' | 'RETIRO' | null>(null);

  protected readonly presupuestos = rxResource({
    params: () => ({ id: this.orden().id, version: this.orden().version }),
    stream: ({ params }) => this.api.presupuestos(params.id, erroresManejados()),
  });
  /** La transición a pendiente de aprobación está disponible y sin bloqueo. */
  protected readonly puedeEnviar = computed(() =>
    this.orden().accionesPermitidas.transiciones.some(
      (t) => t.estado === 'PENDIENTE_APROBACION' && !t.bloqueo,
    ),
  );

  protected estilo(p: Presupuesto) {
    return ESTILO[p.estado];
  }

  enviar(): void {
    this.dialogos
      .abrirModal<EnviarPresupuestoModal, Orden, Presupuesto>(EnviarPresupuestoModal, {
        datos: this.orden(),
        tamano: 'lg',
        hojaEnMovil: true,
      })
      .closed.subscribe((presupuesto) => {
        if (!presupuesto) return;
        this.toast.exito(
          this.transloco.translate('taller.presupuestos.enviado', { numero: presupuesto.numero }),
        );
        this.cambio.emit();
      });
  }

  protected async decidir(p: Presupuesto, decision: 'APROBADO' | 'RECHAZADO'): Promise<void> {
    const clave = decision === 'APROBADO' ? 'aprobar' : 'rechazar';
    const resultado = await this.confirmacion.pedir({
      titulo: this.transloco.translate(`taller.presupuestos.confirmar_${clave}.titulo`, {
        numero: p.numero,
      }),
      mensaje: this.transloco.translate(`taller.presupuestos.confirmar_${clave}.mensaje`),
      textoConfirmar: this.transloco.translate(`taller.presupuestos.${clave}`),
      peligrosa: decision === 'RECHAZADO',
      pedirMotivo: decision === 'RECHAZADO',
      minimoMotivo: 3,
    });
    if (!resultado) return;
    this.ejecutar(decision, this.api.decidirPresupuesto(p.id, decision, resultado.motivo ?? null));
  }

  protected async retirar(p: Presupuesto): Promise<void> {
    const resultado = await this.confirmacion.pedir({
      titulo: this.transloco.translate('taller.presupuestos.confirmar_retirar.titulo', {
        numero: p.numero,
      }),
      mensaje: this.transloco.translate('taller.confirmar_transicion.retirar_presupuesto'),
      textoConfirmar: this.transloco.translate('taller.acciones.retirar_presupuesto'),
    });
    if (!resultado) return;
    this.ejecutar('RETIRO', this.api.retirarPresupuesto(p.id));
  }

  private ejecutar(
    accion: 'APROBADO' | 'RECHAZADO' | 'RETIRO',
    peticion: Observable<Presupuesto>,
  ): void {
    this.trabajando.set(accion);
    peticion.subscribe({
      next: (p) => {
        this.trabajando.set(null);
        this.toast.exito(
          this.transloco.translate(`taller.presupuestos.hecho.${accion}`, { numero: p.numero }),
        );
        this.cambio.emit();
      },
      error: () => {
        this.trabajando.set(null);
        this.cambio.emit();
      },
    });
  }
}
