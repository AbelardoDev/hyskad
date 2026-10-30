import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize } from 'rxjs';

import { conFormulario } from '../../core/http/contexto-http';
import { calcularTotales } from '../../core/utils/dinero';
import { CantidadPipe, CopPipe } from '../../core/utils/formato.pipes';
import { HkButton } from '../../shared/ui/button/button';
import { HkModal } from '../../shared/ui/dialog/modal';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkMoneyInput } from '../../shared/ui/forms/money-input';
import { HkTextarea } from '../../shared/ui/forms/textarea';
import { Orden, OrdenesApiService, Presupuesto } from './ordenes-api.service';

/**
 * Enviar el presupuesto de la orden (RF22, RN-31, RN-32): descuento (hasta el subtotal),
 * observaciones y vista previa de lo que se congela, con los totales calculados como el backend.
 */
@Component({
  selector: 'hk-enviar-presupuesto-modal',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    CantidadPipe,
    CopPipe,
    HkButton,
    HkFormField,
    HkModal,
    HkMoneyInput,
    HkTextarea,
  ],
  template: `
    <hk-modal
      [titulo]="'taller.presupuestos.enviar_titulo' | transloco: { numero: orden.numero }"
      [descripcion]="'taller.presupuestos.enviar_texto' | transloco"
    >
      <form
        id="form-presupuesto"
        class="grid gap-5 sm:grid-cols-2"
        [formGroup]="form"
        (ngSubmit)="enviar()"
        novalidate
      >
        <hk-form-field [etiqueta]="'ventas.campos.descuento' | transloco" [opcional]="true">
          <hk-money-input formControlName="descuento" />
        </hk-form-field>
        <hk-form-field
          class="sm:col-span-2"
          [etiqueta]="'taller.presupuestos.observaciones' | transloco"
          [opcional]="true"
        >
          <hk-textarea formControlName="observaciones" [filas]="3" [maxCaracteres]="1000" />
        </hk-form-field>
      </form>

      <section class="mt-6" [attr.aria-label]="'taller.presupuestos.vista_previa' | transloco">
        <h3 class="mb-2 text-sm font-semibold text-fg">
          {{ 'taller.presupuestos.vista_previa' | transloco }}
        </h3>
        <ul class="divide-y divide-border rounded-lg border border-border text-sm">
          @for (s of orden.servicios; track s.id) {
            <li class="flex justify-between gap-3 px-3 py-2">
              <span class="text-fg">{{ s.descripcion }}</span>
              <span class="text-fg tabular">{{ s.precio | cop }}</span>
            </li>
          }
          @for (r of orden.repuestos; track r.id) {
            <li class="flex justify-between gap-3 px-3 py-2">
              <span class="text-fg">{{ r.nombre }} × {{ r.cantidad | cantidad }}</span>
              <span class="text-fg tabular">{{ r.subtotal | cop }}</span>
            </li>
          }
        </ul>
        <dl class="mt-3 ml-auto max-w-xs space-y-1 text-sm" aria-live="polite">
          <div class="flex justify-between">
            <dt class="text-muted">{{ 'compras.subtotal' | transloco }}</dt>
            <dd class="tabular">{{ totales().subtotal | cop }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">{{ 'ventas.campos.descuento' | transloco }}</dt>
            <dd class="tabular">−{{ totales().descuento | cop }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">
              {{ 'compras.iva' | transloco: { porcentaje: orden.ivaPorcentaje } }}
            </dt>
            <dd class="tabular">{{ totales().impuesto | cop }}</dd>
          </div>
          <div class="flex justify-between border-t border-border pt-2 text-base font-bold">
            <dt>{{ 'compras.total' | transloco }}</dt>
            <dd class="tabular">{{ totales().total | cop }}</dd>
          </div>
        </dl>
      </section>

      <div hkModalPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button
          hk-button
          tipo="submit"
          form="form-presupuesto"
          icono="hourglass"
          [cargando]="enviando()"
        >
          {{ 'taller.acciones.enviar_presupuesto' | transloco }}
        </button>
      </div>
    </hk-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnviarPresupuestoModal {
  private readonly api = inject(OrdenesApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly ref = inject<DialogRef<Presupuesto>>(DialogRef);
  protected readonly orden = inject<Orden>(DIALOG_DATA);
  protected readonly enviando = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    descuento: [null as number | null, [Validators.min(0), Validators.max(this.orden.subtotal)]],
    observaciones: ['', Validators.maxLength(1000)],
  });
  private readonly descuento = toSignal(this.form.controls.descuento.valueChanges, {
    initialValue: null,
  });

  /** Mismo cálculo que el backend (RN-04) sobre las líneas de la orden. */
  protected readonly totales = computed(() => {
    const lineas = [
      ...this.orden.servicios.map((s) => ({ cantidad: 1, precioUnitario: s.precio })),
      ...this.orden.repuestos.map((r) => ({
        cantidad: r.cantidad,
        precioUnitario: r.precioUnitario,
      })),
    ];
    const subtotal = this.orden.subtotal;
    const descuento = Math.min(Math.max(this.descuento() ?? 0, 0), subtotal);
    return calcularTotales(lineas, descuento, this.orden.ivaPorcentaje);
  });

  protected enviar(): void {
    if (this.enviando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const v = this.form.getRawValue();
    this.enviando.set(true);
    this.api
      .generarPresupuesto(
        this.orden,
        v.descuento ?? 0,
        v.observaciones.trim() || null,
        conFormulario(this.form),
      )
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe((presupuesto) => this.ref.close(presupuesto));
  }
}
