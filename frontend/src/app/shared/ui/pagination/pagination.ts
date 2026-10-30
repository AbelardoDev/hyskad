import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

/** Páginas a mostrar (base 0) con `null` donde va "…". Siempre primera, última y vecinas de la actual. */
export function paginasVisibles(actual: number, totalPaginas: number): (number | null)[] {
  if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i);
  const vecinas = new Set([0, totalPaginas - 1, actual - 1, actual, actual + 1]);
  if (actual <= 3) [1, 2, 3, 4].forEach((p) => vecinas.add(p));
  if (actual >= totalPaginas - 4) [1, 2, 3, 4].forEach((p) => vecinas.add(totalPaginas - 1 - p));
  const ordenadas = [...vecinas].filter((p) => p >= 0 && p < totalPaginas).sort((a, b) => a - b);
  return ordenadas.flatMap((p, i) => (i > 0 && p - ordenadas[i - 1] > 1 ? [null, p] : [p]));
}

const CLASE_BOTON =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium tabular transition-colors hk-foco disabled:cursor-not-allowed disabled:opacity-40 max-md:h-11 max-md:min-w-11';

/** Paginación compatible con `PageResponse` del backend (`page` base 0, `size`, `totalElements`). */
@Component({
  selector: 'hk-pagination',
  imports: [LucideDynamicIcon, TranslocoPipe],
  template: `
    <p class="text-xs text-muted tabular" aria-live="polite">
      @if (total() > 0) {
        {{ 'ui.paginacion.rango' | transloco: { desde: desde(), hasta: hasta(), total: total() } }}
      }
    </p>
    @if (totalPaginas() > 1) {
      <nav [attr.aria-label]="'ui.paginacion.etiqueta' | transloco" class="flex items-center gap-1">
        <button
          type="button"
          [class]="
            claseBoton + ' text-muted hover:not-disabled:bg-surface-2 hover:not-disabled:text-fg'
          "
          [disabled]="pagina() === 0"
          [attr.aria-label]="'ui.paginacion.anterior' | transloco"
          (click)="ir(pagina() - 1)"
        >
          <svg lucideIcon="chevron-left" class="size-4" aria-hidden="true" />
        </button>
        @for (p of paginas(); track $index) {
          @if (p === null) {
            <span class="px-1 text-muted max-sm:hidden" aria-hidden="true">…</span>
          } @else {
            <button
              type="button"
              [class]="
                claseBoton +
                (p === pagina()
                  ? ' bg-primary text-primary-fg'
                  : ' text-fg hover:bg-surface-2 max-sm:hidden')
              "
              [attr.aria-current]="p === pagina() ? 'page' : null"
              [attr.aria-label]="'ui.paginacion.pagina' | transloco: { n: p + 1 }"
              (click)="ir(p)"
            >
              {{ p + 1 }}
            </button>
          }
        }
        <button
          type="button"
          [class]="
            claseBoton + ' text-muted hover:not-disabled:bg-surface-2 hover:not-disabled:text-fg'
          "
          [disabled]="pagina() >= totalPaginas() - 1"
          [attr.aria-label]="'ui.paginacion.siguiente' | transloco"
          (click)="ir(pagina() + 1)"
        >
          <svg lucideIcon="chevron-right" class="size-4" aria-hidden="true" />
        </button>
      </nav>
    }
  `,
  host: { class: 'flex flex-wrap items-center justify-between gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkPagination {
  /** Página actual, base 0 (como Spring). */
  readonly pagina = input.required<number>();
  readonly tamano = input.required<number>();
  readonly total = input.required<number>();
  readonly paginaCambio = output<number>();

  protected readonly claseBoton = CLASE_BOTON;
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.tamano())),
  );
  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : this.pagina() * this.tamano() + 1,
  );
  protected readonly hasta = computed(() =>
    Math.min(this.total(), (this.pagina() + 1) * this.tamano()),
  );
  protected readonly paginas = computed(() => paginasVisibles(this.pagina(), this.totalPaginas()));

  protected ir(pagina: number): void {
    if (pagina >= 0 && pagina < this.totalPaginas() && pagina !== this.pagina())
      this.paginaCambio.emit(pagina);
  }
}
