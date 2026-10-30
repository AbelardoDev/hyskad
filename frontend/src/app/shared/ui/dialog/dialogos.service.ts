import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentType } from '@angular/cdk/portal';
import { inject, Injectable, InjectionToken } from '@angular/core';

import { nuevoId } from '../forms/campo';

/** Id del título del diálogo abierto: el contenedor del CDK lo usa en `aria-labelledby`. */
export const HK_ID_TITULO_DIALOGO = new InjectionToken<string>('HK_ID_TITULO_DIALOGO');

export interface OpcionesDialogo<D> {
  datos?: D;
  /** Ancho máximo del modal. */
  tamano?: 'sm' | 'md' | 'lg' | 'xl';
  /** Lado desde el que entra el drawer. */
  lado?: 'izquierda' | 'derecha';
  /** Si es `false`, ni Esc ni el clic en el fondo lo cierran (formularios con cambios, por ejemplo). */
  cerrable?: boolean;
}

const ANCHOS = { sm: '24rem', md: '32rem', lg: '42rem', xl: '56rem' } as const;

/**
 * Abre modales y drawers del kit sobre el Dialog del CDK (trampa de foco, `Esc`, foco restaurado).
 * El componente abierto debe envolver su contenido en `hk-modal` o `hk-drawer`.
 */
@Injectable({ providedIn: 'root' })
export class DialogosService {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  abrirModal<C, D = unknown, R = unknown>(
    componente: ComponentType<C>,
    opciones: OpcionesDialogo<D> = {},
  ): DialogRef<R, C> {
    return this.abrir<C, D, R>(componente, opciones, {
      width: `min(${ANCHOS[opciones.tamano ?? 'md']}, calc(100vw - 2rem))`,
      maxHeight: 'calc(100dvh - 2rem)',
      panelClass: 'hk-dialogo-panel',
    });
  }

  abrirDrawer<C, D = unknown, R = unknown>(
    componente: ComponentType<C>,
    opciones: OpcionesDialogo<D> = {},
  ): DialogRef<R, C> {
    const posicion = this.overlay.position().global().top('0');
    if (opciones.lado === 'izquierda') posicion.left('0');
    else posicion.right('0');
    return this.abrir<C, D, R>(componente, opciones, {
      width:
        opciones.lado === 'izquierda'
          ? 'min(18rem, 85vw)'
          : `min(${ANCHOS[opciones.tamano ?? 'md']}, 100vw)`,
      height: '100dvh',
      positionStrategy: posicion,
      panelClass: [
        'hk-drawer-panel',
        opciones.lado === 'izquierda' ? 'hk-drawer-izquierda' : 'hk-drawer-derecha',
      ],
    });
  }

  private abrir<C, D, R>(
    componente: ComponentType<C>,
    opciones: OpcionesDialogo<D>,
    config: DialogConfig<D, DialogRef<R, C>>,
  ): DialogRef<R, C> {
    const idTitulo = nuevoId('hk-dialogo-titulo');
    return this.dialog.open<R, D, C>(componente, {
      ...config,
      data: opciones.datos,
      disableClose: opciones.cerrable === false,
      ariaLabelledBy: idTitulo,
      ariaModal: true,
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      backdropClass: 'hk-backdrop',
      providers: [{ provide: HK_ID_TITULO_DIALOGO, useValue: idTitulo }],
    });
  }
}
