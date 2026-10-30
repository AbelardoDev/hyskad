import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  inject,
  input,
  model,
  output,
  TemplateRef,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { HkEmptyState } from '../empty-state/empty-state';
import { HkCheckbox } from '../forms/checkbox';
import { HkPagination } from '../pagination/pagination';
import { HkSkeleton } from '../skeleton/skeleton';

export interface ColumnaTabla {
  clave: string;
  /** Texto ya traducido del encabezado. */
  etiqueta: string;
  ordenable?: boolean;
  alinear?: 'inicio' | 'centro' | 'fin';
  /** En la vista de tarjetas (móvil), esta columna es el título de la tarjeta. */
  principal?: boolean;
  ocultarEnMovil?: boolean;
  /** Montos y cantidades: números tabulares alineados. */
  numerica?: boolean;
}

export interface OrdenTabla {
  columna: string;
  direccion: 'asc' | 'desc';
}

export interface ContextoCelda<T> {
  $implicit: T;
  valor: unknown;
}

/** Plantilla de una celda: `<ng-template hkCelda="estado" let-fila>…</ng-template>`. */
@Directive({ selector: 'ng-template[hkCelda]' })
export class HkCelda {
  readonly hkCelda = input.required<string>();
  readonly plantilla = inject<TemplateRef<ContextoCelda<unknown>>>(TemplateRef);
}

const FILAS_SKELETON = 5;

/** Siguiente orden al pulsar un encabezado: asc → desc → sin orden. */
export function siguienteOrden(actual: OrdenTabla | null, columna: string): OrdenTabla | null {
  if (actual?.columna !== columna) return { columna, direccion: 'asc' };
  return actual.direccion === 'asc' ? { columna, direccion: 'desc' } : null;
}

/**
 * Tabla de datos con encabezado fijo, orden por columna, selección opcional, filas clicables,
 * skeleton, estado vacío y paginación. En móvil (< 768 px) se transforma en lista de tarjetas.
 * El orden y la paginación los aplica el consumidor (normalmente en el backend).
 */
@Component({
  selector: 'hk-table',
  imports: [
    NgTemplateOutlet,
    LucideDynamicIcon,
    TranslocoPipe,
    HkCheckbox,
    HkEmptyState,
    HkPagination,
    HkSkeleton,
  ],
  template: `
    <div [attr.aria-busy]="cargando()">
      @if (!cargando() && filas().length === 0) {
        <hk-empty-state
          [icono]="vacioIcono()"
          [titulo]="vacioTitulo() ?? ('ui.tabla.vacio' | transloco)"
          [texto]="vacioTexto()"
        >
          <ng-content select="[hkTablaVacio]" />
        </hk-empty-state>
      } @else {
        <!-- Escritorio y tablet: tabla -->
        <div class="overflow-auto max-md:hidden" [style.max-height]="altoMaximo() ?? null">
          <table class="w-full border-separate border-spacing-0 text-sm">
            @if (etiqueta()) {
              <caption class="sr-only">
                {{
                  etiqueta()
                }}
              </caption>
            }
            <thead>
              <tr>
                @if (seleccionable()) {
                  <th
                    scope="col"
                    class="sticky top-0 z-1 w-12 border-b border-border bg-surface-2 px-4 py-3"
                  >
                    <hk-checkbox
                      [valor]="todasSeleccionadas()"
                      [indeterminado]="algunasSeleccionadas()"
                      [etiquetaAccesible]="'ui.tabla.seleccionar_todo' | transloco"
                      [deshabilitado]="cargando()"
                      (valorChange)="seleccionarTodas($event)"
                    />
                  </th>
                }
                @for (col of columnas(); track col.clave) {
                  <th
                    scope="col"
                    class="sticky top-0 z-1 border-b border-border bg-surface-2 px-4 py-3 text-xs font-semibold whitespace-nowrap text-muted"
                    [class]="claseAlineacion(col)"
                    [attr.aria-sort]="ariaSort(col)"
                  >
                    @if (col.ordenable) {
                      <button
                        type="button"
                        class="-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hk-foco transition-colors hover:text-fg"
                        [class.text-fg]="orden()?.columna === col.clave"
                        (click)="ordenar(col.clave)"
                      >
                        {{ col.etiqueta }}
                        <svg [lucideIcon]="iconoOrden(col)" class="size-3.5" aria-hidden="true" />
                      </button>
                    } @else {
                      {{ col.etiqueta }}
                    }
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @if (cargando()) {
                @for (_ of filasSkeleton; track $index) {
                  <tr>
                    @if (seleccionable()) {
                      <td class="border-b border-border px-4 py-3.5">
                        <hk-skeleton ancho="1.25rem" />
                      </td>
                    }
                    @for (col of columnas(); track col.clave) {
                      <td class="border-b border-border px-4 py-3.5">
                        <hk-skeleton [ancho]="$first ? '70%' : '50%'" />
                      </td>
                    }
                  </tr>
                }
              } @else {
                @for (fila of filas(); track claveDe(fila)) {
                  <tr
                    class="group transition-colors"
                    [class]="
                      filasClicables()
                        ? 'cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none'
                        : 'hover:bg-surface-2/60'
                    "
                    [class.bg-primary-soft]="estaSeleccionada(fila)"
                    [attr.tabindex]="filasClicables() ? 0 : null"
                    [attr.aria-selected]="seleccionable() ? estaSeleccionada(fila) : null"
                    (click)="filasClicables() && filaClic.emit(fila)"
                    (keydown.enter)="filasClicables() && filaClic.emit(fila)"
                  >
                    @if (seleccionable()) {
                      <td class="border-b border-border px-4 py-3">
                        <hk-checkbox
                          [valor]="estaSeleccionada(fila)"
                          [etiquetaAccesible]="'ui.tabla.seleccionar_fila' | transloco"
                          (valorChange)="alternarSeleccion(fila)"
                          (click)="$event.stopPropagation()"
                        />
                      </td>
                    }
                    @for (col of columnas(); track col.clave) {
                      <td
                        class="border-b border-border px-4 py-3 text-fg"
                        [class]="claseAlineacion(col)"
                      >
                        <ng-container
                          [ngTemplateOutlet]="plantillaDe(col.clave) ?? textoPlano"
                          [ngTemplateOutletContext]="contexto(fila, col)"
                        />
                      </td>
                    }
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <!-- Móvil: tarjetas -->
        <ul class="flex flex-col gap-3 md:hidden" [attr.aria-label]="etiqueta() ?? null">
          @if (cargando()) {
            @for (_ of filasSkeleton; track $index) {
              <li class="rounded-xl border border-border p-4"><hk-skeleton [lineas]="3" /></li>
            }
          } @else {
            @for (fila of filas(); track claveDe(fila)) {
              <li
                class="rounded-xl border border-border bg-surface p-4 transition-colors"
                [class]="filasClicables() ? 'cursor-pointer hk-foco active:bg-surface-2' : ''"
                [class.border-primary]="estaSeleccionada(fila)"
                [attr.tabindex]="filasClicables() ? 0 : null"
                (click)="filasClicables() && filaClic.emit(fila)"
                (keydown.enter)="filasClicables() && filaClic.emit(fila)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 font-semibold text-fg">
                    @if (columnaPrincipal(); as principal) {
                      <ng-container
                        [ngTemplateOutlet]="plantillaDe(principal.clave) ?? textoPlano"
                        [ngTemplateOutletContext]="contexto(fila, principal)"
                      />
                    }
                  </div>
                  @if (seleccionable()) {
                    <hk-checkbox
                      [valor]="estaSeleccionada(fila)"
                      [etiquetaAccesible]="'ui.tabla.seleccionar_fila' | transloco"
                      (valorChange)="alternarSeleccion(fila)"
                      (click)="$event.stopPropagation()"
                    />
                  }
                </div>
                <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  @for (col of columnasTarjeta(); track col.clave) {
                    <dt class="text-xs text-muted">{{ col.etiqueta }}</dt>
                    <dd class="min-w-0 text-right text-fg" [class.tabular]="col.numerica">
                      <ng-container
                        [ngTemplateOutlet]="plantillaDe(col.clave) ?? textoPlano"
                        [ngTemplateOutletContext]="contexto(fila, col)"
                      />
                    </dd>
                  }
                </dl>
              </li>
            }
          }
        </ul>
      }

      @if (total() !== undefined && total()! > 0) {
        <hk-pagination
          class="mt-4 border-t border-border pt-4"
          [pagina]="pagina()"
          [tamano]="tamano()"
          [total]="total()!"
          (paginaCambio)="paginaCambio.emit($event)"
        />
      }
    </div>

    <ng-template #textoPlano let-valor="valor">{{ valor ?? '—' }}</ng-template>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkTable<T extends object> {
  readonly columnas = input.required<readonly ColumnaTabla[]>();
  readonly filas = input.required<readonly T[]>();
  /** Propiedad que identifica cada fila (para `track` y la selección). */
  readonly claveFila = input<keyof T & string>('id' as keyof T & string);
  readonly cargando = input(false, { transform: booleanAttribute });
  readonly etiqueta = input<string>();
  readonly orden = model<OrdenTabla | null>(null);
  readonly seleccionable = input(false, { transform: booleanAttribute });
  readonly seleccion = model<readonly unknown[]>([]);
  readonly filasClicables = input(false, { transform: booleanAttribute });
  readonly altoMaximo = input<string>();
  readonly pagina = input(0);
  readonly tamano = input(20);
  /** Total de registros; si se define se muestra la paginación. */
  readonly total = input<number>();
  readonly vacioTitulo = input<string>();
  readonly vacioTexto = input<string>();
  readonly vacioIcono = input('inbox');

  readonly filaClic = output<T>();
  readonly paginaCambio = output<number>();

  private readonly plantillas = contentChildren(HkCelda);
  protected readonly filasSkeleton = Array.from({ length: FILAS_SKELETON });

  protected readonly columnaPrincipal = computed(
    () => this.columnas().find((c) => c.principal) ?? this.columnas()[0],
  );
  protected readonly columnasTarjeta = computed(() =>
    this.columnas().filter((c) => c !== this.columnaPrincipal() && !c.ocultarEnMovil),
  );
  private readonly clavesSeleccionadas = computed(() => new Set(this.seleccion()));
  protected readonly todasSeleccionadas = computed(
    () =>
      this.filas().length > 0 &&
      this.filas().every((f) => this.clavesSeleccionadas().has(this.claveDe(f))),
  );
  protected readonly algunasSeleccionadas = computed(
    () =>
      !this.todasSeleccionadas() &&
      this.filas().some((f) => this.clavesSeleccionadas().has(this.claveDe(f))),
  );

  protected claveDe(fila: T): unknown {
    return fila[this.claveFila()];
  }

  protected plantillaDe(clave: string): TemplateRef<ContextoCelda<unknown>> | null {
    return this.plantillas().find((p) => p.hkCelda() === clave)?.plantilla ?? null;
  }

  protected contexto(fila: T, col: ColumnaTabla): ContextoCelda<T> {
    return { $implicit: fila, valor: (fila as Record<string, unknown>)[col.clave] };
  }

  protected claseAlineacion(col: ColumnaTabla): string {
    const alineacion = col.alinear ?? (col.numerica ? 'fin' : 'inicio');
    return (
      { inicio: 'text-left', centro: 'text-center', fin: 'text-right' }[alineacion] +
      (col.numerica ? ' tabular' : '')
    );
  }

  protected ariaSort(col: ColumnaTabla): string | null {
    if (!col.ordenable) return null;
    const orden = this.orden();
    if (orden?.columna !== col.clave) return 'none';
    return orden.direccion === 'asc' ? 'ascending' : 'descending';
  }

  protected iconoOrden(col: ColumnaTabla): string {
    const orden = this.orden();
    if (orden?.columna !== col.clave) return 'arrow-up-down';
    return orden.direccion === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  protected ordenar(columna: string): void {
    this.orden.set(siguienteOrden(this.orden(), columna));
  }

  protected estaSeleccionada(fila: T): boolean {
    return this.clavesSeleccionadas().has(this.claveDe(fila));
  }

  protected alternarSeleccion(fila: T): void {
    const clave = this.claveDe(fila);
    this.seleccion.set(
      this.estaSeleccionada(fila)
        ? this.seleccion().filter((c) => c !== clave)
        : [...this.seleccion(), clave],
    );
  }

  protected seleccionarTodas(marcar: boolean): void {
    const enPagina = this.filas().map((f) => this.claveDe(f));
    const resto = this.seleccion().filter((c) => !enPagina.includes(c));
    this.seleccion.set(marcar ? [...resto, ...enPagina] : resto);
  }
}
