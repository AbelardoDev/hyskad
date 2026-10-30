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
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { finalize, map, switchMap, timer } from 'rxjs';

import { conFormulario, erroresManejados } from '../../core/http/contexto-http';
import { LanguageService } from '../../core/i18n/language.service';
import { formatoCantidad, formatoCop } from '../../core/utils/formato';
import { CantidadPipe, CopPipe } from '../../core/utils/formato.pipes';
import { aCantidad, cantidad } from '../../core/utils/validadores';
import { HkButton } from '../../shared/ui/button/button';
import { HkModal } from '../../shared/ui/dialog/modal';
import { HkCombobox, OpcionCombobox } from '../../shared/ui/forms/combobox';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { InventarioApiService, Producto } from '../inventario/inventario-api.service';
import { hastaDisponible } from '../ventas/punto-venta-page';
import { Orden, OrdenesApiService } from './ordenes-api.service';

const ESPERA_MS = 250;
const RESULTADOS = 10;

/**
 * Agregar un repuesto a la orden (RF19, RN-29): busca productos activos mostrando el disponible y
 * el precio, no deja pasar del disponible y avisa si la reserva lo deja bajo el mínimo. Si el
 * producto ya está en la orden, el backend suma la cantidad. Cierra con la orden actualizada.
 */
@Component({
  selector: 'hk-agregar-repuesto-modal',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    LucideDynamicIcon,
    CantidadPipe,
    CopPipe,
    HkButton,
    HkCombobox,
    HkFormField,
    HkInput,
    HkModal,
  ],
  template: `
    <hk-modal [titulo]="'taller.items.agregar_repuesto' | transloco">
      <form
        id="form-repuesto"
        class="space-y-5"
        [formGroup]="form"
        (ngSubmit)="guardar()"
        novalidate
      >
        <hk-form-field [etiqueta]="'taller.items.producto' | transloco">
          <hk-combobox
            formControlName="productoId"
            [opciones]="opciones()"
            [cargando]="resultados.isLoading()"
            [filtrarLocal]="false"
            [placeholder]="'taller.items.buscar_producto' | transloco"
            (busqueda)="texto.set($event.trim())"
          />
        </hk-form-field>
        @if (elegido(); as p) {
          <p class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span
              >{{ 'taller.items.disponible' | transloco }}:
              <strong class="text-fg tabular">{{ p.stockDisponible | cantidad }}</strong></span
            >
            <span
              >{{ 'taller.items.precio' | transloco }}:
              <strong class="text-fg tabular">{{ p.precioVenta | cop }}</strong></span
            >
          </p>
        }
        <hk-form-field class="sm:max-w-40" [etiqueta]="'taller.items.cantidad' | transloco">
          <hk-input formControlName="cantidad" modoTeclado="decimal" [maxCaracteres]="13" />
        </hk-form-field>
        @if (quedaBajoMinimo()) {
          <p
            class="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-ink"
            role="status"
          >
            <svg lucideIcon="triangle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {{ 'taller.items.bajo_minimo' | transloco: { minimo: elegido()?.stockMinimo } }}
          </p>
        }
      </form>
      <div hkModalPie class="contents">
        <button hk-button variante="secondary" tamano="lg" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button
          hk-button
          tipo="submit"
          tamano="lg"
          form="form-repuesto"
          icono="plus"
          [cargando]="guardando()"
        >
          {{ 'taller.items.agregar' | transloco }}
        </button>
      </div>
    </hk-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgregarRepuestoModal {
  private readonly api = inject(OrdenesApiService);
  private readonly inventario = inject(InventarioApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly idioma = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly ref = inject<DialogRef<Orden>>(DialogRef);
  private readonly orden = inject<Orden>(DIALOG_DATA);
  protected readonly guardando = signal(false);
  protected readonly texto = signal('');

  protected readonly form = inject(NonNullableFormBuilder).group({
    productoId: ['', Validators.required],
    cantidad: ['1', [Validators.required, cantidad({ positiva: true })]],
  });

  protected readonly resultados = rxResource({
    params: () => this.texto(),
    stream: ({ params }) =>
      timer(params ? ESPERA_MS : 0).pipe(
        switchMap(() =>
          this.inventario.productos(
            {
              q: params,
              categoriaId: null,
              activo: true,
              soloStockBajo: false,
              page: 0,
              size: RESULTADOS,
              sort: 'nombre,asc',
            },
            erroresManejados(),
          ),
        ),
        map((pagina) => pagina.content),
      ),
  });
  /** El elegido se conserva aunque la siguiente búsqueda ya no lo traiga. */
  private readonly conocido = signal<Producto | null>(null);
  private readonly productoId = toSignal(this.form.controls.productoId.valueChanges, {
    initialValue: '',
  });
  private readonly cantidadTexto = toSignal(this.form.controls.cantidad.valueChanges, {
    initialValue: '1',
  });

  protected readonly opciones = computed<OpcionCombobox[]>(() =>
    (this.resultados.value() ?? []).map((p) => ({
      valor: String(p.id),
      etiqueta: `${p.codigo} · ${p.nombre}`,
      descripcion: this.transloco.translate('taller.items.opcion_producto', {
        disponible: formatoCantidad(p.stockDisponible, this.idioma.locale()),
        precio: formatoCop(p.precioVenta, this.idioma.locale()),
      }),
    })),
  );
  protected readonly elegido = computed<Producto | null>(() => {
    const id = Number(this.productoId());
    return (
      (this.resultados.value() ?? []).find((p) => p.id === id) ??
      (this.conocido()?.id === id ? this.conocido() : null)
    );
  });
  /** RN-14: la reserva baja el disponible; se avisa si queda en el mínimo o por debajo. */
  protected readonly quedaBajoMinimo = computed(() => {
    const p = this.elegido();
    const cuanto = aCantidad(this.cantidadTexto());
    return p !== null && cuanto !== null && p.stockDisponible - cuanto <= p.stockMinimo;
  });

  constructor() {
    this.form.controls.productoId.valueChanges.subscribe(() => {
      const p = this.elegido();
      this.conocido.set(p);
      const control = this.form.controls.cantidad;
      control.setValidators([
        Validators.required,
        cantidad({ positiva: true }),
        ...(p ? [hastaDisponible(p.stockDisponible)] : []),
      ]);
      control.updateValueAndValidity();
    });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.api
      .agregarRepuesto(
        this.orden,
        Number(v.productoId),
        aCantidad(v.cantidad) ?? 0,
        conFormulario(this.form),
      )
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe((orden) => this.ref.close(orden));
  }
}
