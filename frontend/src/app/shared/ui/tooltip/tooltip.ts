import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';

import { nuevoId } from '../forms/campo';

@Component({
  selector: 'hk-tooltip',
  template: `{{ texto() }}`,
  host: {
    role: 'tooltip',
    '[id]': 'id()',
    class:
      'pointer-events-none block max-w-64 rounded-lg bg-brand-950 px-2.5 py-1.5 text-xs font-medium text-brand-50 shadow-overlay animate-entrada dark:bg-surface-2 dark:text-fg dark:ring-1 dark:ring-border',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkTooltip {
  readonly texto = signal('');
  readonly id = signal('');
}

type Posicion = 'arriba' | 'abajo' | 'derecha' | 'izquierda';

/**
 * Tooltip accesible: aparece con hover y con foco, se oculta con `Esc`, y se enlaza al
 * elemento con `aria-describedby`. `<button hkTooltip="Colapsar menú" hkTooltipPosicion="derecha">`.
 */
@Directive({
  selector: '[hkTooltip]',
  host: {
    '(mouseenter)': 'mostrar()',
    '(mouseleave)': 'ocultar()',
    '(focusin)': 'mostrar()',
    '(focusout)': 'ocultar()',
    '(keydown.escape)': 'ocultar()',
    '[attr.aria-describedby]': 'visible() ? id : null',
  },
})
export class HkTooltipDirective {
  private readonly overlay = inject(Overlay);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlayRef: OverlayRef | null = null;

  readonly hkTooltip = input.required<string>();
  readonly hkTooltipPosicion = input<Posicion>('arriba');
  /** Para mostrarlo solo en ciertos casos (p. ej. sidebar colapsado). */
  readonly hkTooltipDeshabilitado = input(false);

  protected readonly id = nuevoId('hk-tooltip');
  protected readonly visible = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.overlayRef?.dispose());
  }

  mostrar(): void {
    if (this.hkTooltipDeshabilitado() || !this.hkTooltip() || this.visible()) return;
    this.overlayRef ??= this.overlay.create({
      positionStrategy: this.estrategia(),
      scrollStrategy: this.overlay.scrollStrategies.close(),
    });
    const ref = this.overlayRef.attach(new ComponentPortal(HkTooltip));
    ref.instance.texto.set(this.hkTooltip());
    ref.instance.id.set(this.id);
    this.visible.set(true);
  }

  ocultar(): void {
    this.overlayRef?.detach();
    this.visible.set(false);
  }

  private estrategia() {
    const base = this.overlay
      .position()
      .flexibleConnectedTo(this.elemento)
      .withFlexibleDimensions(false);
    const separacion = 8;
    switch (this.hkTooltipPosicion()) {
      case 'derecha':
        return base.withPositions([
          {
            originX: 'end',
            originY: 'center',
            overlayX: 'start',
            overlayY: 'center',
            offsetX: separacion,
          },
          {
            originX: 'start',
            originY: 'center',
            overlayX: 'end',
            overlayY: 'center',
            offsetX: -separacion,
          },
        ]);
      case 'izquierda':
        return base.withPositions([
          {
            originX: 'start',
            originY: 'center',
            overlayX: 'end',
            overlayY: 'center',
            offsetX: -separacion,
          },
          {
            originX: 'end',
            originY: 'center',
            overlayX: 'start',
            overlayY: 'center',
            offsetX: separacion,
          },
        ]);
      case 'abajo':
        return base.withPositions([
          {
            originX: 'center',
            originY: 'bottom',
            overlayX: 'center',
            overlayY: 'top',
            offsetY: separacion,
          },
          {
            originX: 'center',
            originY: 'top',
            overlayX: 'center',
            overlayY: 'bottom',
            offsetY: -separacion,
          },
        ]);
      default:
        return base.withPositions([
          {
            originX: 'center',
            originY: 'top',
            overlayX: 'center',
            overlayY: 'bottom',
            offsetY: -separacion,
          },
          {
            originX: 'center',
            originY: 'bottom',
            overlayX: 'center',
            overlayY: 'top',
            offsetY: separacion,
          },
        ]);
    }
  }
}
