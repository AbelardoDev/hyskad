import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Marcador de carga con brillo sutil. Decorativo: el contenedor anuncia `aria-busy`. */
@Component({
  selector: 'hk-skeleton',
  template: `
    @for (linea of lineasArray(); track $index; let ultima = $last) {
      <span
        class="block animate-shimmer bg-[linear-gradient(90deg,var(--surface-2)_25%,color-mix(in_srgb,var(--border)_70%,var(--surface-2))_50%,var(--surface-2)_75%)] bg-size-[200%_100%]"
        [class]="claseForma()"
        [style.width]="variante() === 'texto' && ultima && lineas() > 1 ? '60%' : ancho()"
        [style.height]="alto()"
      ></span>
    }
  `,
  host: { class: 'flex flex-col gap-2', 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkSkeleton {
  readonly variante = input<'texto' | 'circulo' | 'rectangulo'>('texto');
  readonly lineas = input(1);
  readonly ancho = input<string>('100%');
  readonly alto = input<string>();

  protected readonly lineasArray = computed(() =>
    Array.from({ length: Math.max(1, this.lineas()) }),
  );
  protected readonly claseForma = computed(() => {
    switch (this.variante()) {
      case 'circulo':
        return 'size-10 rounded-full';
      case 'rectangulo':
        return 'h-24 rounded-xl';
      default:
        return 'h-3.5 rounded-md';
    }
  });
}
