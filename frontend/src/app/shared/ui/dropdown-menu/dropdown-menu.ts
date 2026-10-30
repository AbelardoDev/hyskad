import {
  CdkMenu,
  CdkMenuGroup,
  CdkMenuItem,
  CdkMenuItemRadio,
  CdkMenuTrigger,
} from '@angular/cdk/menu';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

export interface ItemMenu {
  id: string;
  /** Texto ya traducido. */
  etiqueta: string;
  icono?: string;
  peligro?: boolean;
  deshabilitado?: boolean;
  /** Dibuja una línea divisoria antes del ítem. */
  separadorAntes?: boolean;
}

const POSICIONES: Record<'inicio' | 'fin', ConnectedPosition[]> = {
  inicio: [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  ],
  fin: [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ],
};

const CLASE_ITEM =
  'flex w-full min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-sm outline-none transition-colors ' +
  'focus:bg-surface-2 hover:bg-surface-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

/**
 * Menú desplegable (CDK Menu: roles `menu`/`menuitem`, flechas, typeahead, `Esc`).
 * El contenido proyectado es el del botón disparador. Con `seleccionado` los ítems son `menuitemradio`.
 */
@Component({
  selector: 'hk-dropdown-menu',
  imports: [
    CdkMenuTrigger,
    CdkMenu,
    CdkMenuItem,
    CdkMenuItemRadio,
    CdkMenuGroup,
    LucideDynamicIcon,
  ],
  template: `
    <button
      type="button"
      [cdkMenuTriggerFor]="menu"
      [cdkMenuPosition]="posiciones()"
      [attr.aria-label]="etiqueta()"
      [class]="claseDisparador()"
    >
      <ng-content />
    </button>

    <ng-template #menu>
      <div cdkMenu class="min-w-52 hk-overlay p-1.5" [attr.aria-label]="etiqueta()">
        <ng-content select="[hkMenuEncabezado]" />
        @if (esRadio()) {
          <div cdkMenuGroup>
            @for (item of items(); track item.id) {
              @if (item.separadorAntes) {
                <div class="my-1.5 h-px bg-border" role="separator"></div>
              }
              <button
                cdkMenuItemRadio
                [cdkMenuItemChecked]="item.id === seleccionado()"
                [cdkMenuItemDisabled]="!!item.deshabilitado"
                [class]="claseItem"
                [class.text-primary-ink]="item.id === seleccionado()"
                [class.font-medium]="item.id === seleccionado()"
                (cdkMenuItemTriggered)="seleccion.emit(item.id)"
              >
                @if (item.icono) {
                  <svg [lucideIcon]="item.icono" class="size-4 shrink-0" aria-hidden="true" />
                }
                <span class="flex-1">{{ item.etiqueta }}</span>
                @if (item.id === seleccionado()) {
                  <svg lucideIcon="check" class="size-4 text-primary" aria-hidden="true" />
                }
              </button>
            }
          </div>
        } @else {
          @for (item of items(); track item.id) {
            @if (item.separadorAntes) {
              <div class="my-1.5 h-px bg-border" role="separator"></div>
            }
            <button
              cdkMenuItem
              [cdkMenuItemDisabled]="!!item.deshabilitado"
              [class]="claseItem"
              [class.text-danger-ink]="item.peligro"
              [class.text-fg]="!item.peligro"
              (cdkMenuItemTriggered)="seleccion.emit(item.id)"
            >
              @if (item.icono) {
                <svg
                  [lucideIcon]="item.icono"
                  class="size-4 shrink-0"
                  [class.text-muted]="!item.peligro"
                  aria-hidden="true"
                />
              }
              <span class="flex-1">{{ item.etiqueta }}</span>
            </button>
          }
        }
      </div>
    </ng-template>
  `,
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkDropdownMenu {
  readonly items = input.required<readonly ItemMenu[]>();
  /** Nombre accesible del botón y del menú (texto ya traducido). */
  readonly etiqueta = input.required<string>();
  readonly seleccionado = input<string>();
  readonly alineacion = input<'inicio' | 'fin'>('fin');
  readonly claseDisparador = input(
    'inline-flex h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg aria-expanded:bg-surface-2 aria-expanded:text-fg hk-foco max-md:min-h-11 max-md:min-w-11 max-md:justify-center',
  );
  readonly seleccion = output<string>();

  protected readonly claseItem = CLASE_ITEM;
  protected readonly esRadio = computed(() => this.seleccionado() !== undefined);
  protected readonly posiciones = computed(() => POSICIONES[this.alineacion()]);
}
