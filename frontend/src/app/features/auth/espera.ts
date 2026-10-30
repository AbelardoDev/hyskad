import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, inject, Signal, signal } from '@angular/core';

const ESPERA_POR_DEFECTO_S = 60;

/** Segundos que pide esperar un 429 (cabecera `Retry-After` del backend). */
export function segundosDeEspera(error: HttpErrorResponse): number {
  const segundos = Number(error.headers.get('Retry-After'));
  return Number.isFinite(segundos) && segundos > 0 ? Math.ceil(segundos) : ESPERA_POR_DEFECTO_S;
}

export interface CuentaRegresiva {
  /** Segundos que faltan; 0 cuando no hay espera. */
  readonly segundos: Signal<number>;
  iniciar(segundos: number, alTerminar?: () => void): void;
}

/** Cuenta regresiva de un segundo por paso, detenida al destruir el componente. */
export function cuentaRegresiva(): CuentaRegresiva {
  const segundos = signal(0);
  let intervalo: ReturnType<typeof setInterval> | undefined;
  inject(DestroyRef).onDestroy(() => clearInterval(intervalo));
  return {
    segundos: segundos.asReadonly(),
    iniciar(total, alTerminar) {
      clearInterval(intervalo);
      segundos.set(total);
      intervalo = setInterval(() => {
        segundos.update((s) => s - 1);
        if (segundos() > 0) return;
        clearInterval(intervalo);
        alTerminar?.();
      }, 1000);
    },
  };
}
