import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { startWith, Subscription, switchMap } from 'rxjs';

import { CopPipe } from '../../../core/utils/formato.pipes';
import { HkFormField } from './form-field';
import { HkInput } from './input';
import { HkMoneyInput } from './money-input';

/** RN-20: métodos de pago de ventas y órdenes. Solo el efectivo no lleva referencia. */
export const METODOS_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO'] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const ICONOS_PAGO: Record<MetodoPago, string> = {
  EFECTIVO: 'banknote',
  TRANSFERENCIA: 'arrow-left-right',
  TARJETA: 'credit-card',
  OTRO: 'ellipsis',
};

/** Cambio en efectivo: lo recibido menos el total; `null` si no se ha escrito lo recibido. */
export function cambioEfectivo(recibido: number | null, total: number): number | null {
  return recibido === null ? null : Math.round((recibido - total) * 100) / 100;
}

/** RN-20: la referencia es obligatoria salvo en efectivo. Devuelve la suscripción. */
export function exigirReferenciaSalvoEfectivo(
  metodo: FormControl<MetodoPago>,
  referencia: FormControl<string>,
): Subscription {
  return metodo.valueChanges.pipe(startWith(metodo.value)).subscribe((valor) => {
    if (valor === 'EFECTIVO') referencia.removeValidators(Validators.required);
    else referencia.addValidators(Validators.required);
    referencia.updateValueAndValidity({ emitEvent: false });
  });
}

/**
 * Método de pago con íconos y, según el método, el monto recibido con el cambio en grande
 * (efectivo) o la referencia (RN-20). Lo usan el punto de venta y el pago de la orden; el
 * formulario que lo contiene aplica `exigirReferenciaSalvoEfectivo`.
 */
@Component({
  selector: 'hk-campos-pago',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    LucideDynamicIcon,
    CopPipe,
    HkFormField,
    HkInput,
    HkMoneyInput,
  ],
  template: `
    <fieldset>
      <legend class="mb-2 text-xs font-medium text-fg">{{ 'pago.metodo' | transloco }}</legend>
      <div class="grid gap-2" [class]="rejilla()">
        @for (m of metodos; track m) {
          <label
            class="flex min-h-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            [class]="
              actual() === m
                ? 'border-primary bg-primary-soft text-primary-ink'
                : 'border-border text-fg hover:bg-surface-2'
            "
          >
            <input class="sr-only" type="radio" [formControl]="metodo()" [value]="m" />
            <svg [lucideIcon]="iconos[m]" class="size-5" aria-hidden="true" />
            {{ 'pago.metodos.' + m | transloco }}
          </label>
        }
      </div>
    </fieldset>

    @if (actual() === 'EFECTIVO') {
      <div>
        <hk-form-field [etiqueta]="'pago.recibido' | transloco" [opcional]="true">
          <hk-money-input [formControl]="montoRecibido()" />
        </hk-form-field>
        @if (cambio(); as c) {
          <p
            class="mt-3 flex items-baseline justify-between rounded-xl px-4 py-3"
            role="status"
            [class]="
              c.valor >= 0 ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger-ink'
            "
          >
            <span class="text-sm font-medium">
              {{ (c.valor >= 0 ? 'pago.cambio' : 'pago.falta') | transloco }}
            </span>
            <span class="font-display text-3xl font-bold tabular">{{ c.absoluto | cop }}</span>
          </p>
        }
      </div>
    } @else {
      <hk-form-field [etiqueta]="'pago.referencia' | transloco">
        <hk-input [formControl]="referencia()" autocompletar="off" [maxCaracteres]="60" />
      </hk-form-field>
    }
  `,
  host: { class: 'flex flex-col gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkCamposPago {
  readonly metodo = input.required<FormControl<MetodoPago>>();
  readonly referencia = input.required<FormControl<string>>();
  readonly montoRecibido = input.required<FormControl<number | null>>();
  readonly total = input.required<number>();
  /** Columnas de los métodos (clases literales de Tailwind). */
  readonly rejilla = input('grid-cols-2 sm:grid-cols-4');

  protected readonly metodos = METODOS_PAGO;
  protected readonly iconos = ICONOS_PAGO;

  protected readonly actual = toSignal(
    toObservable(this.metodo).pipe(switchMap((c) => c.valueChanges.pipe(startWith(c.value)))),
    { initialValue: 'EFECTIVO' as MetodoPago },
  );
  private readonly recibido = toSignal(
    toObservable(this.montoRecibido).pipe(
      switchMap((c) => c.valueChanges.pipe(startWith(c.value))),
    ),
    { initialValue: null },
  );
  protected readonly cambio = computed(() => {
    const valor = cambioEfectivo(this.recibido(), this.total());
    return valor === null ? null : { valor, absoluto: Math.abs(valor) };
  });
}
