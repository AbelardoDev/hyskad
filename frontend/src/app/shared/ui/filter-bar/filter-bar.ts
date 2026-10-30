import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { HkInput } from '../forms/input';

export interface FiltroActivo {
  clave: string;
  /** Texto ya traducido, p. ej. "Estado: En reparación". */
  etiqueta: string;
}

const ESPERA_BUSQUEDA_MS = 300;

/**
 * Barra de filtros: búsqueda (con espera de 300 ms antes de emitir `busquedaCambio`), controles
 * de filtro proyectados y chips de los filtros activos.
 */
@Component({
  selector: 'hk-filter-bar',
  imports: [HkInput, LucideDynamicIcon, TranslocoPipe],
  template: `
    <div class="flex flex-col gap-3 md:flex-row md:items-center">
      <hk-input
        class="md:max-w-sm md:flex-1"
        tipo="search"
        icono="search"
        [placeholder]="placeholder() ?? ('ui.filtros.buscar' | transloco)"
        [valor]="busqueda()"
        (valorChange)="alEscribir($event)"
        [etiquetaAccesible]="placeholder() ?? ('ui.filtros.buscar' | transloco)"
      />
      <div class="flex flex-wrap items-center gap-2 empty:hidden">
        <ng-content />
      </div>
    </div>
    @if (filtros().length > 0) {
      <ul
        class="mt-3 flex flex-wrap items-center gap-2"
        [attr.aria-label]="'ui.filtros.activos' | transloco"
      >
        @for (filtro of filtros(); track filtro.clave) {
          <li
            class="inline-flex h-7 items-center gap-1 rounded-full bg-primary-soft pr-1 pl-3 text-xs font-medium text-primary-ink"
          >
            {{ filtro.etiqueta }}
            <button
              type="button"
              class="inline-flex size-5 items-center justify-center rounded-full hk-foco transition-colors hover:bg-primary/15"
              [attr.aria-label]="'ui.filtros.quitar' | transloco: { filtro: filtro.etiqueta }"
              (click)="quitar.emit(filtro.clave)"
            >
              <svg lucideIcon="x" class="size-3" aria-hidden="true" />
            </button>
          </li>
        }
        <li>
          <button
            type="button"
            class="rounded-md px-1 text-xs font-medium text-primary hk-foco hover:underline"
            (click)="limpiar.emit()"
          >
            {{ 'ui.filtros.limpiar' | transloco }}
          </button>
        </li>
      </ul>
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkFilterBar {
  readonly busqueda = model<string | null>(null);
  readonly placeholder = input<string>();
  readonly filtros = input<readonly FiltroActivo[]>([]);
  /** Búsqueda ya estabilizada (tras 300 ms sin escribir). */
  readonly busquedaCambio = output<string>();
  readonly quitar = output<string>();
  readonly limpiar = output<void>();

  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
  }

  protected alEscribir(texto: string | null): void {
    this.busqueda.set(texto);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(
      () => this.busquedaCambio.emit((texto ?? '').trim()),
      ESPERA_BUSQUEDA_MS,
    );
  }
}
