import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
} from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

import { nuevoId } from '../forms/campo';

export interface Pestana {
  id: string;
  /** Texto ya traducido. */
  etiqueta: string;
  icono?: string;
  /** Número opcional junto a la etiqueta (p. ej. ítems de la orden). */
  contador?: number;
  deshabilitada?: boolean;
}

/**
 * Pestañas (patrón ARIA "tabs" con activación automática: flechas, Inicio y Fin).
 * El contenido del panel activo se proyecta; el consumidor decide qué mostrar según `activa`.
 */
@Component({
  selector: 'hk-tabs',
  imports: [LucideDynamicIcon],
  template: `
    <div
      role="tablist"
      class="-mx-1 flex [scrollbar-width:none] gap-1 overflow-x-auto border-b border-border px-1"
      [attr.aria-label]="etiqueta() ?? null"
    >
      @for (pestana of pestanas(); track pestana.id) {
        <button
          type="button"
          role="tab"
          class="relative -mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap hk-foco transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
          [class]="
            pestana.id === activa()
              ? 'border-primary text-fg'
              : 'border-transparent text-muted hover:text-fg'
          "
          [id]="idPestana(pestana.id)"
          [attr.aria-selected]="pestana.id === activa()"
          [attr.aria-controls]="idPanel"
          [attr.tabindex]="pestana.id === activa() ? 0 : -1"
          [disabled]="pestana.deshabilitada"
          (click)="activa.set(pestana.id)"
          (keydown)="alTeclear($event)"
        >
          @if (pestana.icono) {
            <svg [lucideIcon]="pestana.icono" class="size-4" aria-hidden="true" />
          }
          {{ pestana.etiqueta }}
          @if (pestana.contador !== undefined) {
            <span class="rounded-full bg-surface-2 px-1.5 text-xs text-muted tabular">{{
              pestana.contador
            }}</span>
          }
        </button>
      }
    </div>
    <div
      role="tabpanel"
      class="pt-5"
      [id]="idPanel"
      [attr.aria-labelledby]="idPestana(activa())"
      tabindex="0"
    >
      <ng-content />
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkTabs {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly pestanas = input.required<readonly Pestana[]>();
  readonly activa = model.required<string>();
  readonly etiqueta = input<string>();

  private readonly base = nuevoId('hk-tabs');
  protected readonly idPanel = `${this.base}-panel`;
  private readonly habilitadas = computed(() => this.pestanas().filter((p) => !p.deshabilitada));

  protected idPestana(id: string): string {
    return `${this.base}-${id}`;
  }

  protected alTeclear(evento: KeyboardEvent): void {
    const lista = this.habilitadas();
    const actual = lista.findIndex((p) => p.id === this.activa());
    let siguiente: number;
    switch (evento.key) {
      case 'ArrowRight':
        siguiente = (actual + 1) % lista.length;
        break;
      case 'ArrowLeft':
        siguiente = (actual - 1 + lista.length) % lista.length;
        break;
      case 'Home':
        siguiente = 0;
        break;
      case 'End':
        siguiente = lista.length - 1;
        break;
      default:
        return;
    }
    evento.preventDefault();
    const id = lista[siguiente].id;
    this.activa.set(id);
    this.elemento.nativeElement.querySelector<HTMLElement>(`#${this.idPestana(id)}`)?.focus();
  }
}
