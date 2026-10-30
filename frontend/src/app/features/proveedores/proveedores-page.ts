import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';

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
import { DatosFormProveedor, ProveedorFormDrawer } from './proveedor-form-drawer';
import { FiltrosProveedores, Proveedor, ProveedoresApiService } from './proveedores-api.service';

const TAMANO_PAGINA = 20;
const ESTADOS = ['activos', 'inactivos'] as const;

/** Lista de proveedores (RF20): búsqueda y filtro de estado; la fila abre la ficha. */
@Component({
  selector: 'hk-proveedores-page',
  imports: [
    TranslocoPipe,
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
      [titulo]="'proveedores.titulo' | transloco"
      [subtitulo]="'proveedores.subtitulo' | transloco"
    >
      <button hk-button icono="plus" hkAccionPrincipal (click)="nuevo()">
        {{ 'proveedores.nuevo' | transloco }}
      </button>
    </hk-page-header>

    <hk-card>
      <hk-filter-bar
        [placeholder]="'proveedores.buscar' | transloco"
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
          (valorChange)="
            filtrar({ activo: $event === 'activos' ? true : $event === 'inactivos' ? false : null })
          "
        />
      </hk-filter-bar>

      <div class="mt-5">
        @if (proveedores.error()) {
          <hk-empty-state
            icono="circle-alert"
            [titulo]="'proveedores.error_titulo' | transloco"
            [texto]="'comun.error_texto' | transloco"
          >
            <button
              hk-button
              variante="secondary"
              icono="rotate-ccw"
              (click)="proveedores.reload()"
            >
              {{ 'comun.reintentar' | transloco }}
            </button>
          </hk-empty-state>
        } @else {
          <hk-table
            [columnas]="columnas()"
            [filas]="proveedores.value()?.content ?? []"
            [cargando]="proveedores.isLoading()"
            [etiqueta]="'proveedores.titulo' | transloco"
            [orden]="orden()"
            (ordenChange)="ordenar($event)"
            [pagina]="filtros().page"
            [tamano]="tamanoPagina"
            [total]="proveedores.value()?.totalElements"
            (paginaCambio)="filtrar({ page: $event }, false)"
            filasClicables
            (filaClic)="verDetalle($event)"
            vacioIcono="building"
            [vacioTitulo]="'proveedores.vacio_titulo' | transloco"
            [vacioTexto]="'proveedores.vacio_texto' | transloco"
          >
            <ng-template hkCelda="razonSocial" let-p>
              <p class="font-medium text-fg">{{ p.razonSocial }}</p>
              @if (p.contacto) {
                <p class="text-xs text-muted">{{ p.contacto }}</p>
              }
            </ng-template>
            <ng-template hkCelda="numeroDocumento" let-p>
              <span class="whitespace-nowrap tabular">
                <span class="text-muted">{{ p.tipoDocumento }}</span> {{ p.numeroDocumento }}
              </span>
            </ng-template>
            <ng-template hkCelda="telefono" let-p>
              <span class="tabular">{{ p.telefono ?? '—' }}</span>
            </ng-template>
            <ng-template hkCelda="activo" let-p>
              <hk-badge
                [tono]="p.activo ? 'success' : 'neutral'"
                [icono]="p.activo ? 'circle-check' : 'circle-x'"
              >
                {{ (p.activo ? 'comun.estado.activo' : 'comun.estado.inactivo') | transloco }}
              </hk-badge>
            </ng-template>
          </hk-table>
        }
      </div>
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProveedoresPage {
  private readonly api = inject(ProveedoresApiService);
  private readonly router = inject(Router);
  private readonly dialogos = inject(DialogosService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly tamanoPagina = TAMANO_PAGINA;
  protected readonly filtros = signal<FiltrosProveedores>({
    q: '',
    activo: null,
    page: 0,
    size: TAMANO_PAGINA,
    sort: 'razonSocial,asc',
  });
  protected readonly proveedores = rxResource({
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
    'proveedores.campos.razon_social',
    'documentos.titulo',
    'proveedores.campos.telefono',
    'comun.estado.titulo',
  ]);
  private readonly textosEstado = translateSignal(ESTADOS.map((e) => `comun.filtros.${e}`));
  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [razon, documento, telefono, estado] = this.textos();
    return [
      { clave: 'razonSocial', etiqueta: razon, ordenable: true, principal: true },
      { clave: 'numeroDocumento', etiqueta: documento, ordenable: true },
      { clave: 'telefono', etiqueta: telefono, ocultarEnMovil: true },
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

  protected filtrar(cambio: Partial<FiltrosProveedores>, reiniciarPagina = true): void {
    this.filtros.update((f) => ({ ...f, ...(reiniciarPagina ? { page: 0 } : {}), ...cambio }));
  }

  protected ordenar(orden: OrdenTabla | null): void {
    this.filtrar({ sort: orden ? `${orden.columna},${orden.direccion}` : null });
  }

  protected verDetalle(proveedor: Proveedor): void {
    void this.router.navigate(['/proveedores', proveedor.id]);
  }

  protected nuevo(): void {
    this.dialogos
      .abrirDrawer<ProveedorFormDrawer, DatosFormProveedor, Proveedor>(ProveedorFormDrawer, {
        datos: {},
      })
      .closed.subscribe((creado) => {
        if (!creado) return;
        this.toast.exito(
          this.transloco.translate('proveedores.creado', { nombre: creado.razonSocial }),
        );
        void this.router.navigate(['/proveedores', creado.id]);
      });
  }
}
