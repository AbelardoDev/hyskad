import { DIALOG_DATA } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { FechaPipe } from '../../core/utils/formato.pipes';
import { HkDrawer } from '../../shared/ui/dialog/drawer';
import { RegistroAuditoria } from './auditoria-api.service';

/** Un par clave → valor del detalle, con objetos y listas aplanados a texto legible. */
export interface ParDetalle {
  clave: string;
  valor: string;
}

/** Aplana el JSON del detalle a pares legibles: `{a: {b: 1}}` → `a.b → 1`; listas separadas por coma. */
export function paresDetalle(detalle: Record<string, unknown> | null, prefijo = ''): ParDetalle[] {
  if (!detalle) return [];
  return Object.entries(detalle).flatMap(([clave, valor]) => {
    const nombre = prefijo ? `${prefijo}.${clave}` : clave;
    if (valor !== null && typeof valor === 'object' && !Array.isArray(valor)) {
      return paresDetalle(valor as Record<string, unknown>, nombre);
    }
    const texto = Array.isArray(valor)
      ? valor.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ')
      : valor === null || valor === undefined
        ? '—'
        : String(valor);
    return [{ clave: nombre, valor: texto || '—' }];
  });
}

/** Panel lateral con un registro de auditoría y su detalle en forma clave → valor. */
@Component({
  selector: 'hk-detalle-auditoria-drawer',
  imports: [TranslocoPipe, FechaPipe, HkDrawer],
  template: `
    <hk-drawer [titulo]="r.accion">
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
        <dt class="text-muted">{{ 'auditoria.campos.fecha' | transloco }}</dt>
        <dd class="text-fg">{{ r.fecha | fecha: 'fechaHora' }}</dd>
        <dt class="text-muted">{{ 'auditoria.campos.usuario' | transloco }}</dt>
        <dd class="text-fg">{{ r.usuario?.nombre ?? ('auditoria.sistema' | transloco) }}</dd>
        <dt class="text-muted">{{ 'auditoria.campos.entidad' | transloco }}</dt>
        <dd class="text-fg">
          {{ 'auditoria.entidades.' + r.entidad | transloco }}
          @if (r.entidadId !== null) {
            <span class="text-muted tabular">#{{ r.entidadId }}</span>
          }
        </dd>
        <dt class="text-muted">{{ 'auditoria.campos.ip' | transloco }}</dt>
        <dd class="text-fg tabular">{{ r.ip ?? '—' }}</dd>
      </dl>

      <h3 class="mt-6 mb-2 text-sm font-semibold text-fg">{{ 'auditoria.detalle' | transloco }}</h3>
      @if (pares.length === 0) {
        <p class="text-sm text-muted">{{ 'auditoria.sin_detalle' | transloco }}</p>
      } @else {
        <dl class="divide-y divide-border rounded-xl border border-border text-sm">
          @for (p of pares; track p.clave) {
            <div class="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2">
              <dt class="font-mono text-xs break-all text-muted">{{ p.clave }}</dt>
              <dd class="break-words text-fg">{{ p.valor }}</dd>
            </div>
          }
        </dl>
      }
    </hk-drawer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleAuditoriaDrawer {
  protected readonly r = inject<RegistroAuditoria>(DIALOG_DATA);
  protected readonly pares = paresDetalle(this.r.detalle);
}
