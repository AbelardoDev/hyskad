import { HttpErrorResponse } from '@angular/common/http';
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
import {
  AbstractControl,
  FormArray,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { finalize, map, merge, of, switchMap, timer } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { conFormulario, erroresManejados, problemaDe } from '../../core/http/contexto-http';
import { LanguageService } from '../../core/i18n/language.service';
import { calcularTotales } from '../../core/utils/dinero';
import { formatoCantidad, formatoCop } from '../../core/utils/formato';
import { CantidadPipe, CopPipe } from '../../core/utils/formato.pipes';
import { aCantidad, cantidad } from '../../core/utils/validadores';
import { HkButton } from '../../shared/ui/button/button';
import { HkIconButton } from '../../shared/ui/button/icon-button';
import { HkCard } from '../../shared/ui/card/card';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkCombobox } from '../../shared/ui/forms/combobox';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkMoneyInput } from '../../shared/ui/forms/money-input';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { buscadorClientes } from '../clientes/buscador-clientes';
import { ClienteFormDrawer, DatosFormCliente } from '../clientes/cliente-form-drawer';
import { Cliente } from '../clientes/clientes-api.service';
import { ConfiguracionApiService } from '../configuracion/configuracion-api.service';
import { InventarioApiService, Producto } from '../inventario/inventario-api.service';
import {
  MetodoPago,
  METODOS_PAGO,
  NuevaVenta,
  Venta,
  VentasApiService,
} from './ventas-api.service';

const RESULTADOS = 8;
const ICONOS_PAGO: Record<MetodoPago, string> = {
  EFECTIVO: 'banknote',
  TRANSFERENCIA: 'arrow-left-right',
  TARJETA: 'credit-card',
  OTRO: 'ellipsis',
};

/** No vender más de lo disponible (RN-19): `{ maxDisponible: { max } }`. */
export function hastaDisponible(disponible: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = typeof control.value === 'string' ? aCantidad(control.value) : null;
    return valor !== null && valor > disponible ? { maxDisponible: { max: disponible } } : null;
  };
}

/** Cambio en efectivo: lo recibido menos el total; `null` si no se ha escrito lo recibido. */
export function cambioEfectivo(recibido: number | null, total: number): number | null {
  return recibido === null ? null : Math.round((recibido - total) * 100) / 100;
}

interface Linea {
  producto: Producto;
  cantidad: FormControl<string>;
}

/**
 * Punto de venta (RN-18 a RN-20), pensado para atender rápido y solo con teclado: buscar y Enter
 * agrega, el carrito no deja pasar del disponible, los totales se calculan como en el backend y en
 * efectivo se ve el cambio en grande. Al terminar muestra el número y el comprobante.
 */
@Component({
  selector: 'hk-punto-venta-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    LucideDynamicIcon,
    CantidadPipe,
    CopPipe,
    HkButton,
    HkCard,
    HkCombobox,
    HkEmptyState,
    HkFormField,
    HkIconButton,
    HkInput,
    HkMoneyInput,
    HkPageHeader,
  ],
  host: { '(document:keydown)': 'alTeclear($event)' },
  template: `
    @if (vendida(); as v) {
      <div class="mx-auto mt-6 max-w-lg">
        <hk-card>
          <div class="flex flex-col items-center gap-4 py-4 text-center" role="status">
            <span
              class="inline-flex size-16 items-center justify-center rounded-full bg-success-soft text-success-ink"
            >
              <svg lucideIcon="circle-check" class="size-8" aria-hidden="true" />
            </span>
            <h1 class="font-display text-2xl font-bold tracking-tight text-fg">
              {{ 'ventas.pos.exito_titulo' | transloco: { numero: v.numero } }}
            </h1>
            <p class="text-3xl font-bold text-fg tabular">{{ v.total | cop }}</p>
            @if (v.cambio !== null) {
              <p class="text-lg text-muted">
                {{ 'ventas.pos.cambio' | transloco }}
                <span class="font-display text-2xl font-bold text-success-ink tabular">{{
                  v.cambio | cop
                }}</span>
              </p>
            }
            <div class="mt-2 flex flex-wrap justify-center gap-3">
              <a
                hk-button
                variante="secondary"
                icono="download"
                [routerLink]="['/ventas', v.id, 'comprobante']"
              >
                {{ 'ventas.imprimir_comprobante' | transloco }}
              </a>
              <button #nuevaVenta hk-button icono="plus" (click)="reiniciar()">
                {{ 'ventas.nueva' | transloco }}
              </button>
            </div>
          </div>
        </hk-card>
      </div>
    } @else {
      <hk-page-header
        [titulo]="'ventas.nueva' | transloco"
        [subtitulo]="'ventas.pos.subtitulo' | transloco"
      >
        <div class="relative">
          <button
            hk-button
            variante="secondary"
            icono="info"
            [attr.aria-expanded]="verAtajos()"
            aria-controls="atajos-pos"
            (click)="verAtajos.set(!verAtajos())"
          >
            {{ 'ventas.pos.atajos' | transloco }}
          </button>
          @if (verAtajos()) {
            <div id="atajos-pos" class="absolute right-0 z-20 mt-2 w-72 hk-overlay p-4 text-sm">
              <dl class="space-y-2">
                @for (atajo of atajos; track atajo.tecla) {
                  <div class="flex items-center justify-between gap-3">
                    <dt class="text-muted">{{ atajo.clave | transloco }}</dt>
                    <dd>
                      <kbd
                        class="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg"
                        >{{ atajo.tecla }}</kbd
                      >
                    </dd>
                  </div>
                }
              </dl>
            </div>
          }
        </div>
      </hk-page-header>

      <form
        class="grid gap-6 pb-40 lg:grid-cols-[minmax(0,1fr)_24rem] lg:pb-0"
        [formGroup]="form"
        (ngSubmit)="cobrar()"
        novalidate
      >
        <!-- Buscador de productos -->
        <hk-card class="self-start">
          <hk-input
            id="buscador-pos"
            tipo="search"
            icono="search"
            autocompletar="off"
            [etiquetaAccesible]="'ventas.pos.buscar' | transloco"
            [placeholder]="'ventas.pos.buscar' | transloco"
            [valor]="busqueda()"
            (valorChange)="buscar($event)"
            (keydown)="teclaEnBuscador($event)"
          />
          <ul
            class="mt-4 flex flex-col gap-2"
            [attr.aria-label]="'ventas.pos.resultados' | transloco"
          >
            @for (p of resultados(); track p.id; let i = $index) {
              <li>
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left hk-foco transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
                  [class]="i === resaltado() ? 'border-primary bg-primary-soft' : 'border-border'"
                  [disabled]="p.stockDisponible <= 0"
                  (click)="agregar(p)"
                >
                  <span class="min-w-0">
                    <span class="block truncate font-medium text-fg">{{ p.nombre }}</span>
                    <span class="font-mono text-xs text-muted">{{ p.codigo }}</span>
                  </span>
                  <span class="shrink-0 text-right">
                    <span class="block font-semibold text-fg tabular">{{
                      p.precioVenta | cop
                    }}</span>
                    <span
                      class="text-xs tabular"
                      [class]="p.stockDisponible > 0 ? 'text-muted' : 'text-danger-ink'"
                    >
                      {{
                        'ventas.pos.disponible' | transloco: { n: (p.stockDisponible | cantidad) }
                      }}
                    </span>
                  </span>
                </button>
              </li>
            } @empty {
              @if (busqueda()) {
                <li>
                  <hk-empty-state
                    compacto
                    icono="search-x"
                    [titulo]="'ventas.pos.sin_resultados' | transloco"
                  />
                </li>
              } @else {
                <li class="px-1 py-6 text-center text-sm text-muted">
                  {{ 'ventas.pos.ayuda_buscar' | transloco }}
                </li>
              }
            }
          </ul>
        </hk-card>

        <!-- Carrito: a la derecha en escritorio; hoja inferior en móvil -->
        <section
          class="flex flex-col rounded-2xl border border-border bg-surface shadow-card max-lg:fixed max-lg:inset-x-0 max-lg:z-20 max-lg:max-h-[75dvh] max-lg:rounded-b-none max-md:bottom-[calc(3.6rem+env(safe-area-inset-bottom))] md:max-lg:bottom-0 lg:sticky lg:top-24 lg:self-start"
          [attr.aria-label]="'ventas.pos.carrito' | transloco"
        >
          <button
            type="button"
            class="flex items-center justify-between gap-3 border-b border-border px-5 py-3 text-left hk-foco lg:hidden"
            [attr.aria-expanded]="hojaAbierta()"
            aria-controls="contenido-carrito"
            (click)="hojaAbierta.set(!hojaAbierta())"
          >
            <span class="text-sm font-medium text-fg">
              {{ 'ventas.pos.ver_carrito' | transloco: { n: lineas().length } }}
            </span>
            <span class="flex items-center gap-2">
              <span class="font-display text-lg font-bold text-fg tabular">{{
                totales().total | cop
              }}</span>
              <svg
                [lucideIcon]="hojaAbierta() ? 'chevron-down' : 'chevron-left'"
                class="size-4 text-muted"
                aria-hidden="true"
              />
            </span>
          </button>

          <div
            id="contenido-carrito"
            class="flex-col gap-5 overflow-y-auto p-5 lg:flex"
            [class.flex]="hojaAbierta()"
            [class.hidden]="!hojaAbierta()"
          >
            <h2 class="font-display text-base font-semibold text-fg max-lg:sr-only">
              {{ 'ventas.pos.carrito' | transloco }}
            </h2>
            @if (lineas().length === 0) {
              <p
                class="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted"
              >
                {{ 'ventas.pos.carrito_vacio' | transloco }}
              </p>
            } @else {
              <ul class="flex flex-col divide-y divide-border" formArrayName="items">
                @for (linea of lineas(); track linea.producto.id; let i = $index) {
                  <li class="flex items-start gap-3 py-3 first:pt-0">
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-fg">
                        {{ linea.producto.nombre }}
                      </p>
                      <p class="text-xs text-muted tabular">
                        {{ linea.producto.precioVenta | cop }} ·
                        {{
                          'ventas.pos.disponible'
                            | transloco: { n: (linea.producto.stockDisponible | cantidad) }
                        }}
                      </p>
                    </div>
                    <hk-form-field
                      class="w-24"
                      [etiqueta]="'ventas.pos.cantidad_de' | transloco: { n: i + 1 }"
                    >
                      <hk-input [formControlName]="i" modoTeclado="decimal" [maxCaracteres]="13" />
                    </hk-form-field>
                    <div class="flex flex-col items-end gap-1 pt-6">
                      <span class="text-sm font-semibold text-fg tabular">{{
                        subtotalDe(i) | cop
                      }}</span>
                      <button
                        hk-icon-button
                        type="button"
                        icono="trash"
                        tamano="sm"
                        [etiqueta]="
                          'ventas.pos.quitar' | transloco: { nombre: linea.producto.nombre }
                        "
                        (click)="quitar(i)"
                      ></button>
                    </div>
                  </li>
                }
              </ul>
            }

            <div class="grid gap-4">
              <div>
                <hk-form-field [etiqueta]="'ventas.campos.cliente' | transloco" [opcional]="true">
                  <hk-combobox
                    formControlName="clienteId"
                    [opciones]="clientes.opciones()"
                    [cargando]="clientes.cargando()"
                    [filtrarLocal]="false"
                    [placeholder]="'ventas.pos.consumidor_final' | transloco"
                    (busqueda)="clientes.buscar($event)"
                  />
                </hk-form-field>
                @if (puedeCrearClientes()) {
                  <button
                    type="button"
                    class="mt-1.5 rounded text-xs font-medium text-primary hk-foco hover:underline"
                    (click)="nuevoCliente()"
                  >
                    + {{ 'clientes.nuevo' | transloco }}
                  </button>
                }
              </div>
              <hk-form-field [etiqueta]="'ventas.campos.descuento' | transloco" [opcional]="true">
                <hk-money-input formControlName="descuento" />
              </hk-form-field>
            </div>

            <dl class="space-y-1.5 border-t border-border pt-4 text-sm">
              <div class="flex justify-between">
                <dt class="text-muted">{{ 'compras.subtotal' | transloco }}</dt>
                <dd class="font-medium text-fg tabular">{{ totales().subtotal | cop }}</dd>
              </div>
              @if (totales().descuento > 0) {
                <div class="flex justify-between">
                  <dt class="text-muted">{{ 'ventas.campos.descuento' | transloco }}</dt>
                  <dd class="font-medium text-fg tabular">−{{ totales().descuento | cop }}</dd>
                </div>
              }
              <div class="flex justify-between">
                <dt class="text-muted">{{ 'compras.iva' | transloco: { porcentaje: iva() } }}</dt>
                <dd class="font-medium text-fg tabular">{{ totales().impuesto | cop }}</dd>
              </div>
              <div class="flex items-baseline justify-between pt-2">
                <dt class="font-semibold text-fg">{{ 'compras.total' | transloco }}</dt>
                <dd class="font-display text-2xl font-bold text-fg tabular">
                  {{ totales().total | cop }}
                </dd>
              </div>
            </dl>

            <fieldset>
              <legend class="mb-2 text-xs font-medium text-fg">
                {{ 'ventas.campos.metodo' | transloco }}
              </legend>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                @for (m of metodos; track m) {
                  <label
                    class="flex cursor-pointer flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                    [class]="
                      metodo() === m
                        ? 'border-primary bg-primary-soft text-primary-ink'
                        : 'border-border text-fg hover:bg-surface-2'
                    "
                  >
                    <input class="sr-only" type="radio" formControlName="metodoPago" [value]="m" />
                    <svg [lucideIcon]="iconosPago[m]" class="size-5" aria-hidden="true" />
                    {{ 'ventas.metodos.' + m | transloco }}
                  </label>
                }
              </div>
            </fieldset>

            @if (metodo() === 'EFECTIVO') {
              <div>
                <hk-form-field [etiqueta]="'ventas.campos.recibido' | transloco" [opcional]="true">
                  <hk-money-input formControlName="montoRecibido" />
                </hk-form-field>
                @if (cambio(); as c) {
                  <p
                    class="mt-3 flex items-baseline justify-between rounded-xl px-4 py-3"
                    role="status"
                    [class]="
                      c.valor >= 0
                        ? 'bg-success-soft text-success-ink'
                        : 'bg-danger-soft text-danger-ink'
                    "
                  >
                    <span class="text-sm font-medium">
                      {{ (c.valor >= 0 ? 'ventas.pos.cambio' : 'ventas.pos.falta') | transloco }}
                    </span>
                    <span class="font-display text-3xl font-bold tabular">{{
                      c.absoluto | cop
                    }}</span>
                  </p>
                }
              </div>
            } @else {
              <hk-form-field [etiqueta]="'ventas.campos.referencia' | transloco">
                <hk-input
                  formControlName="referenciaPago"
                  autocompletar="off"
                  [maxCaracteres]="60"
                />
              </hk-form-field>
            }

            <button hk-button tipo="submit" icono="check" class="w-full" [cargando]="guardando()">
              {{ 'ventas.pos.cobrar' | transloco }}
            </button>
          </div>
        </section>
      </form>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuntoVentaPage {
  private readonly api = inject(VentasApiService);
  private readonly configuracion = inject(ConfiguracionApiService);
  private readonly inventario = inject(InventarioApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly dialogos = inject(DialogosService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly transloco = inject(TranslocoService);
  private readonly idioma = inject(LanguageService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly metodos = METODOS_PAGO;
  protected readonly iconosPago = ICONOS_PAGO;
  protected readonly atajos = [
    { tecla: 'F2', clave: 'ventas.pos.atajo_buscar' },
    { tecla: 'Enter', clave: 'ventas.pos.atajo_agregar' },
    { tecla: '↑ ↓', clave: 'ventas.pos.atajo_mover' },
    { tecla: 'Esc', clave: 'ventas.pos.atajo_limpiar' },
    { tecla: 'F9', clave: 'ventas.pos.atajo_cobrar' },
  ];
  protected readonly clientes = buscadorClientes();
  protected readonly puedeCrearClientes = computed(() =>
    this.auth.tienePermiso('CLIENTES_GESTIONAR'),
  );
  protected readonly verAtajos = signal(false);
  protected readonly hojaAbierta = signal(false);
  protected readonly guardando = signal(false);
  protected readonly vendida = signal<Venta | null>(null);

  protected readonly form = this.fb.group({
    clienteId: [null as string | null],
    descuento: [null as number | null, Validators.min(0)],
    metodoPago: ['EFECTIVO' as MetodoPago, Validators.required],
    referenciaPago: ['', Validators.maxLength(60)],
    montoRecibido: [null as number | null, Validators.min(0)],
    items: new FormArray<FormControl<string>>([]),
  });
  protected readonly lineas = signal<Linea[]>([]);

  // Búsqueda de productos activos al escribir (código o nombre)
  protected readonly busqueda = signal('');
  protected readonly resaltado = signal(0);
  private readonly busquedaResultados = rxResource({
    params: () => this.busqueda(),
    stream: ({ params }) =>
      params
        ? timer(200).pipe(
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
            map((p) => p.content),
          )
        : of([]),
  });
  protected readonly resultados = computed(() => this.busquedaResultados.value() ?? []);

  private readonly ivaRecurso = rxResource({
    stream: () => this.configuracion.iva(erroresManejados()).pipe(map((r) => r.porcentaje)),
  });
  protected readonly iva = computed(() => this.ivaRecurso.value() ?? 0);

  private readonly valores = toSignal(merge(this.form.valueChanges, of(null)), {
    initialValue: null,
  });
  protected readonly metodo = toSignal(this.form.controls.metodoPago.valueChanges, {
    initialValue: this.form.controls.metodoPago.value,
  });
  protected readonly totales = computed(() => {
    this.valores();
    return calcularTotales(
      this.lineas().map((l) => ({
        cantidad: aCantidad(l.cantidad.value) ?? 0,
        precioUnitario: l.producto.precioVenta,
      })),
      Math.min(this.form.controls.descuento.value ?? 0, Number.MAX_SAFE_INTEGER),
      this.iva(),
    );
  });
  protected readonly cambio = computed(() => {
    this.valores();
    const valor = cambioEfectivo(this.form.controls.montoRecibido.value, this.totales().total);
    return valor === null ? null : { valor, absoluto: Math.abs(valor) };
  });

  constructor() {
    // RN-20: la referencia es obligatoria salvo en efectivo
    this.form.controls.metodoPago.valueChanges.subscribe((metodo) => {
      const referencia = this.form.controls.referenciaPago;
      if (metodo === 'EFECTIVO') referencia.removeValidators(Validators.required);
      else referencia.addValidators(Validators.required);
      referencia.updateValueAndValidity();
    });
  }

  protected buscar(texto: string | null): void {
    this.busqueda.set((texto ?? '').trim());
    this.resaltado.set(0);
  }

  protected teclaEnBuscador(evento: KeyboardEvent): void {
    const total = this.resultados().length;
    if (evento.key === 'ArrowDown' && total > 0) {
      evento.preventDefault();
      this.resaltado.set((this.resaltado() + 1) % total);
    } else if (evento.key === 'ArrowUp' && total > 0) {
      evento.preventDefault();
      this.resaltado.set((this.resaltado() - 1 + total) % total);
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      const producto = this.resultados()[this.resaltado()];
      if (producto) this.agregar(producto);
    } else if (evento.key === 'Escape') {
      this.buscar('');
    }
  }

  /** Atajos globales: F2 busca, F9 cobra. */
  protected alTeclear(evento: KeyboardEvent): void {
    if (this.vendida()) return;
    if (evento.key === 'F2') {
      evento.preventDefault();
      this.enfocarBusqueda();
    } else if (evento.key === 'F9') {
      evento.preventDefault();
      void this.cobrar();
    }
  }

  /** Agrega el producto (o suma 1 si ya está) sin pasar del disponible. */
  protected agregar(producto: Producto): void {
    if (producto.stockDisponible <= 0) return;
    const existente = this.lineas().find((l) => l.producto.id === producto.id);
    if (existente) {
      const actual = aCantidad(existente.cantidad.value) ?? 0;
      existente.cantidad.setValue(String(Math.min(actual + 1, producto.stockDisponible)));
    } else {
      const control = this.fb.control(String(Math.min(1, producto.stockDisponible)), [
        Validators.required,
        cantidad({ positiva: true }),
        hastaDisponible(producto.stockDisponible),
      ]);
      this.form.controls.items.push(control);
      this.lineas.update((l) => [...l, { producto, cantidad: control }]);
    }
    this.buscar('');
    this.enfocarBusqueda();
  }

  protected quitar(indice: number): void {
    this.form.controls.items.removeAt(indice);
    this.lineas.update((l) => l.filter((_, i) => i !== indice));
  }

  protected subtotalDe(indice: number): number {
    this.valores();
    const linea = this.lineas()[indice];
    return linea
      ? calcularTotales(
          [
            {
              cantidad: aCantidad(linea.cantidad.value) ?? 0,
              precioUnitario: linea.producto.precioVenta,
            },
          ],
          0,
          0,
        ).subtotal
      : 0;
  }

  protected nuevoCliente(): void {
    this.dialogos
      .abrirDrawer<ClienteFormDrawer, DatosFormCliente, Cliente>(ClienteFormDrawer, {
        datos: {},
        tamano: 'lg',
      })
      .closed.subscribe((cliente) => {
        if (!cliente) return;
        this.clientes.incluir(cliente);
        this.form.controls.clienteId.setValue(String(cliente.id));
      });
  }

  protected async cobrar(): Promise<void> {
    if (this.guardando()) return;
    if (this.lineas().length === 0) {
      this.enfocarBusqueda();
      return;
    }
    const { descuento, montoRecibido, metodoPago } = this.form.controls;
    if ((descuento.value ?? 0) > this.totales().subtotal) {
      descuento.setErrors({ servidor: 'DESCUENTO_INVALIDO' });
    }
    if (
      metodoPago.value === 'EFECTIVO' &&
      montoRecibido.value !== null &&
      montoRecibido.value < this.totales().total
    ) {
      montoRecibido.setErrors({ servidor: 'MONTO_INSUFICIENTE' });
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.hojaAbierta.set(true);
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const total = formatoCop(this.totales().total, this.idioma.locale());
    const cambio = this.cambio();
    const confirmado = await this.confirmacion.pedir({
      titulo: this.transloco.translate('ventas.pos.confirmar_titulo'),
      mensaje: this.transloco.translate(
        cambio && cambio.valor > 0
          ? 'ventas.pos.confirmar_con_cambio'
          : 'ventas.pos.confirmar_mensaje',
        {
          n: formatoCantidad(this.lineas().length, this.idioma.locale()),
          total,
          metodo: this.transloco.translate(`ventas.metodos.${metodoPago.value}`),
          cambio: cambio ? formatoCop(cambio.valor, this.idioma.locale()) : '',
        },
      ),
      textoConfirmar: this.transloco.translate('ventas.pos.cobrar'),
    });
    if (!confirmado) return;
    this.registrar();
  }

  protected reiniciar(): void {
    this.vendida.set(null);
    this.form.controls.items.clear();
    this.lineas.set([]);
    this.form.reset({
      clienteId: null,
      descuento: null,
      metodoPago: 'EFECTIVO',
      referenciaPago: '',
      montoRecibido: null,
    });
    this.hojaAbierta.set(false);
    setTimeout(() => this.enfocarBusqueda());
  }

  private registrar(): void {
    const v = this.form.getRawValue();
    const datos: NuevaVenta = {
      clienteId: v.clienteId ? Number(v.clienteId) : null,
      items: this.lineas().map((l) => ({
        productoId: l.producto.id,
        cantidad: aCantidad(l.cantidad.value) ?? 0,
      })),
      descuento: v.descuento ?? 0,
      metodoPago: v.metodoPago,
      referenciaPago: v.metodoPago === 'EFECTIVO' ? null : v.referenciaPago.trim(),
      montoRecibido: v.metodoPago === 'EFECTIVO' ? v.montoRecibido : null,
    };
    this.guardando.set(true);
    this.api
      .registrar(datos, conFormulario(this.form))
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (venta) => {
          this.vendida.set(venta);
          setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('button')?.focus());
        },
        error: (e: HttpErrorResponse) => {
          // Los errores por ítem llegan como items[i].productoId: se marcan en la cantidad de esa fila
          for (const { campo, code } of problemaDe(e.error)?.errors ?? []) {
            const indice = /^items\[(\d+)\]/.exec(campo)?.[1];
            const control =
              indice === undefined ? null : this.form.controls.items.at(Number(indice));
            control?.setErrors({ servidor: code });
            control?.markAsTouched();
          }
          this.hojaAbierta.set(true);
          enfocarPrimerError(this.host.nativeElement, this.injector);
        },
      });
  }

  private enfocarBusqueda(): void {
    this.host.nativeElement.querySelector<HTMLInputElement>('#buscador-pos input')?.focus();
  }
}
