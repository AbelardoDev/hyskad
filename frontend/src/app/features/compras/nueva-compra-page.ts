import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  numberAttribute,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { finalize, map } from 'rxjs';

import { conFormulario, erroresManejados } from '../../core/http/contexto-http';
import { calcularTotales, subtotalLinea } from '../../core/utils/dinero';
import { formatoCop } from '../../core/utils/formato';
import { CopPipe } from '../../core/utils/formato.pipes';
import { LanguageService } from '../../core/i18n/language.service';
import { aCantidad, cantidad } from '../../core/utils/validadores';
import { HkButton } from '../../shared/ui/button/button';
import { HkIconButton } from '../../shared/ui/button/icon-button';
import { HkCard } from '../../shared/ui/card/card';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { HkCombobox } from '../../shared/ui/forms/combobox';
import { HkDateInput } from '../../shared/ui/forms/date-input';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkMoneyInput } from '../../shared/ui/forms/money-input';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { ToastService } from '../../shared/ui/toast/toast';
import { buscadorProductos } from '../inventario/buscador-productos';
import { buscadorProveedores } from '../proveedores/buscador-proveedores';
import { ProveedoresApiService } from '../proveedores/proveedores-api.service';
import { ComprasApiService, NuevaCompra } from './compras-api.service';

/** Si el costo ingresado se aleja más que esto del costo promedio actual, se advierte. */
export const DIFERENCIA_COSTO_AVISO = 0.3;

/** Hoy en Colombia como `aaaa-mm-dd` (la fecha de la factura no puede ser futura). */
export function hoyEnBogota(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(ahora);
}

/** Diferencia relativa entre el costo ingresado y el promedio; `null` si no hay promedio. */
export function diferenciaCosto(costo: number | null, promedio: number | undefined): number | null {
  if (costo === null || promedio === undefined || promedio <= 0) return null;
  const diferencia = (costo - promedio) / promedio;
  return Math.abs(diferencia) > DIFERENCIA_COSTO_AVISO ? diferencia : null;
}

const noFutura = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value > hoyEnBogota() ? { fechaFutura: true } : null;

type FilaForm = FormGroup<{
  productoId: FormControl<string | null>;
  cantidad: FormControl<string>;
  costoUnitario: FormControl<number | null>;
}>;

/** Cada fila tiene su propio buscador de productos (las opciones dependen de lo que se escribe). */
interface Fila {
  clave: number;
  form: FilaForm;
  productos: ReturnType<typeof buscadorProductos>;
}

/**
 * Nueva compra (RF21): proveedor, factura, ítems con producto (stock y costo visibles), cantidad
 * y costo sin IVA, totales en vivo y confirmación con resumen. El backend valida todo y registra
 * la compra en una sola transacción.
 */
@Component({
  selector: 'hk-nueva-compra-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    LucideDynamicIcon,
    CopPipe,
    HkButton,
    HkCard,
    HkCombobox,
    HkDateInput,
    HkFormField,
    HkIconButton,
    HkInput,
    HkMoneyInput,
    HkPageHeader,
  ],
  template: `
    <hk-page-header
      [titulo]="'compras.nueva' | transloco"
      [subtitulo]="'compras.nueva_subtitulo' | transloco"
    >
      <a hk-button variante="secondary" icono="chevron-left" routerLink="/compras">
        {{ 'compras.titulo' | transloco }}
      </a>
    </hk-page-header>

    <form
      class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"
      [formGroup]="form"
      (ngSubmit)="confirmar()"
      novalidate
    >
      <div class="flex min-w-0 flex-col gap-6">
        <hk-card [titulo]="'compras.factura' | transloco">
          <div class="grid gap-5 sm:grid-cols-2">
            <hk-form-field
              class="sm:col-span-2"
              [etiqueta]="'compras.campos.proveedor' | transloco"
            >
              <hk-combobox
                formControlName="proveedorId"
                [opciones]="proveedores.opciones()"
                [cargando]="proveedores.cargando()"
                [filtrarLocal]="false"
                [placeholder]="'compras.buscar_proveedor' | transloco"
                (busqueda)="proveedores.buscar($event)"
              />
            </hk-form-field>
            <hk-form-field [etiqueta]="'compras.campos.factura' | transloco">
              <hk-input
                formControlName="numeroFacturaProveedor"
                autocompletar="off"
                [maxCaracteres]="40"
              />
            </hk-form-field>
            <hk-form-field [etiqueta]="'compras.campos.fecha' | transloco">
              <hk-date-input formControlName="fecha" [max]="hoy" />
            </hk-form-field>
          </div>
        </hk-card>

        <hk-card
          [titulo]="'compras.items' | transloco"
          [subtitulo]="'compras.items_ayuda' | transloco"
        >
          <ol class="flex flex-col gap-4" formArrayName="items">
            @for (fila of filas(); track fila.clave; let i = $index) {
              <li
                class="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[minmax(0,5fr)_minmax(0,2fr)_minmax(0,3fr)_auto] md:items-start md:border-0 md:p-0"
                [formGroupName]="i"
              >
                <hk-form-field [etiqueta]="'compras.campos.producto' | transloco: { n: i + 1 }">
                  <hk-combobox
                    formControlName="productoId"
                    [opciones]="fila.productos.opciones()"
                    [cargando]="fila.productos.cargando()"
                    [filtrarLocal]="false"
                    [placeholder]="'inventario.ajuste.buscar_producto' | transloco"
                    (busqueda)="fila.productos.buscar($event)"
                  />
                </hk-form-field>
                <hk-form-field [etiqueta]="'compras.campos.cantidad' | transloco">
                  <hk-input formControlName="cantidad" modoTeclado="decimal" [maxCaracteres]="13" />
                </hk-form-field>
                <div>
                  <hk-form-field [etiqueta]="'compras.campos.costo' | transloco">
                    <hk-money-input formControlName="costoUnitario" />
                  </hk-form-field>
                  @if (avisoCosto(i); as aviso) {
                    <p
                      class="mt-1.5 flex items-start gap-1 text-xs font-medium text-warning-ink"
                      role="status"
                    >
                      <svg
                        lucideIcon="triangle-alert"
                        class="mt-px size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {{ aviso }}
                    </p>
                  }
                </div>
                <div class="flex items-center justify-between gap-3 md:mt-7 md:justify-end">
                  <span class="text-sm font-semibold text-fg tabular md:min-w-24 md:text-right">
                    {{ subtotalFila(i) | cop }}
                  </span>
                  <button
                    hk-icon-button
                    type="button"
                    icono="trash"
                    tamano="sm"
                    [etiqueta]="'compras.quitar_item' | transloco: { n: i + 1 }"
                    [disabled]="filas().length === 1"
                    (click)="quitarFila(i)"
                  ></button>
                </div>
              </li>
            }
          </ol>
          <button
            hk-button
            type="button"
            variante="secondary"
            icono="plus"
            class="mt-4"
            (click)="agregarFila()"
          >
            {{ 'compras.agregar_item' | transloco }}
          </button>
        </hk-card>
      </div>

      <hk-card class="self-start xl:sticky xl:top-24" [titulo]="'compras.totales' | transloco">
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-muted">{{ 'compras.subtotal' | transloco }}</dt>
            <dd class="font-medium text-fg tabular">{{ totales().subtotal | cop }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">{{ 'compras.iva' | transloco: { porcentaje: iva() } }}</dt>
            <dd class="font-medium text-fg tabular">{{ totales().impuesto | cop }}</dd>
          </div>
          <div class="flex justify-between border-t border-border pt-3 text-base">
            <dt class="font-semibold text-fg">{{ 'compras.total' | transloco }}</dt>
            <dd class="font-display text-xl font-bold text-fg tabular">
              {{ totales().total | cop }}
            </dd>
          </div>
        </dl>
        <p class="mt-3 text-xs text-muted">{{ 'compras.costos_sin_iva' | transloco }}</p>
        <button hk-button tipo="submit" icono="check" class="mt-5 w-full" [cargando]="guardando()">
          {{ 'compras.registrar' | transloco }}
        </button>
      </hk-card>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NuevaCompraPage {
  private readonly api = inject(ComprasApiService);
  private readonly proveedoresApi = inject(ProveedoresApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly idioma = inject(LanguageService);

  /** Desde la ficha del proveedor: `?proveedorId=`. */
  readonly proveedorId = input(undefined, {
    transform: (v: unknown) => (v ? numberAttribute(v) : undefined),
  });

  protected readonly hoy = hoyEnBogota();
  protected readonly guardando = signal(false);
  protected readonly proveedores = buscadorProveedores({ soloActivos: true });
  private siguienteClave = 0;

  protected readonly form = this.fb.group({
    proveedorId: [null as string | null, Validators.required],
    numeroFacturaProveedor: ['', [Validators.required, Validators.maxLength(40)]],
    fecha: [this.hoy, [Validators.required, noFutura]],
    items: new FormArray<FilaForm>([]),
  });
  protected readonly filas = signal<Fila[]>([]);

  private readonly ivaRecurso = rxResource({
    stream: () => this.api.iva(erroresManejados()).pipe(map((r) => r.porcentaje)),
  });
  protected readonly iva = computed(() => this.ivaRecurso.value() ?? 0);
  private readonly valores = toSignal(this.form.controls.items.valueChanges, { initialValue: [] });
  protected readonly totales = computed(() => {
    this.valores();
    return calcularTotales(
      this.filas().map((f) => this.lineaDe(f.form)),
      0,
      this.iva(),
    );
  });

  constructor() {
    this.agregarFila();
    effect(() => {
      const id = this.proveedorId();
      if (!id) return;
      untracked(() =>
        this.proveedoresApi.obtener(id, erroresManejados()).subscribe((proveedor) => {
          if (!proveedor.activo) return;
          this.proveedores.incluir(proveedor);
          this.form.controls.proveedorId.setValue(String(proveedor.id));
        }),
      );
    });
  }

  protected agregarFila(): void {
    const form: FilaForm = this.fb.group({
      productoId: [null as string | null, Validators.required],
      cantidad: ['', [Validators.required, cantidad({ positiva: true })]],
      costoUnitario: [null as number | null, [Validators.required, Validators.min(0)]],
    });
    const productos = runInInjectionContext(this.injector, () =>
      buscadorProductos({ soloActivos: true, conCosto: true }),
    );
    this.form.controls.items.push(form);
    this.filas.update((filas) => [...filas, { clave: this.siguienteClave++, form, productos }]);
  }

  protected quitarFila(indice: number): void {
    this.form.controls.items.removeAt(indice);
    this.filas.update((filas) => filas.filter((_, i) => i !== indice));
  }

  protected subtotalFila(indice: number): number {
    this.valores();
    const fila = this.filas()[indice];
    if (!fila) return 0;
    const { cantidad: c, precioUnitario } = this.lineaDe(fila.form);
    return subtotalLinea(c, precioUnitario);
  }

  /** Aviso si el costo se aleja más de un 30 % del costo promedio actual del producto. */
  protected avisoCosto(indice: number): string | null {
    this.valores();
    const fila = this.filas()[indice];
    if (!fila) return null;
    const producto = fila.productos.producto(fila.form.controls.productoId.value);
    const costo = fila.form.controls.costoUnitario.value;
    const diferencia = diferenciaCosto(costo, producto?.costoPromedio);
    if (diferencia === null || !producto?.costoPromedio) return null;
    return this.transloco.translate(
      diferencia > 0 ? 'compras.aviso_costo_mayor' : 'compras.aviso_costo_menor',
      {
        porcentaje: Math.round(Math.abs(diferencia) * 100),
        promedio: formatoCop(producto.costoPromedio, this.idioma.locale()),
      },
    );
  }

  protected async confirmar(): Promise<void> {
    if (this.guardando()) return;
    this.marcarRepetidos();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const proveedor = this.proveedores
      .opciones()
      .find((o) => o.valor === this.form.controls.proveedorId.value);
    const confirmado = await this.confirmacion.pedir({
      titulo: this.transloco.translate('compras.confirmar.titulo'),
      mensaje: this.transloco.translate('compras.confirmar.mensaje', {
        n: this.filas().length,
        proveedor: proveedor?.etiqueta ?? '',
        total: formatoCop(this.totales().total, this.idioma.locale()),
      }),
      textoConfirmar: this.transloco.translate('compras.registrar'),
    });
    if (!confirmado) return;
    this.registrar();
  }

  private registrar(): void {
    const v = this.form.getRawValue();
    const datos: NuevaCompra = {
      proveedorId: Number(v.proveedorId),
      numeroFacturaProveedor: v.numeroFacturaProveedor.trim(),
      fecha: v.fecha,
      items: this.filas().map((f) => {
        const linea = this.lineaDe(f.form);
        return {
          productoId: Number(f.form.controls.productoId.value),
          cantidad: linea.cantidad,
          costoUnitario: linea.precioUnitario,
        };
      }),
    };
    this.guardando.set(true);
    this.api
      .registrar(datos, conFormulario(this.form))
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (compra) => {
          this.toast.exito(
            this.transloco.translate('compras.registrada', { numero: compra.numero }),
          );
          void this.router.navigate(['/compras', compra.id]);
        },
        error: () => enfocarPrimerError(this.host.nativeElement, this.injector),
      });
  }

  /** Un producto no puede ir en dos filas (el backend también lo rechaza). */
  private marcarRepetidos(): void {
    const vistos = new Set<string>();
    for (const { form } of this.filas()) {
      const control = form.controls.productoId;
      const id = control.value;
      if (!id) continue;
      if (vistos.has(id)) {
        control.setErrors({ servidor: 'PRODUCTO_REPETIDO' });
        control.markAsTouched();
      }
      vistos.add(id);
    }
  }

  private lineaDe(form: FilaForm): { cantidad: number; precioUnitario: number } {
    return {
      cantidad: aCantidad(form.controls.cantidad.value) ?? 0,
      precioUnitario: form.controls.costoUnitario.value ?? 0,
    };
  }
}
