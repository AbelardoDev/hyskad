import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { finalize } from 'rxjs';

import { conFormulario } from '../../core/http/contexto-http';
import { LanguageService } from '../../core/i18n/language.service';
import { formatoCop } from '../../core/utils/formato';
import { CopPipe, FechaPipe } from '../../core/utils/formato.pipes';
import { HkButton } from '../../shared/ui/button/button';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import {
  exigirReferenciaSalvoEfectivo,
  HkCamposPago,
  MetodoPago,
} from '../../shared/ui/forms/campos-pago';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkTextarea } from '../../shared/ui/forms/textarea';
import { Orden, OrdenesApiService } from './ordenes-api.service';

/**
 * Pestaña "Pago y entrega" (RF25, RF28): con la orden finalizada, el pago por el total exacto
 * (RN-35, mismo formulario que el punto de venta); con el pago, la entrega (RN-36); entregada, la
 * pantalla de éxito con el comprobante. Lo que se puede hacer lo dice `accionesPermitidas`.
 */
@Component({
  selector: 'hk-pago-entrega-orden',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    LucideDynamicIcon,
    CopPipe,
    FechaPipe,
    HkButton,
    HkCamposPago,
    HkEmptyState,
    HkFormField,
    HkTextarea,
  ],
  template: `
    @let o = orden();
    @if (o.estado === 'ENTREGADA') {
      <div class="mx-auto max-w-lg py-4 text-center" role="status">
        <span
          class="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-success-soft text-success-ink"
          aria-hidden="true"
        >
          <svg lucideIcon="package-check" class="size-8" />
        </span>
        <h3 class="mt-4 font-display text-xl font-semibold text-fg">
          {{ 'taller.pago.entregada_titulo' | transloco: { numero: o.numero } }}
        </h3>
        @if (o.entrega; as e) {
          <p class="mt-1 text-sm text-muted">
            {{
              'taller.pago.entregada_por'
                | transloco
                  : { nombre: e.usuario?.nombre ?? '—', fecha: (e.fecha | fecha: 'fechaHora') }
            }}
          </p>
          @if (e.observaciones) {
            <p class="mt-2 text-sm whitespace-pre-line text-fg">“{{ e.observaciones }}”</p>
          }
        }
        <a
          hk-button
          tamano="lg"
          icono="printer"
          class="mt-6 max-sm:w-full"
          [routerLink]="['/ordenes', o.id, 'comprobante']"
        >
          {{ 'taller.pago.imprimir_comprobante' | transloco }}
        </a>
      </div>
    } @else if (o.estado !== 'FINALIZADA') {
      <hk-empty-state
        compacto
        icono="banknote"
        [titulo]="'taller.pago.no_finalizada' | transloco"
        [texto]="'taller.pago.no_finalizada_texto' | transloco: { total: (o.total | cop) }"
      />
    } @else {
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section
          class="self-start rounded-2xl bg-surface-2 p-5"
          [attr.aria-label]="'taller.pago.resumen' | transloco"
        >
          <dl class="space-y-1 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-muted">{{ 'compras.subtotal' | transloco }}</dt>
              <dd class="tabular">{{ o.subtotal | cop }}</dd>
            </div>
            @if (o.descuento > 0) {
              <div class="flex justify-between gap-4">
                <dt class="text-muted">{{ 'ventas.campos.descuento' | transloco }}</dt>
                <dd class="tabular">−{{ o.descuento | cop }}</dd>
              </div>
            }
            <div class="flex justify-between gap-4">
              <dt class="text-muted">
                {{ 'compras.iva' | transloco: { porcentaje: o.ivaPorcentaje } }}
              </dt>
              <dd class="tabular">{{ o.impuesto | cop }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-4 border-t border-border pt-3">
              <dt class="font-semibold text-fg">{{ 'taller.pago.total_pagar' | transloco }}</dt>
              <dd class="font-display text-3xl font-bold text-fg tabular">{{ o.total | cop }}</dd>
            </div>
          </dl>
          @if (o.pago; as p) {
            <p
              class="mt-4 flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-sm text-success-ink"
            >
              <svg lucideIcon="circle-check" class="size-4 shrink-0" aria-hidden="true" />
              {{
                'taller.pago.pagado'
                  | transloco
                    : {
                        metodo: ('pago.metodos.' + p.metodo | transloco),
                        fecha: (p.fecha | fecha: 'fechaHora'),
                      }
              }}
            </p>
            @if (p.cambio !== null) {
              <p class="mt-2 text-sm text-muted">
                {{ 'pago.recibido' | transloco }}: {{ p.montoRecibido | cop }} ·
                {{ 'pago.cambio' | transloco }}: {{ p.cambio | cop }}
              </p>
            }
            <a
              hk-button
              variante="secondary"
              icono="printer"
              class="mt-4 w-full"
              [routerLink]="['/ordenes', o.id, 'comprobante']"
            >
              {{ 'taller.pago.imprimir_comprobante' | transloco }}
            </a>
          }
        </section>

        @if (!o.pago) {
          @if (o.accionesPermitidas.registrarPago) {
            <form class="flex flex-col gap-4" [formGroup]="pago" (ngSubmit)="pagar()" novalidate>
              <h3 class="font-display text-base font-semibold text-fg">
                {{ 'taller.pago.registrar' | transloco }}
              </h3>
              <hk-campos-pago
                [metodo]="pago.controls.metodo"
                [referencia]="pago.controls.referencia"
                [montoRecibido]="pago.controls.montoRecibido"
                [total]="o.total"
              />
              <button hk-button tipo="submit" tamano="lg" icono="check" [cargando]="guardando()">
                {{ 'taller.pago.cobrar' | transloco: { total: (o.total | cop) } }}
              </button>
            </form>
          } @else {
            <hk-empty-state
              compacto
              icono="hourglass"
              [titulo]="'taller.pago.pendiente' | transloco"
              [texto]="'taller.pago.pendiente_texto' | transloco"
            />
          }
        } @else if (o.accionesPermitidas.registrarEntrega) {
          <form
            class="flex flex-col gap-4"
            [formGroup]="entrega"
            (ngSubmit)="entregar()"
            novalidate
          >
            <h3 class="font-display text-base font-semibold text-fg">
              {{ 'taller.pago.entregar_titulo' | transloco }}
            </h3>
            <hk-form-field
              [etiqueta]="'taller.pago.observaciones_entrega' | transloco"
              [opcional]="true"
            >
              <hk-textarea formControlName="observaciones" [filas]="3" [maxCaracteres]="1000" />
            </hk-form-field>
            <button
              hk-button
              tipo="submit"
              tamano="lg"
              icono="package-check"
              [cargando]="guardando()"
            >
              {{ 'taller.pago.entregar' | transloco }}
            </button>
          </form>
        } @else {
          <hk-empty-state
            compacto
            icono="package"
            [titulo]="'taller.pago.lista_entregar' | transloco"
            [texto]="'taller.pago.lista_entregar_texto' | transloco"
          />
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkPagoEntregaOrden {
  private readonly api = inject(OrdenesApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly transloco = inject(TranslocoService);
  private readonly idioma = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly orden = input.required<Orden>();
  /** La orden actualizada después de pagar o entregar. */
  readonly cambio = output<Orden>();

  protected readonly guardando = signal(false);
  protected readonly pago = this.fb.group({
    metodo: ['EFECTIVO' as MetodoPago, Validators.required],
    referencia: ['', Validators.maxLength(60)],
    montoRecibido: [null as number | null, Validators.min(0)],
  });
  protected readonly entrega = this.fb.group({
    observaciones: ['', Validators.maxLength(1000)],
  });

  constructor() {
    exigirReferenciaSalvoEfectivo(this.pago.controls.metodo, this.pago.controls.referencia);
  }

  /** RN-35: se paga exactamente el total; en efectivo lo recibido debe cubrirlo. */
  protected async pagar(): Promise<void> {
    if (this.guardando()) return;
    const orden = this.orden();
    const { metodo, referencia, montoRecibido } = this.pago.controls;
    if (
      metodo.value === 'EFECTIVO' &&
      montoRecibido.value !== null &&
      montoRecibido.value < orden.total
    ) {
      montoRecibido.setErrors({ servidor: 'MONTO_INSUFICIENTE' });
    }
    if (this.pago.invalid) {
      this.pago.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const confirmado = await this.confirmacion.pedir({
      titulo: this.transloco.translate('taller.pago.confirmar_titulo', { numero: orden.numero }),
      mensaje: this.transloco.translate('taller.pago.confirmar_mensaje', {
        total: formatoCop(orden.total, this.idioma.locale()),
        metodo: this.transloco.translate(`pago.metodos.${metodo.value}`),
      }),
      textoConfirmar: this.transloco.translate('taller.pago.registrar'),
    });
    if (!confirmado) return;
    const efectivo = metodo.value === 'EFECTIVO';
    this.guardando.set(true);
    this.api
      .registrarPago(
        orden.id,
        {
          monto: orden.total,
          metodo: metodo.value,
          referencia: efectivo ? null : referencia.value.trim(),
          montoRecibido: efectivo ? montoRecibido.value : null,
        },
        conFormulario(this.pago),
      )
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (actualizada) => this.cambio.emit(actualizada),
        error: () => enfocarPrimerError(this.host.nativeElement, this.injector),
      });
  }

  /** RN-36: entrega de la orden pagada; queda ENTREGADA. */
  protected async entregar(): Promise<void> {
    if (this.guardando()) return;
    if (this.entrega.invalid) {
      this.entrega.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const orden = this.orden();
    const confirmado = await this.confirmacion.pedir({
      titulo: this.transloco.translate('taller.pago.confirmar_entrega_titulo', {
        numero: orden.numero,
      }),
      mensaje: this.transloco.translate('taller.pago.confirmar_entrega_mensaje', {
        placa: orden.motocicleta.placa,
        cliente: orden.cliente.nombreCompleto,
      }),
      textoConfirmar: this.transloco.translate('taller.pago.entregar'),
    });
    if (!confirmado) return;
    const observaciones = this.entrega.controls.observaciones.value.trim();
    this.guardando.set(true);
    this.api
      .registrarEntrega(orden.id, observaciones || null, conFormulario(this.entrega))
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe((actualizada) => this.cambio.emit(actualizada));
  }
}
