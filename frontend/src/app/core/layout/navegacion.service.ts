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
      items: g.items.filter((i) => this.auth.tieneAlguno(i.permisos)),
    })).filter((g) => g.items.length > 0),
  );

  private readonly items = computed(() => this.grupos().flatMap((g) => g.items));

  /** Los accesos rápidos del rol y, si son menos de 4, los siguientes ítems permitidos del menú. */
  readonly accesosRapidos = computed<readonly ItemMenuNavegacion[]>(() => {
    const rapidos = this.items().filter((i) => i.accesoRapido);
    const resto = this.items().filter((i) => !i.accesoRapido);
    return [...rapidos, ...resto].slice(0, MAX_ACCESOS_RAPIDOS);
  });

  /** Primera pantalla permitida (el dashboard para todos los roles por defecto); sin sesión, el login. */
  readonly rutaInicio = computed(() => {
    if (!this.auth.estaAutenticado()) return '/login';
    return this.items()[0]?.ruta ?? '/perfil';
  });
}
