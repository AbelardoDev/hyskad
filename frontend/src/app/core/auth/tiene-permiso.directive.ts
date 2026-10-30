import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';

import { AuthService } from './auth.service';
import { Permiso } from './permisos';

/**
 * Muestra el contenido solo si el usuario tiene el permiso (o alguno de la lista):
 * `<button *hkTienePermiso="'VENTAS_CREAR'">…</button>`. Ocultar es comodidad de la interfaz;
 * la autorización real la hace el backend.
 */
@Directive({ selector: '[hkTienePermiso]' })
export class HkTienePermisoDirective {
  private readonly auth = inject(AuthService);
  private readonly plantilla = inject(TemplateRef);
  private readonly contenedor = inject(ViewContainerRef);

  readonly hkTienePermiso = input.required<Permiso | readonly Permiso[]>();

  constructor() {
    let visible = false;
    effect(() => {
      const requeridos = this.hkTienePermiso();
      const permitido = this.auth.tieneAlguno(
        typeof requeridos === 'string' ? [requeridos] : requeridos,
      );
      if (permitido === visible) return;
      visible = permitido;
      if (permitido) this.contenedor.createEmbeddedView(this.plantilla);
      else this.contenedor.clear();
    });
  }
}
