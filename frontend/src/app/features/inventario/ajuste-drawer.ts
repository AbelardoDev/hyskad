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
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';
import { finalize, map, startWith } from 'rxjs';

import { conFormulario } from '../../core/http/contexto-http';
import { CantidadPipe } from '../../core/utils/formato.pipes';
import { aCantidad, cantidad } from '../../core/utils/validadores';
import { HkButton } from '../../shared/ui/button/button';
import { HkDrawer } from '../../shared/ui/dialog/drawer';
import { HkCombobox } from '../../shared/ui/forms/combobox';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkMoneyInput } from '../../shared/ui/forms/money-input';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkTextarea } from '../../shared/ui/forms/textarea';
import { buscadorProductos } from './buscador-productos';
import { Ajuste, InventarioApiService, Movimiento, Producto } from './inventario-api.service';

export interface DatosAjuste {
  /** Desde la ficha del producto: queda fijo. */
  producto?: Producto;
}

/** RN-13: el motivo de un ajuste tiene al menos 10 caracteres (`InventarioService.MOTIVO_MINIMO`). */
export const MOTIVO_MINIMO = 10;
const TIPOS = ['ENTRADA', 'SALIDA'] as const;

/** Resultado de aplicar el ajuste al producto, para mostrarlo antes de confirmar. */
export function stockResultante(
  producto: Pick<Producto, 'stockActual' | 'stockDisponible'>,
  tipo: Ajuste['tipo'],
  valor: number | null,
): { resultante: number; excede: boolean } | null {
  if (valor === null || valor <= 0) return null;
  // Se redondea a centavos para no arrastrar errores de coma flotante (12.5 - 0.1…)
  const resultante =
    Math.round((producto.stockActual + (tipo === 'ENTRADA' ? valor : -valor)) * 100) / 100;
  return { resultante, excede: tipo === 'SALIDA' && valor > producto.stockDisponible };
}

/** Ajuste manual de inventario (RF18, RN-13): muestra el stock resultante antes de confirmar. */
@Component({
  selector: 'hk-ajuste-drawer',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    CantidadPipe,
    HkButton,
    HkCombobox,
    HkDrawer,
    HkFormField,
    HkInput,
    HkMoneyInput,
    HkSelect,
    HkTextarea,
  ],
  template: `
    <hk-drawer [titulo]="'inventario.ajuste.titulo' | transloco">
      <form id="form-ajuste" class="space-y-5" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        @if (fijo; as p) {
          <div class="rounded-xl border border-border bg-surface-2/60 px-4 py-3">
            <p class="text-xs text-muted">{{ 'inventario.campos.producto' | transloco }}</p>
            <p class="font-medium text-fg">{{ p.nombre }}</p>
            <p class="font-mono text-xs text-muted">{{ p.codigo }}</p>
          </div>
        } @else {
          <hk-form-field
            [etiqueta]="'inventario.campos.producto' | transloco"
            [ayuda]="'inventario.ajuste.producto_ayuda' | transloco"
          >
            <hk-combobox
              formControlName="productoId"
              [opciones]="productos.opciones()"
              [cargando]="productos.cargando()"
              [filtrarLocal]="false"
              [placeholder]="'inventario.ajuste.buscar_producto' | transloco"
              (busqueda)="productos.buscar($event)"
            />
          </hk-form-field>
        }

        <div class="grid gap-5 sm:grid-cols-2">
          <hk-form-field [etiqueta]="'inventario.ajuste.tipo' | transloco">
            <hk-select formControlName="tipo" [opciones]="opcionesTipo()" />
          </hk-form-field>
          <hk-form-field
            [etiqueta]="'inventario.ajuste.cantidad' | transloco"
            [ayuda]="
              seleccionado()
                ? ('inventario.unidades.' + seleccionado()!.unidad | transloco)
                : undefined
            "
          >
            <hk-input formControlName="cantidad" modoTeclado="decimal" [maxCaracteres]="13" />
          </hk-form-field>
        </div>

        @if (tipo() === 'ENTRADA') {
          <hk-form-field
            [etiqueta]="'inventario.ajuste.costo' | transloco"
            [ayuda]="'inventario.ajuste.costo_ayuda' | transloco"
            [opcional]="true"
          >
            <hk-money-input formControlName="costoUnitario" />
          </hk-form-field>
        }

        <hk-form-field
          [etiqueta]="'inventario.ajuste.motivo' | transloco"
          [ayuda]="'inventario.ajuste.motivo_ayuda' | transloco"
        >
          <hk-textarea formControlName="motivo" [filas]="3" [maxCaracteres]="500" />
        </hk-form-field>

        @if (seleccionado(); as p) {
          <div
            class="rounded-xl border p-4"
            [class]="
              vistaPrevia()?.excede
                ? 'border-danger bg-danger-soft'
                : 'border-border bg-surface-2/60'
            "
            role="status"
          >
            <dl class="grid grid-cols-3 gap-3 text-center">
              <div>
                <dt class="text-xs text-muted">
                  {{ 'inventario.campos.stock_actual' | transloco }}
                </dt>
                <dd class="mt-0.5 text-lg font-semibold text-fg tabular">
                  {{ p.stockActual | cantidad }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">{{ 'inventario.campos.reservado' | transloco }}</dt>
                <dd class="mt-0.5 text-lg font-semibold text-fg tabular">
                  {{ p.stockReservado | cantidad }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">{{ 'inventario.ajuste.resultante' | transloco }}</dt>
                <dd
                  class="mt-0.5 text-lg font-semibold tabular"
                  [class]="vistaPrevia()?.excede ? 'text-danger-ink' : 'text-fg'"
                >
                  {{ vistaPrevia() ? (vistaPrevia()!.resultante | cantidad) : '—' }}
                </dd>
              </div>
            </dl>
            @if (vistaPrevia()?.excede) {
              <p class="mt-3 text-center text-xs font-medium text-danger-ink">
                {{
                  'inventario.ajuste.excede'
                    | transloco: { disponible: (p.stockDisponible | cantidad) }
                }}
              </p>
            }
          </div>
        }
      </form>
      <div hkDrawerPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button
          hk-button
          tipo="submit"
          form="form-ajuste"
          icono="check"
          [cargando]="guardando()"
          [disabled]="vistaPrevia()?.excede"
        >
          {{ 'inventario.ajuste.confirmar' | transloco }}
        </button>
      </div>
    </hk-drawer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AjusteDrawer {
  private readonly api = inject(InventarioApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly ref = inject<DialogRef<Movimiento>>(DialogRef);
  protected readonly fijo = inject<DatosAjuste | undefined>(DIALOG_DATA)?.producto;
  protected readonly guardando = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    productoId: [this.fijo ? String(this.fijo.id) : (null as string | null), Validators.required],
    tipo: ['ENTRADA' as Ajuste['tipo'], Validators.required],
    cantidad: ['', [Validators.required, cantidad({ positiva: true })]],
    costoUnitario: [null as number | null, Validators.min(0)],
    motivo: [
      '',
      [Validators.required, Validators.minLength(MOTIVO_MINIMO), Validators.maxLength(500)],
    ],
  });

  protected readonly tipo = toSignal(this.form.controls.tipo.valueChanges, {
    initialValue: this.form.controls.tipo.value,
  });
  private readonly cantidadEscrita = toSignal(
    this.form.controls.cantidad.valueChanges.pipe(map((v) => aCantidad(v))),
    { initialValue: null },
  );
  private readonly productoId = toSignal(
    this.form.controls.productoId.valueChanges.pipe(startWith(this.form.controls.productoId.value)),
    { initialValue: this.form.controls.productoId.value },
  );

  /** Productos activos buscados en el servidor, con el disponible visible. */
  protected readonly productos = buscadorProductos({ soloActivos: true });
  protected readonly seleccionado = computed<Producto | null>(
    () => this.fijo ?? this.productos.producto(this.productoId()),
  );
  protected readonly vistaPrevia = computed(() => {
    const producto = this.seleccionado();
    return producto ? stockResultante(producto, this.tipo(), this.cantidadEscrita()) : null;
  });

  private readonly textosTipo = translateSignal(TIPOS.map((t) => `inventario.ajuste.tipos.${t}`));
  protected readonly opcionesTipo = computed<OpcionSelect[]>(() =>
    TIPOS.map((valor, i) => ({ valor, etiqueta: this.textosTipo()[i] })),
  );

  protected guardar(): void {
    if (this.guardando() || this.vistaPrevia()?.excede) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const v = this.form.getRawValue();
    const datos: Ajuste = {
      productoId: Number(v.productoId),
      tipo: v.tipo,
      cantidad: aCantidad(v.cantidad) ?? 0,
      costoUnitario: v.tipo === 'ENTRADA' ? v.costoUnitario : null,
      motivo: v.motivo.trim(),
    };
    this.guardando.set(true);
    this.api
      .ajustar(datos, conFormulario(this.form))
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (movimiento) => this.ref.close(movimiento),
        error: () => enfocarPrimerError(this.host.nativeElement, this.injector),
      });
  }
}
