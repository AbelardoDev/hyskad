import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Fondos y textos verificados con `npm run contrast:check` (sección Avatares). */
const COLORES = [
  'bg-brand-600 text-brand-50',
  'bg-brand-800 text-brand-50',
  'bg-brand-950 text-brand-50',
  'bg-accent text-brand-950',
  'bg-brand-200 text-brand-950',
  'bg-brand-400 text-brand-950',
] as const;

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primera = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primera + ultima).toLocaleUpperCase();
}

/** Mismo nombre → mismo color, siempre. */
export function indiceColor(nombre: string): number {
  let hash = 0;
  for (const caracter of nombre) hash = (hash * 31 + caracter.charCodeAt(0)) >>> 0;
  return hash % COLORES.length;
}

/** Avatar con iniciales y color derivado del nombre. */
@Component({
  selector: 'hk-avatar',
  template: `{{ texto() }}`,
  host: {
    role: 'img',
    '[attr.aria-label]': 'nombre()',
    '[class]': 'clases()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkAvatar {
  readonly nombre = input.required<string>();
  readonly tamano = input<'sm' | 'md' | 'lg'>('md');

  protected readonly texto = computed(() => iniciales(this.nombre()));
  protected readonly clases = computed(() => {
    const tamano = { sm: 'size-7 text-[0.6875rem]', md: 'size-9 text-xs', lg: 'size-12 text-sm' }[
      this.tamano()
    ];
    return `inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-wide ${tamano} ${COLORES[indiceColor(this.nombre())]}`;
  });
}
