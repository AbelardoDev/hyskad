import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

export type VarianteBoton = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type TamanoBoton = 'sm' | 'md' | 'lg';

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium ' +
  'transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-hk hk-foco ' +
  'disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55';

const VARIANTES: Record<VarianteBoton, string> = {
  primary:
    'rounded-xl bg-primary text-primary-fg shadow-sm hover:not-disabled:bg-primary-hover active:not-disabled:translate-y-px',
  secondary:
    'rounded-xl border border-border bg-surface text-fg shadow-sm hover:not-disabled:border-border-strong hover:not-disabled:bg-surface-2 active:not-disabled:translate-y-px',
  ghost: 'rounded-xl text-fg hover:not-disabled:bg-surface-2',
  danger:
    'rounded-xl bg-danger text-primary-fg shadow-sm hover:not-disabled:brightness-95 active:not-disabled:translate-y-px',
  link: 'rounded-md text-primary underline-offset-4 hover:underline',
};

const TAMANOS: Record<TamanoBoton, string> = {
  sm: 'h-8 px-3 text-xs [&_svg]:size-3.5',
  md: 'h-10 px-4 text-sm [&_svg]:size-4 max-md:min-h-11',
  lg: 'h-12 px-6 text-base [&_svg]:size-5',
};

/**
 * Botón del sistema de diseño sobre el elemento nativo (`<button hk-button>` o `<a hk-button>`),
 * así conserva `type`, `routerLink` y la semántica del navegador.
 */
@Component({
  selector: 'button[hk-button], a[hk-button]',
  imports: [LucideDynamicIcon],
  template: `
    @if (cargando()) {
      <svg lucideIcon="loader-circle" class="animate-spin" aria-hidden="true" />
    } @else if (icono()) {
      <svg [lucideIcon]="icono()!" aria-hidden="true" />
    }
    <ng-content />
    @if (iconoFinal() && !cargando()) {
      <svg [lucideIcon]="iconoFinal()!" aria-hidden="true" />
    }
  `,
  host: {
    '[class]': 'clases()',
    '[attr.disabled]': 'esBoton && (deshabilitado() || cargando()) ? "" : null',
    '[attr.aria-disabled]': '!esBoton && deshabilitado() ? "true" : null',
    '[attr.aria-busy]': 'cargando() ? "true" : null',
    '[attr.type]': 'esBoton ? tipo() : null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkButton {
  readonly variante = input<VarianteBoton>('primary');
  readonly tamano = input<TamanoBoton>('md');
  readonly tipo = input<'button' | 'submit' | 'reset'>('button');
  readonly icono = input<string>();
  readonly iconoFinal = input<string>();
  readonly cargando = input(false, { transform: booleanAttribute });
  readonly deshabilitado = input(false, { transform: booleanAttribute });
  readonly anchoCompleto = input(false, { transform: booleanAttribute });

  protected readonly esBoton =
    (inject(ElementRef).nativeElement as HTMLElement).tagName === 'BUTTON';

  protected readonly clases = computed(() =>
    [
      BASE,
      VARIANTES[this.variante()],
      this.variante() === 'link' ? 'text-sm' : TAMANOS[this.tamano()],
      this.anchoCompleto() ? 'w-full' : '',
    ].join(' '),
  );
}
