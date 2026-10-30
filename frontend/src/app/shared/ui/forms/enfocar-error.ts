import { afterNextRender, Injector } from '@angular/core';

/**
 * Tras marcar un formulario como tocado al enviarlo, lleva el foco al primer campo con error
 * (DESIGN-SYSTEM §9). Espera al siguiente render para que los `aria-invalid` estén aplicados.
 */
export function enfocarPrimerError(contenedor: HTMLElement, injector: Injector): void {
  afterNextRender(() => contenedor.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), {
    injector,
  });
}
