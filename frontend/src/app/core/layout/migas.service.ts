import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

export interface Miga {
  /** Clave i18n. */
  clave: string;
  url: string;
}

/**
 * Migas de pan a partir de `data.miga` de cada ruta. Se lee de `routeConfig.data` (no de `data`)
 * para que las rutas hijas con path vacío no repitan la miga del padre.
 */
export function migasDesde(raiz: ActivatedRouteSnapshot): Miga[] {
  const migas: Miga[] = [];
  const segmentos: string[] = [];
  let actual: ActivatedRouteSnapshot | null = raiz;
  while (actual) {
    segmentos.push(...actual.url.map((s) => s.path));
    const clave = actual.routeConfig?.data?.['miga'];
    if (typeof clave === 'string') migas.push({ clave, url: '/' + segmentos.join('/') });
    actual = actual.firstChild;
  }
  return migas;
}

@Injectable({ providedIn: 'root' })
export class MigasService {
  private readonly router = inject(Router);

  readonly migas = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => migasDesde(this.router.routerState.snapshot.root)),
    ),
    { initialValue: [] },
  );
}
