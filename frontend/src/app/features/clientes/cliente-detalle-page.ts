import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { AuthService } from '../../core/auth/auth.service';
import { HkTienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import { erroresManejados } from '../../core/http/contexto-http';
import { FechaPipe } from '../../core/utils/formato.pipes';
import { HkBadge } from '../../shared/ui/badge/badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkPlaca } from '../../shared/ui/placa/placa';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { ToastService } from '../../shared/ui/toast/toast';
import { Motocicleta, MotocicletasApiService } from '../motocicletas/motocicletas-api.service';
import { DatosFormMoto, MotoFormDrawer } from '../motocicletas/moto-form-drawer';
import { ClienteFormDrawer, DatosFormCliente } from './cliente-form-drawer';
import { Cliente, ClientesApiService } from './clientes-api.service';

/** Ficha del cliente (RF5, RF6): datos de contacto, autorización de datos y sus motos. */
@Component({
  selector: 'hk-cliente-detalle-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    FechaPipe,
    HkTienePermisoDirective,
    HkBadge,
    HkButton,
    HkCard,
    HkEmptyState,
    HkPageHeader,
    HkPlaca,
    HkSkeleton,
  ],
  template: `
    @if (cliente.error()) {
      <hk-empty-state
        class="mt-10"
        icono="users-round"
        [titulo]="'clientes.detalle.no_encontrado' | transloco"
        [texto]="'clientes.detalle.no_encontrado_texto' | transloco"
      >
        <a hk-button variante="secondary" icono="chevron-left" routerLink="/clientes">
          {{ 'clientes.detalle.volver' | transloco }}
        </a>
      </hk-empty-state>
    } @else if (cliente.value(); as c) {
      <hk-page-header
        [titulo]="c.nombreCompleto"
        [subtitulo]="c.tipoDocumento + ' ' + c.numeroDocumento"
      >
        <ng-container *hkTienePermiso="'CLIENTES_GESTIONAR'">
          <button hk-button variante="secondary" icono="pencil" (click)="editar(c)">
            {{ 'comun.editar' | transloco }}
          </button>
          <button
            hk-button
            variante="secondary"
            icono="power"
            (click)="cambiarEstado(c, !c.activo)"
          >
            {{ (c.activo ? 'comun.desactivar' : 'comun.activar') | transloco }}
          </button>
        </ng-container>
      </hk-page-header>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <hk-card [titulo]="'clientes.detalle.datos' | transloco">
          <div class="mb-4 flex flex-wrap gap-2">
            <hk-badge
              [tono]="c.activo ? 'success' : 'neutral'"
              [icono]="c.activo ? 'circle-check' : 'circle-x'"
            >
              {{ (c.activo ? 'comun.estado.activo' : 'comun.estado.inactivo') | transloco }}
            </hk-badge>
            <hk-badge
              [tono]="c.aceptaTratamientoDatos ? 'info' : 'warning'"
              [icono]="c.aceptaTratamientoDatos ? 'shield-check' : 'shield-x'"
            >
              {{
                (c.aceptaTratamientoDatos
                  ? 'clientes.detalle.autoriza'
                  : 'clientes.detalle.no_autoriza'
                ) | transloco
              }}
            </hk-badge>
          </div>
          <dl class="grid gap-4 sm:grid-cols-2">
            @for (dato of datos(c); track dato.clave) {
              <div class="min-w-0">
                <dt class="text-xs text-muted">{{ dato.clave | transloco }}</dt>
                <dd class="font-medium break-words text-fg">
                  {{ dato.valor ?? ('comun.sin_dato' | transloco) }}
                </dd>
              </div>
            }
          </dl>
          @if (c.fechaAceptacionDatos) {
            <p class="mt-5 border-t border-border pt-4 text-xs text-muted">
              {{
                'clientes.form.autorizado_el'
                  | transloco: { fecha: (c.fechaAceptacionDatos | fecha) }
              }}
            </p>
          } @else {
            <p class="mt-5 border-t border-border pt-4 text-xs text-muted">
              {{ 'clientes.detalle.sin_correos' | transloco }}
            </p>
          }
        </hk-card>

        <hk-card [titulo]="'clientes.detalle.motos' | transloco">
          @if (puedeAgregarMoto()) {
            <button
              hk-button
              variante="secondary"
              icono="plus"
              class="mb-4"
              (click)="agregarMoto(c)"
            >
              {{ 'clientes.detalle.agregar_moto' | transloco }}
            </button>
          }
          @if (motos.isLoading()) {
            <div class="grid gap-3 sm:grid-cols-2">
              <hk-skeleton variante="rectangulo" alto="6rem" />
              <hk-skeleton variante="rectangulo" alto="6rem" />
            </div>
          } @else if (motos.error()) {
            <hk-empty-state
              compacto
              icono="circle-alert"
              [titulo]="'motos.error_titulo' | transloco"
            >
              <button hk-button variante="secondary" icono="rotate-ccw" (click)="motos.reload()">
                {{ 'comun.reintentar' | transloco }}
              </button>
            </hk-empty-state>
          } @else {
            <ul class="grid gap-3 sm:grid-cols-2">
              @for (m of motos.value() ?? []; track m.id) {
                <li>
                  <a
                    class="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-4 hk-foco transition-colors hover:border-border-strong hover:bg-surface-2"
                    [routerLink]="['/motocicletas', m.id]"
                  >
                    <span class="flex items-start justify-between gap-2">
                      <hk-placa [placa]="m.placa" />
                      @if (!m.activo) {
                        <hk-badge tono="neutral">{{
                          'comun.estado.inactiva' | transloco
                        }}</hk-badge>
                      }
                    </span>
                    <span>
                      <span class="block font-medium text-fg">{{ m.marca }} {{ m.modelo }}</span>
                      <span class="text-xs text-muted">{{ resumen(m) }}</span>
                    </span>
                  </a>
                </li>
              } @empty {
                <li class="sm:col-span-2">
                  <hk-empty-state
                    compacto
                    icono="bike"
                    [titulo]="'clientes.detalle.sin_motos' | transloco"
                    [texto]="'clientes.detalle.sin_motos_texto' | transloco"
                  />
                </li>
              }
            </ul>
          }
        </hk-card>
      </div>
    } @else {
      <div class="space-y-6" aria-busy="true">
        <hk-skeleton ancho="40%" alto="2rem" />
        <div class="grid gap-6 lg:grid-cols-2">
          <hk-skeleton variante="rectangulo" alto="16rem" />
          <hk-skeleton variante="rectangulo" alto="16rem" />
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClienteDetallePage {
  private readonly api = inject(ClientesApiService);
  private readonly motosApi = inject(MotocicletasApiService);
  private readonly auth = inject(AuthService);
  private readonly dialogos = inject(DialogosService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly id = input.required({ transform: numberAttribute });

  protected readonly cliente = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.obtener(params, erroresManejados()),
  });
  protected readonly motos = rxResource({
    params: () => (this.auth.tienePermiso('MOTOS_VER') ? this.id() : undefined),
    stream: ({ params }) => this.motosApi.delCliente(params, erroresManejados()),
  });
  /** Solo a clientes activos se les asignan motos (`CLIENTE_INACTIVO`). */
  protected readonly puedeAgregarMoto = computed(
    () => this.auth.tienePermiso('MOTOS_GESTIONAR') && (this.cliente.value()?.activo ?? false),
  );

  protected datos(c: Cliente): { clave: string; valor: string | null }[] {
    return [
      { clave: 'clientes.campos.telefono', valor: c.telefono },
      { clave: 'clientes.campos.email', valor: c.email },
      { clave: 'clientes.campos.direccion', valor: c.direccion },
      { clave: 'clientes.campos.ciudad', valor: c.ciudad },
    ];
  }

  protected resumen(m: Motocicleta): string {
    return [m.anio, m.cilindradaCc ? `${m.cilindradaCc} cc` : null, m.color]
      .filter((parte) => parte !== null)
      .join(' · ');
  }

  protected editar(cliente: Cliente): void {
    this.dialogos
      .abrirDrawer<ClienteFormDrawer, DatosFormCliente, Cliente>(ClienteFormDrawer, {
        datos: { cliente },
        tamano: 'lg',
      })
      .closed.subscribe((guardado) => {
        if (!guardado) return;
        this.toast.exito(
          this.transloco.translate('clientes.actualizado', { nombre: guardado.nombreCompleto }),
        );
        this.cliente.set(guardado);
      });
  }

  protected agregarMoto(cliente: Cliente): void {
    this.dialogos
      .abrirDrawer<MotoFormDrawer, DatosFormMoto, Motocicleta>(MotoFormDrawer, {
        datos: { cliente: { id: cliente.id, nombreCompleto: cliente.nombreCompleto } },
      })
      .closed.subscribe((guardada) => {
        if (!guardada) return;
        this.toast.exito(this.transloco.translate('motos.creada', { placa: guardada.placa }));
        this.motos.reload();
      });
  }

  protected async cambiarEstado(cliente: Cliente, activo: boolean): Promise<void> {
    const prefijo = activo ? 'clientes.confirmar_activar' : 'clientes.confirmar_desactivar';
    const confirmado = await this.confirmacion.pedir({
      titulo: this.transloco.translate(`${prefijo}.titulo`),
      mensaje: this.transloco.translate(`${prefijo}.mensaje`, { nombre: cliente.nombreCompleto }),
      textoConfirmar: this.transloco.translate(activo ? 'comun.activar' : 'comun.desactivar'),
      peligrosa: !activo,
    });
    if (!confirmado) return;
    this.api.cambiarEstado(cliente.id, activo).subscribe((actualizado) => {
      this.toast.exito(
        this.transloco.translate(activo ? 'clientes.activado' : 'clientes.desactivado', {
          nombre: actualizado.nombreCompleto,
        }),
      );
      this.cliente.set(actualizado);
    });
  }
}
