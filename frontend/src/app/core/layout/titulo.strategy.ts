import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject, of, switchMap } from 'rxjs';

import { migasDesde } from './migas.service';

/** Título de la pestaña: "Clientes · HYSKAD", traducido y actualizado al cambiar de idioma. */
@Injectable({ providedIn: 'root' })
export class TituloStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);
  private readonly clave$ = new BehaviorSubject<string | null>(null);

  constructor() {
    super();
    this.clave$
      .pipe(
        switchMap((clave) => (clave ? this.transloco.selectTranslate<string>(clave) : of(null))),
        takeUntilDestroyed(),
      )
      .subscribe((texto) => this.title.setTitle(texto ? `${texto} · HYSKAD` : 'HYSKAD'));
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.clave$.next(migasDesde(snapshot.root).at(-1)?.clave ?? null);
  }
}
