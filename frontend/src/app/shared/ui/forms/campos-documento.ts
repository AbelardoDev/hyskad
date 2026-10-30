import { ChangeDetectionStrategy, Component, computed, effect, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';
import { startWith, switchMap } from 'rxjs';

import {
  digitoVerificacionNit,
  DIGITOS_NIT,
  normalizarDocumento,
  TipoDocumento,
  TIPOS_DOCUMENTO,
} from '../../../core/utils/validadores';
import { HkFormField } from './form-field';
import { HkInput } from './input';
import { HkSelect, OpcionSelect } from './select';

/**
 * Tipo y número de documento (RN-38). Con NIT pide los 9 dígitos y muestra el dígito de
 * verificación calculado en vivo (RN-39). El número debe tener el validador
 * `documentoSegunTipo`; aquí se revalida al cambiar el tipo.
 */
@Component({
  selector: 'hk-campos-documento',
  imports: [ReactiveFormsModule, TranslocoPipe, HkFormField, HkInput, HkSelect],
  template: `
    <div class="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <hk-form-field [etiqueta]="'documentos.tipo' | transloco">
        <hk-select [formControl]="tipoDocumento()" [opciones]="opcionesTipo()" />
      </hk-form-field>
      <hk-form-field
        [etiqueta]="(esNit() ? 'documentos.nit' : 'documentos.numero') | transloco"
        [ayuda]="(esNit() ? 'documentos.nit_ayuda' : 'documentos.numero_ayuda') | transloco"
      >
        <div class="flex items-stretch gap-2">
          <hk-input
            class="min-w-0 flex-1"
            [formControl]="numeroDocumento()"
            autocompletar="off"
            [modoTeclado]="soloDigitos() ? 'numeric' : 'text'"
            [maxCaracteres]="20"
          />
          @if (esNit()) {
            <output
              class="inline-flex min-w-16 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 px-2 text-sm text-muted tabular"
              [attr.aria-label]="'documentos.dv_accesible' | transloco: { dv: dv() ?? '—' }"
              aria-live="polite"
            >
              {{ 'documentos.dv' | transloco }}
              <span class="ml-1 font-semibold text-fg">{{ dv() ?? '—' }}</span>
            </output>
          }
        </div>
      </hk-form-field>
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkCamposDocumento {
  readonly tipoDocumento = input.required<FormControl<TipoDocumento | ''>>();
  readonly numeroDocumento = input.required<FormControl<string>>();

  private readonly tipo = toSignal(
    toObservable(this.tipoDocumento).pipe(
      switchMap((c) => c.valueChanges.pipe(startWith(c.value))),
    ),
    { initialValue: '' as TipoDocumento | '' },
  );
  private readonly numero = toSignal(
    toObservable(this.numeroDocumento).pipe(
      switchMap((c) => c.valueChanges.pipe(startWith(c.value))),
    ),
    { initialValue: '' },
  );

  protected readonly esNit = computed(() => this.tipo() === 'NIT');
  protected readonly soloDigitos = computed(() => !['CE', 'PA'].includes(this.tipo()));
  /** DV calculado con los primeros 9 dígitos del NIT. */
  protected readonly dv = computed(() => {
    const digitos = normalizarDocumento(this.numero());
    return digitos.length >= DIGITOS_NIT
      ? digitoVerificacionNit(digitos.slice(0, DIGITOS_NIT))
      : null;
  });

  private readonly textosTipo = translateSignal(
    TIPOS_DOCUMENTO.map((t) => `documentos.tipos.${t}`),
  );
  protected readonly opcionesTipo = computed<OpcionSelect[]>(() =>
    TIPOS_DOCUMENTO.map((valor, i) => ({ valor, etiqueta: this.textosTipo()[i] })),
  );

  constructor() {
    // Al cambiar el tipo, el mismo número puede pasar a ser válido o no.
    effect((alLimpiar) => {
      const numero = this.numeroDocumento();
      const sub = this.tipoDocumento().valueChanges.subscribe(() =>
        numero.updateValueAndValidity(),
      );
      alLimpiar(() => sub.unsubscribe());
    });
  }
}
