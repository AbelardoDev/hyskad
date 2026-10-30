import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { Permiso } from '../auth/permisos';
import { erroresManejados } from '../http/contexto-http';

/** Contadores que el menú muestra junto a un ítem (`ItemMenuNavegacion.contador`). */
export type ClaveContador = 'stockBajo';

/** Quién ve cada contador: el stock bajo le interesa a quien gestiona productos. */
const PERMISO_CONTADOR: Record<ClaveContador, Permiso> = { stockBajo: 'PRODUCTOS_GESTIONAR' };

/**
 * Valores de los contadores del menú. Se cargan al iniciar sesión y cuando una pantalla avisa que
 * cambió algo (`recargar`). Hasta F10 no hay tiempo real: un movimiento hecho en otro equipo se
 * ve al recargar.
 */
@Injectable({ providedIn: 'root' })
export class ContadoresService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly stockBajo = signal(0);
  private readonly puedeVerStockBajo = computed(() =>
    this.auth.tienePermiso(PERMISO_CONTADOR.stockBajo),
  );

  constructor() {
    effect(() => {
      if (this.puedeVerStockBajo()) untracked(() => this.recargar());
      else this.stockBajo.set(0);
    });
  }

  valor(clave: ClaveContador): number {
    return clave === 'stockBajo' ? this.stockBajo() : 0;
  }

  /** Vuelve a contar los productos con stock bajo (tras un ajuste, por ejemplo). */
  recargar(): void {
    if (!this.puedeVerStockBajo()) return;
    this.http
      .get<unknown[]>('/api/v1/productos/stock-bajo', { context: erroresManejados() })
      .subscribe({ next: (lista) => this.stockBajo.set(lista.length), error: () => undefined });
  }
}
