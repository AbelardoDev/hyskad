import { DestroyRef, effect, inject, Signal, signal, untracked } from '@angular/core';

/** Duración de la animación de los contadores del dashboard. */
export const DURACION_CONTADOR_MS = 600;

/**
 * Señal que va de su valor actual a `fuente()` con una curva suave cada vez que la fuente cambia
 * (contadores animados del dashboard). Sin `requestAnimationFrame` o con movimiento reducido, salta
 * directo al valor. `null` se mantiene en `null`.
 */
export function contadorAnimado(fuente: Signal<number | null>): Signal<number | null> {
  const valor = signal<number | null>(null);
  const ventana = globalThis as typeof globalThis & {
    requestAnimationFrame?: (cb: (t: number) => void) => number;
    cancelAnimationFrame?: (id: number) => void;
    matchMedia?: (q: string) => { matches: boolean };
  };
  let cuadro: number | undefined;
  effect(() => {
    const destino = fuente();
    if (cuadro !== undefined) ventana.cancelAnimationFrame?.(cuadro);
    const reducido = ventana.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (destino === null || !ventana.requestAnimationFrame || reducido) {
      valor.set(destino);
      return;
    }
    // Sin rastrear: si el efecto dependiera de `valor`, cada cuadro reiniciaría la animación
    const inicio = untracked(valor) ?? 0;
    let comienzo: number | undefined;
    const paso = (t: number) => {
      comienzo ??= t;
      const avance = Math.min(1, (t - comienzo) / DURACION_CONTADOR_MS);
      const suave = 1 - (1 - avance) ** 3;
      valor.set(avance >= 1 ? destino : inicio + (destino - inicio) * suave);
      if (avance < 1) cuadro = ventana.requestAnimationFrame!(paso);
    };
    cuadro = ventana.requestAnimationFrame(paso);
  });
  inject(DestroyRef).onDestroy(() => {
    if (cuadro !== undefined) ventana.cancelAnimationFrame?.(cuadro);
  });
  return valor.asReadonly();
}
