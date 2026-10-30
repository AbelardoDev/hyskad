import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize } from 'rxjs';

import { HkButton } from '../../shared/ui/button/button';
import { HkModal } from '../../shared/ui/dialog/modal';
import { HkCombobox } from '../../shared/ui/forms/combobox';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkPlaca } from '../../shared/ui/placa/placa';
import { buscadorClientes } from '../clientes/buscador-clientes';
import { Motocicleta, MotocicletasApiService } from './motocicletas-api.service';

/**
 * Cambio de propietario (RN-43): se elige el nuevo cliente activo y se confirma viendo de quién a
 * quién pasa la moto. Cierra devolviendo la moto actualizada.
 */
@Component({
  selector: 'hk-cambiar-propietario-modal',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HkButton,
    HkCombobox,
    HkFormField,
    HkModal,
    HkPlaca,
  ],
  template: `
    <hk-modal
      [titulo]="'motos.propietario.titulo' | transloco"
      [descripcion]="'motos.propietario.descripcion' | transloco"
    >
      <form
        id="form-propietario"
        class="space-y-5"
        [formGroup]="form"
        (ngSubmit)="confirmar()"
        novalidate
      >
        <hk-form-field [etiqueta]="'motos.propietario.nuevo' | transloco">
          <hk-combobox
            formControlName="cliente"
            [opciones]="clientes.opciones()"
            [cargando]="clientes.cargando()"
            [filtrarLocal]="false"
            [placeholder]="'motos.form.buscar_cliente' | transloco"
            (busqueda)="clientes.buscar($event)"
          />
        </hk-form-field>
        @if (nuevoNombre(); as nuevo) {
          <div
            class="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-2/60 p-4 text-sm text-fg"
            role="status"
          >
            <hk-placa [placa]="moto.placa" tamano="sm" />
            {{
              'motos.propietario.resumen'
                | transloco: { anterior: moto.propietario.nombreCompleto, nuevo }
            }}
          </div>
        }
      </form>
      <div hkModalPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button
          hk-button
          tipo="submit"
          form="form-propietario"
          icono="check"
          [cargando]="guardando()"
          [disabled]="!nuevoNombre()"
        >
          {{ 'motos.propietario.confirmar' | transloco }}
        </button>
      </div>
    </hk-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CambiarPropietarioModal {
  private readonly api = inject(MotocicletasApiService);
  protected readonly ref = inject<DialogRef<Motocicleta>>(DialogRef);
  protected readonly moto = inject<Motocicleta>(DIALOG_DATA);
  protected readonly clientes = buscadorClientes(this.moto.propietario.id);
  protected readonly guardando = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    cliente: [null as string | null, Validators.required],
  });
  private readonly elegido = toSignal(this.form.controls.cliente.valueChanges, {
    initialValue: null,
  });
  /** Se guarda el nombre al elegir porque las opciones cambian con cada búsqueda. */
  private readonly nombres = new Map<string, string>();
  protected readonly nuevoNombre = computed(() => {
    for (const o of this.clientes.opciones()) this.nombres.set(o.valor, o.etiqueta);
    const id = this.elegido();
    return id ? (this.nombres.get(id) ?? null) : null;
  });

  protected confirmar(): void {
    const id = this.form.controls.cliente.value;
    if (this.guardando() || !id) return;
    this.guardando.set(true);
    this.api
      .cambiarPropietario(this.moto.id, Number(id))
      .pipe(finalize(() => this.guardando.set(false)))
      // Los errores (p. ej. CLIENTE_INACTIVO) los muestra el interceptor como toast.
      .subscribe((actualizada) => this.ref.close(actualizada));
  }
}
