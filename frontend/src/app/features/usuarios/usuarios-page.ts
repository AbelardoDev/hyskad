import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { AuthService } from '../../core/auth/auth.service';
import { Rol, ROLES } from '../../core/auth/permisos';
import { erroresManejados } from '../../core/http/contexto-http';
import { TiempoRelativoPipe } from '../../core/utils/formato.pipes';
import { HkAvatar } from '../../shared/ui/avatar/avatar';
import { HkBadge } from '../../shared/ui/badge/badge';
import { HkRolBadge } from '../../shared/ui/badge/rol-badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkDropdownMenu, ItemMenu } from '../../shared/ui/dropdown-menu/dropdown-menu';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { FiltroActivo, HkFilterBar } from '../../shared/ui/filter-bar/filter-bar';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { ColumnaTabla, HkCelda, HkTable, OrdenTabla } from '../../shared/ui/table/table';
import { ToastService } from '../../shared/ui/toast/toast';
import { DatosFormUsuario, UsuarioFormDrawer } from './usuario-form-drawer';
import { FiltrosUsuarios, Usuario, UsuariosApiService } from './usuarios-api.service';

const TAMANO_PAGINA = 20;
const ESTADOS = ['activos', 'inactivos'] as const;
type Estado = (typeof ESTADOS)[number];

/** Administración de usuarios (RF1, RF3): búsqueda, filtros, crear/editar y activar/desactivar. */
@Component({
  selector: 'hk-usuarios-page',
  imports: [
    TranslocoPipe,
    LucideDynamicIcon,
    TiempoRelativoPipe,
    HkAvatar,
    HkBadge,
    HkRolBadge,
    HkButton,
    HkCard,
    HkDropdownMenu,
    HkEmptyState,
    HkFilterBar,
    HkSelect,
    HkPageHeader,
    HkTable,
    HkCelda,
  ],
  template: `
    <hk-page-header
      [titulo]="'usuarios.titulo' | transloco"
      [subtitulo]="'usuarios.subtitulo' | transloco"
    >
      <button hk-button icono="plus" hkAccionPrincipal (click)="abrirFormulario()">
        {{ 'usuarios.nuevo' | transloco }}
      </button>
    </hk-page-header>

    <hk-card>
      <hk-filter-bar
        [placeholder]="'usuarios.buscar' | transloco"
        [busqueda]="filtros().q"
        [filtros]="filtrosActivos()"
        (busquedaCambio)="filtrar({ q: $event })"
        (quitar)="quitarFiltro($event)"
        (limpiar)="limpiarFiltros()"
      >
        <hk-select
          class="w-full sm:w-44"
          [opciones]="opcionesRol()"
          [placeholder]="'usuarios.filtros.todos_roles' | transloco"
          [etiquetaAccesible]="'usuarios.campos.rol' | transloco"
          [valor]="filtros().rol"
          (valorChange)="filtrar({ rol: aRol($event) })"
        />
        <hk-select
          class="w-full sm:w-44"
          [opciones]="opcionesEstado()"
          [placeholder]="'usuarios.filtros.todos_estados' | transloco"
          [etiquetaAccesible]="'usuarios.campos.estado' | transloco"
          [valor]="estadoFiltro()"
          (valorChange)="filtrar({ activo: aActivo($event) })"
        />
      </hk-filter-bar>

      <div class="mt-5">
        @if (usuarios.error()) {
          <hk-empty-state
            icono="circle-alert"
            [titulo]="'usuarios.error_titulo' | transloco"
            [texto]="'usuarios.error_texto' | transloco"
          >
            <button hk-button variante="secondary" icono="rotate-ccw" (click)="usuarios.reload()">
              {{ 'comun.reintentar' | transloco }}
            </button>
          </hk-empty-state>
        } @else {
          <hk-table
            [columnas]="columnas()"
            [filas]="usuarios.value()?.content ?? []"
            [cargando]="usuarios.isLoading()"
            [etiqueta]="'usuarios.titulo' | transloco"
            [orden]="orden()"
            (ordenChange)="ordenar($event)"
            [pagina]="filtros().page"
            [tamano]="tamanoPagina"
            [total]="usuarios.value()?.totalElements"
            (paginaCambio)="filtrar({ page: $event }, false)"
            vacioIcono="users-round"
            [vacioTitulo]="'usuarios.vacio_titulo' | transloco"
            [vacioTexto]="'usuarios.vacio_texto' | transloco"
          >
            <ng-template hkCelda="nombre" let-u>
              <div class="flex min-w-0 items-center gap-3">
                <hk-avatar [nombre]="u.nombre" tamano="sm" />
                <div class="min-w-0">
                  <p class="truncate font-medium text-fg">
                    {{ u.nombre }}
                    @if (u.id === idActual()) {
                      <span class="font-normal text-muted">({{ 'usuarios.tu' | transloco }})</span>
                    }
                  </p>
                  <p class="truncate text-xs font-normal text-muted">{{ u.email }}</p>
                </div>
              </div>
            </ng-template>
            <ng-template hkCelda="rol" let-u>
              <hk-rol-badge [rol]="u.rol" />
            </ng-template>
            <ng-template hkCelda="activo" let-u>
              <hk-badge
                [tono]="u.activo ? 'success' : 'neutral'"
                [icono]="u.activo ? 'circle-check' : 'circle-x'"
              >
                {{ (u.activo ? 'usuarios.estado.activo' : 'usuarios.estado.inactivo') | transloco }}
              </hk-badge>
            </ng-template>
            <ng-template hkCelda="ultimoAcceso" let-u>
              <span class="text-muted">
                {{
                  u.ultimoAcceso
                    ? (u.ultimoAcceso | tiempoRelativo)
                    : ('usuarios.nunca' | transloco)
                }}
              </span>
            </ng-template>
            <ng-template hkCelda="acciones" let-u>
              <hk-dropdown-menu
                [etiqueta]="'usuarios.acciones_de' | transloco: { nombre: u.nombre }"
                [items]="accionesDe(u)"
                (seleccion)="ejecutar($event, u)"
              >
                <svg lucideIcon="ellipsis" class="size-5" aria-hidden="true" />
              </hk-dropdown-menu>
            </ng-template>
          </hk-table>
        }
      </div>
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuariosPage {
  private readonly api = inject(UsuariosApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialogos = inject(DialogosService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly tamanoPagina = TAMANO_PAGINA;
  protected readonly idActual = computed(() => this.auth.usuario()?.id);
  protected readonly filtros = signal<FiltrosUsuarios>({
    q: '',
    rol: null,
    activo: null,
    page: 0,
    size: TAMANO_PAGINA,
    sort: 'nombre,asc',
  });

  protected readonly usuarios = rxResource({
    params: () => this.filtros(),
    stream: ({ params }) => this.api.listar(params, erroresManejados()),
  });

  protected readonly orden = computed<OrdenTabla | null>(() => {
    const [columna, direccion] = (this.filtros().sort ?? '').split(',');
    return columna ? { columna, direccion: direccion === 'desc' ? 'desc' : 'asc' } : null;
  });
  protected readonly estadoFiltro = computed<Estado | null>(() => {
    const activo = this.filtros().activo;
    return activo === null ? null : activo ? 'activos' : 'inactivos';
  });

  private readonly textos = translateSignal([
    'usuarios.campos.nombre',
    'usuarios.campos.rol',
    'usuarios.campos.estado',
    'usuarios.campos.ultimo_acceso',
    'usuarios.campos.acciones',
  ]);
  private readonly textosRol = translateSignal(ROLES.map((r) => `roles.${r}`));
  private readonly textosEstado = translateSignal(ESTADOS.map((e) => `usuarios.filtros.${e}`));
  private readonly textosAcciones = translateSignal([
    'usuarios.editar',
    'usuarios.permisos.ver',
    'usuarios.activar',
    'usuarios.desactivar',
  ]);

  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [nombre, rol, estado, acceso, acciones] = this.textos();
    return [
      { clave: 'nombre', etiqueta: nombre, ordenable: true, principal: true },
      { clave: 'rol', etiqueta: rol },
      { clave: 'activo', etiqueta: estado },
      { clave: 'ultimoAcceso', etiqueta: acceso, ordenable: true, ocultarEnMovil: true },
      { clave: 'acciones', etiqueta: acciones, alinear: 'fin' },
    ];
  });
  protected readonly opcionesRol = computed<OpcionSelect[]>(() =>
    ROLES.map((valor, i) => ({ valor, etiqueta: this.textosRol()[i] })),
  );
  protected readonly opcionesEstado = computed<OpcionSelect[]>(() =>
    ESTADOS.map((valor, i) => ({ valor, etiqueta: this.textosEstado()[i] })),
  );
  protected readonly filtrosActivos = computed<FiltroActivo[]>(() => {
    const { rol, activo } = this.filtros();
    const activos: FiltroActivo[] = [];
    if (rol) activos.push({ clave: 'rol', etiqueta: this.textosRol()[ROLES.indexOf(rol)] });
    if (activo !== null)
      activos.push({ clave: 'activo', etiqueta: this.textosEstado()[activo ? 0 : 1] });
    return activos;
  });

  protected aRol(valor: string | null): Rol | null {
    return ROLES.find((r) => r === valor) ?? null;
  }

  protected aActivo(valor: string | null): boolean | null {
    return valor === 'activos' ? true : valor === 'inactivos' ? false : null;
  }

  /** Cambia filtros; salvo al paginar, vuelve a la primera página. */
  protected filtrar(cambio: Partial<FiltrosUsuarios>, reiniciarPagina = true): void {
    this.filtros.update((f) => ({ ...f, ...(reiniciarPagina ? { page: 0 } : {}), ...cambio }));
  }

  protected ordenar(orden: OrdenTabla | null): void {
    this.filtrar({ sort: orden ? `${orden.columna},${orden.direccion}` : null });
  }

  protected quitarFiltro(clave: string): void {
    if (clave === 'rol') this.filtrar({ rol: null });
    if (clave === 'activo') this.filtrar({ activo: null });
  }

  protected limpiarFiltros(): void {
    this.filtrar({ rol: null, activo: null });
  }

  protected accionesDe(usuario: Usuario): ItemMenu[] {
    const [editar, permisos, activar, desactivar] = this.textosAcciones();
    const items: ItemMenu[] = [
      { id: 'editar', etiqueta: editar, icono: 'pencil' },
      { id: 'permisos', etiqueta: permisos, icono: 'shield-check' },
    ];
    // RN-47: nadie cambia su propio estado.
    if (usuario.id !== this.idActual()) {
      items.push(
        usuario.activo
          ? {
              id: 'desactivar',
              etiqueta: desactivar,
              icono: 'power',
              peligro: true,
              separadorAntes: true,
            }
          : { id: 'activar', etiqueta: activar, icono: 'power', separadorAntes: true },
      );
    }
    return items;
  }

  protected ejecutar(accion: string, usuario: Usuario): void {
    if (accion === 'editar') this.abrirFormulario(usuario);
    else if (accion === 'permisos')
      void this.router.navigate(['/usuarios', usuario.id, 'permisos']);
    else if (accion === 'activar' || accion === 'desactivar')
      void this.cambiarEstado(usuario, accion === 'activar');
  }

  protected abrirFormulario(usuario?: Usuario): void {
    this.dialogos
      .abrirDrawer<UsuarioFormDrawer, DatosFormUsuario, Usuario>(UsuarioFormDrawer, {
        datos: { usuario },
      })
      .closed.subscribe((guardado) => {
        if (!guardado) return;
        this.toast.exito(
          this.transloco.translate(usuario ? 'usuarios.actualizado' : 'usuarios.creado', {
            nombre: guardado.nombre,
          }),
        );
        this.usuarios.reload();
      });
  }

  private async cambiarEstado(usuario: Usuario, activo: boolean): Promise<void> {
    const prefijo = activo ? 'usuarios.confirmar_activar' : 'usuarios.confirmar_desactivar';
    const confirmado = await this.confirmacion.pedir({
      titulo: this.transloco.translate(`${prefijo}.titulo`),
      mensaje: this.transloco.translate(`${prefijo}.mensaje`, { nombre: usuario.nombre }),
      textoConfirmar: this.transloco.translate(activo ? 'usuarios.activar' : 'usuarios.desactivar'),
      peligrosa: !activo,
    });
    if (!confirmado) return;
    this.api.cambiarEstado(usuario.id, activo).subscribe(() => {
      this.toast.exito(
        this.transloco.translate(activo ? 'usuarios.activado' : 'usuarios.desactivado', {
          nombre: usuario.nombre,
        }),
      );
      this.usuarios.reload();
    });
  }
}
