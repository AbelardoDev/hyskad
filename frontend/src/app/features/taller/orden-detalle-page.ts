import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { erroresManejados } from '../../core/http/contexto-http';
import { LanguageService } from '../../core/i18n/language.service';
import { formatoFecha } from '../../core/utils/formato';
import { CantidadPipe, FechaPipe, TiempoRelativoPipe } from '../../core/utils/formato.pipes';
import { documentoParaMostrar } from '../../core/utils/validadores';
import { HkAvatar } from '../../shared/ui/avatar/avatar';
import { EstadoOrden, HkStatusBadge } from '../../shared/ui/badge/status-badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkPlaca } from '../../shared/ui/placa/placa';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { HkStepper, Paso } from '../../shared/ui/stepper/stepper';
import { HkTabs, Pestana } from '../../shared/ui/tabs/tabs';
import { ToastService } from '../../shared/ui/toast/toast';
import { HkTooltipDirective } from '../../shared/ui/tooltip/tooltip';
import { HkDiagnosticoForm } from './diagnostico-form';
import { EnviarPresupuestoModal } from './enviar-presupuesto-modal';
import { HkItemsOrden } from './items-orden';
import { HkPresupuestosOrden } from './presupuestos-orden';
import { MecanicosModal } from './mecanicos-modal';
import { accionTransicion } from './orden-ui';
import { Orden, OrdenesApiService, Presupuesto, TransicionPermitida } from './ordenes-api.service';
import { RecepcionFormDrawer } from './recepcion-form-drawer';

/** El camino normal de una orden (la línea de tiempo); CANCELADA se marca sobre el último paso. */
const FLUJO: readonly EstadoOrden[] = [
  'RECIBIDA',
  'EN_DIAGNOSTICO',
  'PENDIENTE_APROBACION',
  'EN_REPARACION',
  'FINALIZADA',
  'ENTREGADA',
];

/** La última vez que la orden llegó a `estado` (el target de TypeScript no tiene `findLast`). */
function ultimaLlegada(
  historial: Orden['historial'],
  estado: EstadoOrden,
): Orden['historial'][number] | undefined {
  return [...historial].reverse().find((h) => h.estadoNuevo === estado);
}

/**
 * Detalle de una orden (RF11–RF14): encabezado, línea de tiempo, acciones según
 * `accionesPermitidas` (lo decide el backend) y pestañas. El pago llega en F09C: su pestaña se ve
 * deshabilitada.
 */
@Component({
  selector: 'hk-orden-detalle-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    LucideDynamicIcon,
    CantidadPipe,
    FechaPipe,
    TiempoRelativoPipe,
    HkAvatar,
    HkButton,
    HkCard,
    HkDiagnosticoForm,
    HkItemsOrden,
    HkPresupuestosOrden,
    HkEmptyState,
    HkPageHeader,
    HkPlaca,
    HkSkeleton,
    HkStatusBadge,
    HkStepper,
    HkTabs,
    HkTooltipDirective,
  ],
  template: `
    @if (orden.error()) {
      <hk-empty-state
        class="mt-10"
        icono="wrench"
        [titulo]="'taller.detalle.no_encontrada' | transloco"
        [texto]="'taller.detalle.no_encontrada_texto' | transloco"
      >
        <a hk-button variante="secondary" icono="chevron-left" routerLink="/ordenes">
          {{ 'taller.detalle.volver' | transloco }}
        </a>
      </hk-empty-state>
    } @else if (orden.value(); as o) {
      <hk-page-header
        [titulo]="'taller.detalle.titulo' | transloco: { numero: o.numero }"
        [subtitulo]="
          'taller.detalle.ingreso' | transloco: { fecha: (o.fechaIngreso | fecha: 'fechaHora') }
        "
      >
        @if (o.accionesPermitidas.editar) {
          <button hk-button variante="secondary" icono="pencil" (click)="editarRecepcion(o)">
            {{ 'comun.editar' | transloco }}
          </button>
        }
        @if (o.accionesPermitidas.asignarMecanicos) {
          <button hk-button variante="secondary" icono="users-round" (click)="asignarMecanicos(o)">
            {{ 'taller.detalle.mecanicos' | transloco }}
          </button>
        }
      </hk-page-header>

      <hk-card>
        <div class="flex flex-wrap items-center gap-4">
          <hk-placa tamano="lg" [placa]="o.motocicleta.placa" />
          <div class="min-w-0 flex-1">
            <p class="font-display text-lg font-semibold text-fg">
              {{ o.motocicleta.marca }} {{ o.motocicleta.modelo }}
              @if (o.motocicleta.anio) {
                <span class="font-normal text-muted">· {{ o.motocicleta.anio }}</span>
              }
            </p>
            <p class="text-sm text-muted">
              <a
                class="text-primary underline hk-foco"
                [routerLink]="['/clientes', o.cliente.id]"
                >{{ o.cliente.nombreCompleto }}</a
              >
              · {{ documento(o) }} · {{ o.cliente.telefono }}
            </p>
          </div>
          <hk-status-badge [estado]="o.estado" />
        </div>

        <hk-stepper
          class="mt-6"
          [pasos]="pasos()"
          [actual]="pasoActual()"
          [cancelado]="o.estado === 'CANCELADA'"
          [etiqueta]="'taller.detalle.linea_tiempo' | transloco"
        />

        @if (o.accionesPermitidas.transiciones.length > 0) {
          <div class="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
            @for (t of o.accionesPermitidas.transiciones; track t.estado) {
              @let accion = accionDe(o, t);
              <span
                class="max-sm:w-full"
                [hkTooltip]="t.bloqueo ? ('taller.bloqueos.' + t.bloqueo | transloco) : ''"
                [hkTooltipDeshabilitado]="!t.bloqueo"
              >
                <button
                  hk-button
                  tamano="lg"
                  class="max-sm:w-full"
                  [variante]="accion.variante"
                  [icono]="accion.icono"
                  [deshabilitado]="!!t.bloqueo"
                  [cargando]="transicionando() === t.estado"
                  [attr.aria-describedby]="t.bloqueo ? 'bloqueo-' + t.estado : null"
                  (click)="transicionar(o, t)"
                >
                  {{ 'taller.acciones.' + accion.clave | transloco }}
                </button>
                @if (t.bloqueo) {
                  <span [id]="'bloqueo-' + t.estado" class="sr-only">{{
                    'taller.bloqueos.' + t.bloqueo | transloco
                  }}</span>
                }
              </span>
            }
          </div>
        }
      </hk-card>

      <hk-card class="mt-6">
        <hk-tabs
          [pestanas]="pestanas()"
          [(activa)]="pestana"
          [etiqueta]="'taller.detalle.secciones' | transloco"
        >
          @switch (pestana()) {
            @case ('resumen') {
              <div class="grid gap-6 lg:grid-cols-3">
                <dl class="grid gap-4 text-sm sm:grid-cols-2 lg:col-span-2">
                  <div class="sm:col-span-2">
                    <dt class="text-muted">{{ 'taller.campos.motivo' | transloco }}</dt>
                    <dd class="mt-1 font-medium text-fg">{{ o.motivoIngreso }}</dd>
                  </div>
                  <div class="sm:col-span-2">
                    <dt class="text-muted">
                      {{ 'taller.campos.descripcion_problema' | transloco }}
                    </dt>
                    <dd class="mt-1 whitespace-pre-line text-fg">{{ o.descripcionProblema }}</dd>
                  </div>
                  <div class="sm:col-span-2">
                    <dt class="text-muted">{{ 'taller.campos.observaciones' | transloco }}</dt>
                    <dd class="mt-1 whitespace-pre-line text-fg">
                      {{ o.observaciones ?? ('comun.sin_dato' | transloco) }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-muted">{{ 'taller.campos.kilometraje' | transloco }}</dt>
                    <dd class="mt-1 font-medium text-fg tabular">
                      {{ o.kilometrajeIngreso | cantidad }} km
                    </dd>
                  </div>
                  <div>
                    <dt class="text-muted">{{ 'taller.detalle.recibida_por' | transloco }}</dt>
                    <dd class="mt-1 font-medium text-fg">{{ o.creadaPor?.nombre ?? '—' }}</dd>
                  </div>
                </dl>
                <section [attr.aria-label]="'taller.campos.mecanicos' | transloco">
                  <h3 class="mb-3 text-sm font-semibold text-fg">
                    {{ 'taller.campos.mecanicos' | transloco }}
                  </h3>
                  @for (m of o.mecanicos; track m.id) {
                    <div class="mb-3 flex items-center gap-3">
                      <hk-avatar [nombre]="m.nombre" />
                      <div class="min-w-0">
                        <p class="truncate text-sm font-medium text-fg">{{ m.nombre }}</p>
                        <p class="truncate text-xs text-muted">
                          {{ m.actividad ?? ('taller.mecanicos.sin_actividad' | transloco) }}
                        </p>
                      </div>
                    </div>
                  } @empty {
                    <p class="text-sm text-muted">
                      {{ 'taller.mecanicos.sin_asignar' | transloco }}
                    </p>
                  }
                </section>
              </div>
            }
            @case ('items') {
              <hk-items-orden
                [orden]="o"
                (cambio)="orden.set($event)"
                (recargar)="orden.reload()"
              />
            }
            @case ('presupuestos') {
              <hk-presupuestos-orden [orden]="o" (cambio)="orden.reload()" />
            }
            @case ('diagnostico') {
              <hk-diagnostico-form [orden]="o" (guardado)="alGuardarDiagnostico($event)" />
            }
            @case ('historial') {
              <ol class="space-y-4">
                @for (h of historialReciente(); track $index) {
                  <li class="flex gap-3">
                    <span
                      class="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"
                      aria-hidden="true"
                    >
                      <svg lucideIcon="calendar" class="size-4" />
                    </span>
                    <div class="min-w-0 text-sm">
                      <p class="flex flex-wrap items-center gap-2 text-fg">
                        @if (h.estadoAnterior) {
                          <hk-status-badge [estado]="h.estadoAnterior" />
                          <svg
                            lucideIcon="chevron-right"
                            class="size-4 text-muted"
                            aria-hidden="true"
                          />
                          <span class="sr-only">{{ 'taller.historial.a' | transloco }}</span>
                        } @else {
                          <span class="font-medium">{{
                            'taller.historial.creada' | transloco
                          }}</span>
                        }
                        <hk-status-badge [estado]="h.estadoNuevo" />
                      </p>
                      <p class="mt-1 text-xs text-muted">
                        {{ h.usuario?.nombre ?? '—' }} · {{ h.fecha | fecha: 'fechaHora' }} ·
                        {{ h.fecha | tiempoRelativo }}
                      </p>
                      @if (h.nota) {
                        <p class="mt-1 whitespace-pre-line text-fg">“{{ h.nota }}”</p>
                      }
                    </div>
                  </li>
                }
              </ol>
            }
          }
        </hk-tabs>
      </hk-card>
    } @else {
      <div class="space-y-6" aria-busy="true">
        <hk-skeleton ancho="40%" alto="2rem" />
        <hk-skeleton variante="rectangulo" alto="12rem" />
        <hk-skeleton variante="rectangulo" alto="16rem" />
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdenDetallePage {
  private readonly api = inject(OrdenesApiService);
  private readonly dialogos = inject(DialogosService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly idioma = inject(LanguageService);

  readonly id = input.required({ transform: numberAttribute });

  protected readonly orden = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.obtener(params, erroresManejados()),
  });
  protected readonly pestana = signal('resumen');
  protected readonly transicionando = signal<EstadoOrden | null>(null);

  /** Cambia al cargar las traducciones o el idioma: los `computed` que traducen la leen. */
  private readonly traducciones = toSignal(this.transloco.selectTranslation());
  protected readonly pestanas = computed<Pestana[]>(() => {
    this.traducciones();
    const t = (clave: string) => this.transloco.translate(clave);
    const pronto = t('taller.detalle.pronto');
    const o = this.orden.value();
    return [
      { id: 'resumen', etiqueta: t('taller.detalle.pestanas.resumen'), icono: 'info' },
      {
        id: 'diagnostico',
        etiqueta: t('taller.detalle.pestanas.diagnostico'),
        icono: 'stethoscope',
      },
      {
        id: 'items',
        etiqueta: t('taller.detalle.pestanas.items'),
        icono: 'package',
        contador: o ? o.servicios.length + o.repuestos.length : undefined,
      },
      {
        id: 'presupuestos',
        etiqueta: t('taller.detalle.pestanas.presupuestos'),
        icono: 'hourglass',
      },
      {
        id: 'pago',
        etiqueta: `${t('taller.detalle.pestanas.pago')} · ${pronto}`,
        icono: 'banknote',
        deshabilitada: true,
      },
      {
        id: 'historial',
        etiqueta: t('taller.detalle.pestanas.historial'),
        icono: 'calendar',
        contador: this.orden.value()?.historial.length,
      },
    ];
  });

  /** Cada paso del flujo con la fecha y el usuario de la última vez que la orden llegó a él. */
  protected readonly pasos = computed<Paso[]>(() => {
    this.traducciones();
    const historial = this.orden.value()?.historial ?? [];
    return FLUJO.map((estado) => {
      const llegada = ultimaLlegada(historial, estado);
      return {
        id: estado,
        etiqueta: this.transloco.translate(`estados.orden.${estado}`),
        detalle: llegada
          ? `${llegada.usuario?.nombre ?? ''} · ${formatoFecha(llegada.fecha, this.idioma.locale(), 'corta')}`
          : undefined,
      };
    });
  });
  /** Cancelada: el paso marcado es el estado en que estaba al cancelarse. */
  protected readonly pasoActual = computed(() => {
    const o = this.orden.value();
    if (!o) return 'RECIBIDA';
    if (o.estado !== 'CANCELADA') return o.estado;
    return ultimaLlegada(o.historial, 'CANCELADA')?.estadoAnterior ?? 'RECIBIDA';
  });
  protected readonly historialReciente = computed(() =>
    [...(this.orden.value()?.historial ?? [])].reverse(),
  );

  protected accionDe(orden: Orden, transicion: TransicionPermitida) {
    return accionTransicion(orden.estado, transicion.estado);
  }

  protected documento(orden: Orden): string {
    return documentoParaMostrar(orden.cliente.tipoDocumento, orden.cliente.numeroDocumento);
  }

  protected async transicionar(orden: Orden, transicion: TransicionPermitida): Promise<void> {
    if (transicion.bloqueo || this.transicionando()) return;
    if (transicion.estado === 'PENDIENTE_APROBACION') {
      this.enviarPresupuesto(orden);
      return;
    }
    const accion = accionTransicion(orden.estado, transicion.estado);
    const nombre = this.transloco.translate(`taller.acciones.${accion.clave}`);
    const resultado = await this.confirmacion.pedir({
      titulo: this.transloco.translate('taller.confirmar_transicion.titulo', {
        accion: nombre,
        numero: orden.numero,
      }),
      mensaje: this.transloco.translate(`taller.confirmar_transicion.${accion.clave}`),
      textoConfirmar: nombre,
      peligrosa: transicion.estado === 'CANCELADA',
      pedirMotivo: transicion.requiereNota,
    });
    if (!resultado) return;
    this.transicionando.set(transicion.estado);
    this.api.transicionar(orden, transicion.estado, resultado.motivo ?? null).subscribe({
      next: (actualizada) => {
        this.transicionando.set(null);
        this.orden.set(actualizada);
        this.toast.exito(
          this.transloco.translate('taller.transicion_hecha', {
            numero: actualizada.numero,
            estado: this.transloco.translate(`estados.orden.${actualizada.estado}`),
          }),
        );
        if (actualizada.estado === 'EN_DIAGNOSTICO')
          this.pestana.set(actualizada.diagnostico ? 'items' : 'diagnostico');
      },
      // El interceptor ya avisó (p. ej. otro usuario la cambió): se recarga lo vigente
      error: () => {
        this.transicionando.set(null);
        this.orden.reload();
      },
    });
  }

  /** Pasar a pendiente de aprobación es enviar un presupuesto (con descuento y observaciones). */
  private enviarPresupuesto(orden: Orden): void {
    this.dialogos
      .abrirModal<EnviarPresupuestoModal, Orden, Presupuesto>(EnviarPresupuestoModal, {
        datos: orden,
        tamano: 'lg',
        hojaEnMovil: true,
      })
      .closed.subscribe((presupuesto) => {
        if (!presupuesto) return;
        this.toast.exito(
          this.transloco.translate('taller.presupuestos.enviado', { numero: presupuesto.numero }),
        );
        this.pestana.set('presupuestos');
        this.orden.reload();
      });
  }

  protected editarRecepcion(orden: Orden): void {
    this.dialogos
      .abrirDrawer<RecepcionFormDrawer, Orden, Orden>(RecepcionFormDrawer, { datos: orden })
      .closed.subscribe((guardada) => {
        if (!guardada) return;
        this.orden.set(guardada);
        this.toast.exito(this.transloco.translate('taller.detalle.recepcion_guardada'));
      });
  }

  protected asignarMecanicos(orden: Orden): void {
    this.dialogos
      .abrirModal<MecanicosModal, Orden, Orden>(MecanicosModal, { datos: orden, tamano: 'lg' })
      .closed.subscribe((actualizada) => {
        if (!actualizada) return;
        this.orden.set(actualizada);
        this.toast.exito(this.transloco.translate('taller.mecanicos.guardados'));
      });
  }

  protected alGuardarDiagnostico(orden: Orden): void {
    this.orden.set(orden);
    this.toast.exito(this.transloco.translate('taller.diagnostico.guardado'));
  }
}
