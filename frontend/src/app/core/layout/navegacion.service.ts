import { computed, inject, Injectable } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { GrupoMenu, ItemMenuNavegacion, MENU } from './menu.config';

/** Máximo de accesos en la barra inferior de móvil (DESIGN-SYSTEM §5). */
export const MAX_ACCESOS_RAPIDOS = 4;

/** El menú (sidebar, drawer y barra inferior) filtrado por los permisos del usuario. */
@Injectable({ providedIn: 'root' })
export class NavegacionService {
  private readonly auth = inject(AuthService);

  readonly grupos = computed<readonly GrupoMenu[]>(() =>
    MENU.map((g) => ({
      ...g,
      items: g.items.filter((i) => this.auth.tieneAlguno(i.permisos) && !this.excluido(i)),
    })).filter((g) => g.items.length > 0),
  );

  private readonly items = computed(() => this.grupos().flatMap((g) => g.items));

  /** Los accesos rápidos del rol y, si son menos de 4, los siguientes ítems permitidos del menú. */
  readonly accesosRapidos = computed<readonly ItemMenuNavegacion[]>(() => {
    const rapidos = this.items().filter((i) => i.accesoRapido);
    const resto = this.items().filter((i) => !i.accesoRapido);
    return [...rapidos, ...resto].slice(0, MAX_ACCESOS_RAPIDOS);
  });

  private excluido(item: ItemMenuNavegacion): boolean {
    return !!item.excluirCon?.some((p) => this.auth.tienePermiso(p));
  }

  /**
   * El ítem marcado como `inicio` si el usuario lo ve ("Mis órdenes" del mecánico) o la primera
   * pantalla permitida (el dashboard); sin sesión, el login.
   */
  readonly rutaInicio = computed(() => {
    if (!this.auth.estaAutenticado()) return '/login';
    const items = this.items();
    return (items.find((i) => i.inicio) ?? items[0])?.ruta ?? '/perfil';
  });
}
