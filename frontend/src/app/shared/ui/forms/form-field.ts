import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  input,
  signal,
} from '@angular/core';
import { NgControl, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { ContextoCampo, HK_CAMPO, nuevoId } from './campo';

export interface ErrorCampo {
  clave: string;
  params: Record<string, unknown>;
}

/**
 * Traduce el primer error de un control a una clave i18n:
 * - `{ servidor: 'PLACA_INVALIDA' }` (código que devolvió el backend) → `errors.PLACA_INVALIDA`
 * - validadores de Angular o propios (`required`, `minlength`, `password`…) → `validacion.<nombre>`
 */
export function errorCampo(errores: Record<string, unknown> | null): ErrorCampo | null {
  const primero = errores ? Object.entries(errores)[0] : undefined;
  if (!primero) return null;
  const [nombre, detalle] = primero;
  if (nombre === 'servidor' && typeof detalle === 'string')
    return { clave: `errors.${detalle}`, params: {} };
  const params =
    detalle !== null && typeof detalle === 'object' ? (detalle as Record<string, unknown>) : {};
  return { clave: `validacion.${nombre}`, params };
}

/**
 * Contenedor de un campo: etiqueta, control proyectado, ayuda y error traducido.
 * El error se muestra cuando el control es inválido y ya fue tocado (al enviar, el formulario
 * debe llamar a `markAllAsTouched()`).
 */
@Component({
  selector: 'hk-form-field',
  imports: [TranslocoPipe, LucideDynamicIcon],
  providers: [{ provide: HK_CAMPO, useExisting: HkFormField }],
  template: `
    @if (etiqueta()) {
      <label [for]="idControl" class="mb-1.5 flex items-center gap-1 text-xs font-medium text-fg">
        {{ etiqueta() }}
        @if (requerido()) {
          <span class="text-danger" aria-hidden="true">*</span>
        } @else if (opcional()) {
          <span class="font-normal text-muted">({{ 'comun.opcional' | transloco }})</span>
        }
      </label>
    }
    <ng-content />
    @if (error(); as e) {
      <p
        [id]="idError"
        class="mt-1.5 flex items-start gap-1 text-xs font-medium text-danger"
        role="alert"
      >
        <svg lucideIcon="circle-alert" class="mt-px size-3.5 shrink-0" aria-hidden="true" />
        {{ e.clave | transloco: e.params }}
      </p>
    } @else if (ayuda()) {
      <p [id]="idAyuda" class="mt-1.5 text-xs text-muted">{{ ayuda() }}</p>
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkFormField implements ContextoCampo {
  /** Texto ya traducido de la etiqueta. */
  readonly etiqueta = input<string>();
  readonly ayuda = input<string>();
  /** Muestra "(opcional)" junto a la etiqueta cuando el control no es obligatorio. */
  readonly opcional = input(false);

  readonly idControl = nuevoId('hk-campo');
  protected readonly idError = `${this.idControl}-error`;
  protected readonly idAyuda = `${this.idControl}-ayuda`;

  private readonly ngControl = contentChild(NgControl, { descendants: true });
  /** Se incrementa con cada evento del control para recalcular el estado (no es una signal). */
  private readonly version = signal(0);

  readonly error = computed(() => {
    this.version();
    const control = this.ngControl()?.control;
    if (!control || !control.invalid || !control.touched) return null;
    return errorCampo(control.errors);
  });

  readonly invalido = computed(() => this.error() !== null);
  readonly requerido = computed(() => {
    this.version();
    return this.ngControl()?.control?.hasValidator(Validators.required) ?? false;
  });
  readonly descritoPor = computed(() =>
    this.error() ? this.idError : this.ayuda() ? this.idAyuda : null,
  );

  constructor() {
    effect((alLimpiar) => {
      const control = this.ngControl()?.control;
      if (!control) return;
      const sub = control.events.subscribe(() => this.version.update((v) => v + 1));
      alLimpiar(() => sub.unsubscribe());
    });
  }
}
