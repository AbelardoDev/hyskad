import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

export type TipoToast = 'exito' | 'error' | 'aviso' | 'info';

export interface Toast {
  id: number;
  tipo: TipoToast;
  /** Textos ya traducidos. */
  titulo: string;
  mensaje?: string;
}

export const DURACION_TOAST_MS = 4000;
const MAXIMO_VISIBLES = 4;

const ESTILO: Record<TipoToast, { icono: string; clase: string }> = {
  exito: { icono: 'circle-check', clase: 'text-success' },
  error: { icono: 'circle-alert', clase: 'text-danger' },
  aviso: { icono: 'triangle-alert', clase: 'text-warning' },
  info: { icono: 'info', clase: 'text-info' },
};

/** Notificaciones breves. Se cierran solas a los 4 s (los errores también, pero se pueden cerrar antes). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private siguienteId = 0;
  private readonly temporizadores = new Map<number, ReturnType<typeof setTimeout>>();
  readonly toasts = signal<readonly Toast[]>([]);

  exito(titulo: string, mensaje?: string): number {
    return this.mostrar({ tipo: 'exito', titulo, mensaje });
  }

  error(titulo: string, mensaje?: string): number {
    return this.mostrar({ tipo: 'error', titulo, mensaje });
  }

  aviso(titulo: string, mensaje?: string): number {
    return this.mostrar({ tipo: 'aviso', titulo, mensaje });
  }

  info(titulo: string, mensaje?: string): number {
    return this.mostrar({ tipo: 'info', titulo, mensaje });
  }

  mostrar(toast: Omit<Toast, 'id'>): number {
    const id = ++this.siguienteId;
    this.toasts.update((lista) => [...lista, { ...toast, id }].slice(-MAXIMO_VISIBLES));
    this.temporizadores.set(
      id,
      setTimeout(() => this.cerrar(id), DURACION_TOAST_MS),
    );
    return id;
  }

  cerrar(id: number): void {
    clearTimeout(this.temporizadores.get(id));
    this.temporizadores.delete(id);
    this.toasts.update((lista) => lista.filter((t) => t.id !== id));
  }

  /** Mientras el puntero o el foco están sobre un toast no se cierra (WCAG 2.2.1). */
  pausar(id: number): void {
    clearTimeout(this.temporizadores.get(id));
  }

  reanudar(id: number): void {
    clearTimeout(this.temporizadores.get(id));
    this.temporizadores.set(
      id,
      setTimeout(() => this.cerrar(id), DURACION_TOAST_MS),
    );
  }
}

/** Contenedor de toasts: va una sola vez en la raíz de la app. */
@Component({
  selector: 'hk-toast',
  imports: [LucideDynamicIcon, TranslocoPipe],
  template: `
    <div
      class="pointer-events-none fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-1100 flex flex-col items-stretch gap-2 md:inset-x-auto md:top-4 md:right-4 md:bottom-auto md:w-96"
      aria-live="polite"
      aria-atomic="false"
    >
      @for (toast of servicio.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex hk-overlay items-start gap-3 p-3.5 pr-2"
          (mouseenter)="servicio.pausar(toast.id)"
          (mouseleave)="servicio.reanudar(toast.id)"
          (focusin)="servicio.pausar(toast.id)"
          (focusout)="servicio.reanudar(toast.id)"
        >
          <svg
            [lucideIcon]="estilo[toast.tipo].icono"
            class="mt-0.5 size-5 shrink-0"
            [class]="estilo[toast.tipo].clase"
            aria-hidden="true"
          />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-fg">{{ toast.titulo }}</p>
            @if (toast.mensaje) {
              <p class="mt-0.5 text-sm text-muted">{{ toast.mensaje }}</p>
            }
          </div>
          <button
            type="button"
            class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hk-foco transition-colors hover:bg-surface-2 hover:text-fg"
            [attr.aria-label]="'comun.cerrar' | transloco"
            (click)="servicio.cerrar(toast.id)"
          >
            <svg lucideIcon="x" class="size-4" aria-hidden="true" />
          </button>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkToast {
  protected readonly servicio = inject(ToastService);
  protected readonly estilo = ESTILO;
}
