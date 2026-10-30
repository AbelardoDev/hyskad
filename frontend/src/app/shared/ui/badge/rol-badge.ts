import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { Rol } from '../../../core/auth/permisos';
import { HkBadge, TonoBadge } from './badge';

const TONO_ROL: Record<Rol, TonoBadge> = {
  ADMIN: 'primary',
  ALMACEN: 'info',
  VENDEDOR: 'accent',
  MECANICO: 'warning',
};

const ICONO_ROL: Record<Rol, string> = {
  ADMIN: 'shield-user',
  ALMACEN: 'package',
  VENDEDOR: 'shopping-cart',
  MECANICO: 'wrench',
};

/** Rol de un usuario con su color e ícono. */
@Component({
  selector: 'hk-rol-badge',
  imports: [HkBadge, TranslocoPipe],
  template: `<hk-badge [tono]="tono()" [icono]="icono()">{{
    'roles.' + rol() | transloco
  }}</hk-badge>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkRolBadge {
  readonly rol = input.required<Rol>();

  protected readonly tono = computed(() => TONO_ROL[this.rol()]);
  protected readonly icono = computed(() => ICONO_ROL[this.rol()]);
}
