import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { HkTienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import { erroresManejados } from '../../core/http/contexto-http';
import { HkBadge } from '../../shared/ui/badge/badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { FiltroActivo, HkFilterBar } from '../../shared/ui/filter-bar/filter-bar';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { ColumnaTabla, HkCelda, HkTable, OrdenTabla } from '../../shared/ui/table/table';
import { ToastService } from '../../shared/ui/toast/toast';
import { ClienteFormDrawer, DatosFormCliente } from './cliente-form-drawer';
import {
  Cliente,
  ClienteResumen,
  ClientesApiService,
  FiltrosClientes,
} from './clientes-api.service';

const TAMANO_PAGINA = 20;
const ESTADOS = ['activos', 'inactivos'] as const;

/** Lista de clientes (RF5, RF6, RF29): búsqueda libre, filtro de estado y acciones por fila. */
@Component({
  selector: 'hk-clientes-page',
  imports: [
    TranslocoPipe,
    LucideDynamicIcon,
    HkTienePermisoDirective,
    HkBadge,
    HkButton,
    HkCard,
    HkEmptyState,
    HkFilterBar,
    HkSelect,
    HkPageHeader,
    HkTable,
    HkCelda,
  ],
  template: `
    <hk-page-header
      [titulo]="'clientes.titulo' | transloco"
      [subtitulo]="'clientes.subtitulo' | transloco"
    >
      <button
        *hkTienePermiso="'CLIENTES_GESTIONAR'"
        hk-button
        icono="plus"
        hkAccionPrincipal
        (click)="abrirFormulario()"
      >
        {{ 'clientes.nuevo' | transloco }}
      </button>
    </hk-page-header>

    <hk-card>
      <hk-filter-bar
        [placeholder]="'clientes.buscar' | transloco"
        [busqueda]="filtros().q"
        [filtros]="filtrosActivos()"
        (busquedaCambio)="filtrar({ q: $event })"
        (quitar)="filtrar({ activo: null })"
        (limpiar)="filtrar({ activo: null })"
      >
        <hk-select
          class="w-full sm:w-44"
          [opciones]="opcionesEstado()"
          [placeholder]="'comun.filtros.todos_estados' | transloco"
          [etiquetaAccesible]="'comun.estado.titulo' | transloco"
          [valor]="estadoFiltro()"
          (valorChange)="filtrar({ activo: aActivo($event) })"
        />
      </hk-filter-bar>

      <div class="mt-5">
        @if (clientes.error()) {
          <hk-empty-state
            icono="circle-alert"
            [titulo]="'clientes.error_titulo' | transloco"
            [texto]="'comun.error_texto' | transloco"
          >
            <button hk-button variante="secondary" icono="rotate-ccw" (click)="clientes.reload()">
              {{ 'comun.reintentar' | transloco }}
            </button>
          </hk-empty-state>
        } @else {
          <hk-table
            [columnas]="columnas()"
            [filas]="clientes.value()?.content ?? []"
            [cargando]="clientes.isLoading()"
            [etiqueta]="'clientes.titulo' | transloco"
            [orden]="orden()"
            (ordenChange)="ordenar($event)"
            [pagina]="filtros().page"
            [tamano]="tamanoPagina"
            [total]="clientes.value()?.totalElements"
            (paginaCambio)="filtrar({ page: $event }, false)"
            filasClicables
            (filaClic)="verDetalle($event)"
            vacioIcono="users-round"
            [vacioTitulo]="'clientes.vacio_titulo' | transloco"
            [vacioTexto]="'clientes.vacio_texto' | transloco"
          >
            <ng-template hkCelda="nombreCompleto" let-c>
              <div class="min-w-0">
                <p class="truncate font-medium text-fg">{{ c.nombreCompleto }}</p>
                @if (c.email) {
                  <p class="truncate text-xs font-normal text-muted">{{ c.email }}</p>
                }
              </div>
            </ng-template>
            <ng-template hkCelda="numeroDocumento" let-c>
              <span class="whitespace-nowrap tabular">
                <span class="text-muted">{{ c.tipoDocumento }}</span> {{ c.numeroDocumento }}
              </span>
            </ng-template>
            <ng-template hkCelda="telefono" let-c>
              <span class="tabular">{{ c.telefono }}</span>
            </ng-template>
            <ng-template hkCelda="cantidadMotos" let-c>
              <span class="inline-flex items-center gap-1.5 tabular">
                <svg lucideIcon="bike" class="size-4 text-muted" aria-hidden="true" />
                {{ c.cantidadMotos }}
              </span>
            </ng-template>
            <ng-template hkCelda="activo" let-c>
              <hk-badge
                [tono]="c.activo ? 'success' : 'neutral'"
                [icono]="c.activo ? 'circle-check' : 'circle-x'"
              >
                {{ (c.activo ? 'comun.estado.activo' : 'comun.estado.inactivo') | transloco }}
              </hk-badge>
            </ng-template>
          </hk-table>
        }
      </div>
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientesPage {
  private readonly api = inject(ClientesApiService);
  private readonly router = inject(Router);
  private readonly dialogos = inject(DialogosService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly tamanoPagina = TAMANO_PAGINA;
  protected readonly filtros = signal<FiltrosClientes>({
    q: '',
    activo: null,
    page: 0,
    size: TAMANO_PAGINA,
    sort: 'nombreCompleto,asc',
  });

  protected readonly clientes = rxResource({
    params: () => this.filtros(),
    stream: ({ params }) => this.api.listar(params, erroresManejados()),
  });

  protected readonly orden = computed<OrdenTabla | null>(() => {
    const [columna, direccion] = (this.filtros().sort ?? '').split(',');
    return columna ? { columna, direccion: direccion === 'desc' ? 'desc' : 'asc' } : null;
  });
  protected readonly estadoFiltro = computed(() => {
    const activo = this.filtros().activo;
    return activo === null ? null : activo ? 'activos' : 'inactivos';
  });

  private readonly textos = translateSignal([
    'clientes.campos.nombre',
    'clientes.campos.documento',
    'clientes.campos.telefono',
    'clientes.campos.motos',
    'comun.estado.titulo',
  ]);
  private readonly textosEstado = translateSignal(ESTADOS.map((e) => `comun.filtros.${e}`));

  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [nombre, documento, telefono, motos, estado] = this.textos();
    return [
      { clave: 'nombreCompleto', etiqueta: nombre, ordenable: true, principal: true },
      { clave: 'numeroDocumento', etiqueta: documento, ordenable: true },
      { clave: 'telefono', etiqueta: telefono, ocultarEnMovil: true },
      { clave: 'cantidadMotos', etiqueta: motos, numerica: true },
      { clave: 'activo', etiqueta: estado },
    ];
  });
  protected readonly opcionesEstado = computed<OpcionSelect[]>(() =>
    ESTADOS.map((valor, i) => ({ valor, etiqueta: this.textosEstado()[i] })),
  );
  protected readonly filtrosActivos = computed<FiltroActivo[]>(() => {
    const activo = this.filtros().activo;
    return activo === null
      ? []
      : [{ clave: 'activo', etiqueta: this.textosEstado()[activo ? 0 : 1] }];
  });

  protected aActivo(valor: string | null): boolean | null {
    return valor === 'activos' ? true : valor === 'inactivos' ? false : null;
  }

  /** Cambia filtros; salvo al paginar, vuelve a la primera página. */
  protected filtrar(cambio: Partial<FiltrosClientes>, reiniciarPagina = true): void {
    this.filtros.update((f) => ({ ...f, ...(reiniciarPagina ? { page: 0 } : {}), ...cambio }));
  }

  protected ordenar(orden: OrdenTabla | null): void {
    this.filtrar({ sort: orden ? `${orden.columna},${orden.direccion}` : null });
  }

  protected verDetalle(cliente: ClienteResumen): void {
    void this.router.navigate(['/clientes', cliente.id]);
  }

  /** Registra un cliente y abre su ficha, desde donde se le agregan motos. */
  protected abrirFormulario(): void {
    this.dialogos
      .abrirDrawer<ClienteFormDrawer, DatosFormCliente, Cliente>(ClienteFormDrawer, {
        datos: {},
        tamano: 'lg',
      })
      .closed.subscribe((guardado) => {
        if (!guardado) return;
        this.toast.exito(
          this.transloco.translate('clientes.creado', { nombre: guardado.nombreCompleto }),
        );
        void this.router.navigate(['/clientes', guardado.id]);
      });
  }
}
