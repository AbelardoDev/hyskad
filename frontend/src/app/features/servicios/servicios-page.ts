import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { erroresManejados } from '../../core/http/contexto-http';
import { CopPipe } from '../../core/utils/formato.pipes';
import { HkBadge } from '../../shared/ui/badge/badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkIconButton } from '../../shared/ui/button/icon-button';
import { HkCard } from '../../shared/ui/card/card';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { FiltroActivo, HkFilterBar } from '../../shared/ui/filter-bar/filter-bar';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { ColumnaTabla, HkCelda, HkTable, OrdenTabla } from '../../shared/ui/table/table';
import { ToastService } from '../../shared/ui/toast/toast';
import { DatosFormServicio, ServicioFormDrawer } from './servicio-form-drawer';
import { FiltrosServicios, Servicio, ServiciosApiService } from './servicios-api.service';

const TAMANO_PAGINA = 20;
const ESTADOS = ['activos', 'inactivos'] as const;

/** Catálogo de servicios del taller (RF16): la fila abre el formulario de edición. */
@Component({
  selector: 'hk-servicios-page',
  imports: [
    TranslocoPipe,
    CopPipe,
    HkBadge,
    HkButton,
    HkIconButton,
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
      [titulo]="'servicios.titulo' | transloco"
      [subtitulo]="'servicios.subtitulo' | transloco"
    >
      <button hk-button icono="plus" hkAccionPrincipal (click)="abrir()">
        {{ 'servicios.nuevo' | transloco }}
      </button>
    </hk-page-header>

    <hk-card>
      <hk-filter-bar
        [placeholder]="'servicios.buscar' | transloco"
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
        @if (servicios.error()) {
          <hk-empty-state
            icono="circle-alert"
            [titulo]="'servicios.error_titulo' | transloco"
            [texto]="'comun.error_texto' | transloco"
          >
            <button hk-button variante="secondary" icono="rotate-ccw" (click)="servicios.reload()">
              {{ 'comun.reintentar' | transloco }}
            </button>
          </hk-empty-state>
        } @else {
          <hk-table
            [columnas]="columnas()"
            [filas]="servicios.value()?.content ?? []"
            [cargando]="servicios.isLoading()"
            [etiqueta]="'servicios.titulo' | transloco"
            [orden]="orden()"
            (ordenChange)="ordenar($event)"
            [pagina]="filtros().page"
            [tamano]="tamanoPagina"
            [total]="servicios.value()?.totalElements"
            (paginaCambio)="filtrar({ page: $event }, false)"
            filasClicables
            (filaClic)="abrir($event)"
            vacioIcono="clipboard-list"
            [vacioTitulo]="'servicios.vacio_titulo' | transloco"
            [vacioTexto]="'servicios.vacio_texto' | transloco"
          >
            <ng-template hkCelda="nombre" let-s>
              <p class="font-medium text-fg">{{ s.nombre }}</p>
              @if (s.descripcion) {
                <p class="line-clamp-1 text-xs text-muted">{{ s.descripcion }}</p>
              }
            </ng-template>
            <ng-template hkCelda="precioBase" let-s>
              <span class="tabular">{{ s.precioBase | cop }}</span>
            </ng-template>
            <ng-template hkCelda="tiempoEstimadoMin" let-s>
              <span class="tabular">{{
                'servicios.minutos' | transloco: { minutos: s.tiempoEstimadoMin }
              }}</span>
            </ng-template>
            <ng-template hkCelda="activo" let-s>
              <hk-badge
                [tono]="s.activo ? 'success' : 'neutral'"
                [icono]="s.activo ? 'circle-check' : 'circle-x'"
              >
                {{ (s.activo ? 'comun.estado.activo' : 'comun.estado.inactivo') | transloco }}
              </hk-badge>
            </ng-template>
            <ng-template hkCelda="acciones" let-s>
              <button
                hk-icon-button
                tamano="sm"
                [icono]="s.activo ? 'circle-x' : 'circle-check'"
                [etiqueta]="(s.activo ? 'comun.desactivar' : 'comun.activar') | transloco"
                (click)="$event.stopPropagation(); cambiarEstado(s)"
              ></button>
            </ng-template>
          </hk-table>
        }
      </div>
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiciosPage {
  private readonly api = inject(ServiciosApiService);
  private readonly dialogos = inject(DialogosService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly tamanoPagina = TAMANO_PAGINA;
  protected readonly filtros = signal<FiltrosServicios>({
    q: '',
    activo: null,
    page: 0,
    size: TAMANO_PAGINA,
    sort: 'nombre,asc',
  });
  protected readonly servicios = rxResource({
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
    'servicios.campos.nombre',
    'servicios.campos.precio_base',
    'servicios.campos.tiempo',
    'comun.estado.titulo',
    'servicios.acciones',
  ]);
  private readonly textosEstado = translateSignal(ESTADOS.map((e) => `comun.filtros.${e}`));
  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [nombre, precio, tiempo, estado, acciones] = this.textos();
    return [
      { clave: 'nombre', etiqueta: nombre, ordenable: true, principal: true },
      { clave: 'precioBase', etiqueta: precio, ordenable: true, numerica: true },
      { clave: 'tiempoEstimadoMin', etiqueta: tiempo, ordenable: true, numerica: true },
      { clave: 'activo', etiqueta: estado },
      { clave: 'acciones', etiqueta: acciones, alinear: 'fin' },
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

  protected filtrar(cambio: Partial<FiltrosServicios>, reiniciarPagina = true): void {
    this.filtros.update((f) => ({ ...f, ...(reiniciarPagina ? { page: 0 } : {}), ...cambio }));
  }

  protected ordenar(orden: OrdenTabla | null): void {
    this.filtrar({ sort: orden ? `${orden.columna},${orden.direccion}` : null });
  }

  protected abrir(servicio?: Servicio): void {
    this.dialogos
      .abrirDrawer<ServicioFormDrawer, DatosFormServicio, Servicio>(ServicioFormDrawer, {
        datos: { servicio },
      })
      .closed.subscribe((guardado) => {
        if (!guardado) return;
        this.toast.exito(
          this.transloco.translate(servicio ? 'servicios.actualizado' : 'servicios.creado', {
            nombre: guardado.nombre,
          }),
        );
        this.servicios.reload();
      });
  }

  protected async cambiarEstado(servicio: Servicio): Promise<void> {
    const clave = servicio.activo ? 'confirmar_desactivar' : 'confirmar_activar';
    const confirmado = await this.confirmacion.pedir({
      titulo: this.transloco.translate(`servicios.${clave}.titulo`),
      mensaje: this.transloco.translate(`servicios.${clave}.mensaje`, { nombre: servicio.nombre }),
      textoConfirmar: this.transloco.translate(
        servicio.activo ? 'comun.desactivar' : 'comun.activar',
      ),
      peligrosa: servicio.activo,
    });
    if (!confirmado) return;
    this.api.cambiarEstado(servicio.id, !servicio.activo).subscribe((actualizado) => {
      this.toast.exito(
        this.transloco.translate(
          actualizado.activo ? 'servicios.activado' : 'servicios.desactivado',
          {
            nombre: actualizado.nombre,
          },
        ),
      );
      this.servicios.reload();
    });
  }
}
