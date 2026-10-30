import { BreakpointObserver } from '@angular/cdk/layout';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { almacenLocal } from '../utils/almacen-local';

export const CLAVE_SIDEBAR = 'hk.sidebar';
export const ESCRITORIO = '(min-width: 1024px)';
export const MOVIL = '(max-width: 767.98px)';

/**
 * Estado del layout (DESIGN-SYSTEM §5): sidebar expandido/colapsado (recordado), colapsado por
 * defecto en tablet, y drawer + barra inferior en móvil.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly breakpoints = inject(BreakpointObserver);

  readonly esMovil = toSignal(this.breakpoints.observe(MOVIL).pipe(map((r) => r.matches)), {
    initialValue: this.breakpoints.isMatched(MOVIL),
  });
  readonly esEscritorio = toSignal(
    this.breakpoints.observe(ESCRITORIO).pipe(map((r) => r.matches)),
    {
      initialValue: this.breakpoints.isMatched(ESCRITORIO),
    },
  );

  /** `null` = el usuario no ha elegido: colapsado en tablet, expandido en escritorio. */
  private readonly preferencia = signal<boolean | null>(this.leerPreferencia());
  readonly colapsado = computed(() => this.preferencia() ?? !this.esEscritorio());

  alternarSidebar(): void {
    const colapsado = !this.colapsado();
    this.preferencia.set(colapsado);
    almacenLocal.escribir(CLAVE_SIDEBAR, colapsado ? 'colapsado' : 'expandido');
  }

  private leerPreferencia(): boolean | null {
    const guardada = almacenLocal.leer(CLAVE_SIDEBAR);
    return guardada === 'colapsado' ? true : guardada === 'expandido' ? false : null;
  }
}
