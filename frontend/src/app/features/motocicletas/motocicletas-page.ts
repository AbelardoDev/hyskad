import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { HkTienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import { erroresManejados } from '../../core/http/contexto-http';
import { normalizarPlaca } from '../../core/utils/validadores';
import { HkBadge } from '../../shared/ui/badge/badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { FiltroActivo, HkFilterBar } from '../../shared/ui/filter-bar/filter-bar';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkPlaca } from '../../shared/ui/placa/placa';
import { ColumnaTabla, HkCelda, HkTable, OrdenTabla } from '../../shared/ui/table/table';
import { ToastService } from '../../shared/ui/toast/toast';
import {
  FiltrosMotocicletas,
  Motocicleta,
  MotocicletasApiService,
} from './motocicletas-api.service';
import { DatosFormMoto, MotoFormDrawer } from './moto-form-drawer';

const TAMANO_PAGINA = 20;
const ESTADOS = ['activos', 'inactivos'] as const;

/** Lista de motos (RF7, RF29): búsqueda por placa parcial normalizada y filtro de estado. */
@Component({
  selector: 'hk-motocicletas-page',
  imports: [
    TranslocoPipe,
    HkTienePermisoDirective,
    HkBadge,
    HkButton,
    HkCard,
    HkEmptyState,
    HkFilterBar,
    HkSelect,
    HkPageHeader,
    HkPlaca,
    HkTable,
    HkCelda,
  ],
  template: `
    <hk-page-header
      [titulo]="'motos.titulo' | transloco"
      [subtitulo]="'motos.subtitulo' | transloco"
    >
      <button
        *hkTienePermiso="'MOTOS_GESTIONAR'"
        hk-button
        icono="plus"
        hkAccionPrincipal
        (click)="abrirFormulario()"
      >
        {{ 'motos.nueva' | transloco }}
      </button>
    </hk-page-header>

    <hk-card>
      <hk-filter-bar
        [placeholder]="'motos.buscar' | transloco"
        [busqueda]="textoPlaca()"
        (busquedaChange)="textoPlaca.set(normalizar($event))"
        [filtros]="filtrosActivos()"
        (busquedaCambio)="filtrar({ placa: normalizar($event) })"
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
        @if (motos.error()) {
          <hk-empty-state
            icono="circle-alert"
            [titulo]="'motos.error_titulo' | transloco"
            [texto]="'comun.error_texto' | transloco"
          >
            <button hk-button variante="secondary" icono="rotate-ccw" (click)="motos.reload()">
              {{ 'comun.reintentar' | transloco }}
            </button>
          </hk-empty-state>
        } @else {
          <hk-table
            [columnas]="columnas()"
            [filas]="motos.value()?.content ?? []"
            [cargando]="motos.isLoading()"
            [etiqueta]="'motos.titulo' | transloco"
            [orden]="orden()"
            (ordenChange)="ordenar($event)"
            [pagina]="filtros().page"
            [tamano]="tamanoPagina"
            [total]="motos.value()?.totalElements"
            (paginaCambio)="filtrar({ page: $event }, false)"
            filasClicables
            (filaClic)="verDetalle($event)"
            vacioIcono="bike"
            [vacioTitulo]="'motos.vacio_titulo' | transloco"
            [vacioTexto]="'motos.vacio_texto' | transloco"
          >
            <ng-template hkCelda="placa" let-m>
              <hk-placa [placa]="m.placa" />
            </ng-template>
            <ng-template hkCelda="marca" let-m>
              <p class="font-medium text-fg">{{ m.marca }} {{ m.modelo }}</p>
              @if (m.anio || m.cilindradaCc) {
                <p class="text-xs text-muted">
                  {{ m.anio }}{{ m.anio && m.cilindradaCc ? ' · ' : ''
                  }}{{ m.cilindradaCc ? m.cilindradaCc + ' cc' : '' }}
                </p>
              }
            </ng-template>
            <ng-template hkCelda="propietario" let-m>
              <span class="text-fg">{{ m.propietario.nombreCompleto }}</span>
            </ng-template>
            <ng-template hkCelda="activo" let-m>
              <hk-badge
                [tono]="m.activo ? 'success' : 'neutral'"
                [icono]="m.activo ? 'circle-check' : 'circle-x'"
              >
                {{ (m.activo ? 'comun.estado.activa' : 'comun.estado.inactiva') | transloco }}
              </hk-badge>
            </ng-template>
          </hk-table>
        }
      </div>
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotocicletasPage {
  private readonly api = inject(MotocicletasApiService);
  private readonly router = inject(Router);
  private readonly dialogos = inject(DialogosService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly tamanoPagina = TAMANO_PAGINA;
  /** Lo que se ve en el buscador, ya normalizado mientras se escribe (RN-41). */
  protected readonly textoPlaca = signal('');
  protected readonly filtros = signal<FiltrosMotocicletas>({
    placa: '',
    marca: '',
    activo: null,
    page: 0,
    size: TAMANO_PAGINA,
    sort: 'placa,asc',
  });

  protected readonly motos = rxResource({
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
    'motos.campos.placa',
    'motos.campos.moto',
    'motos.campos.propietario',
    'comun.estado.titulo',
  ]);
  private readonly textosEstado = translateSignal(ESTADOS.map((e) => `comun.filtros.${e}_f`));

  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [placa, moto, propietario, estado] = this.textos();
    return [
      { clave: 'placa', etiqueta: placa, ordenable: true, principal: true },
      { clave: 'marca', etiqueta: moto, ordenable: true },
      { clave: 'propietario', etiqueta: propietario },
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

  protected normalizar(texto: string | null): string {
    return normalizarPlaca(texto ?? '');
  }

  protected aActivo(valor: string | null): boolean | null {
    return valor === 'activos' ? true : valor === 'inactivos' ? false : null;
  }

  protected filtrar(cambio: Partial<FiltrosMotocicletas>, reiniciarPagina = true): void {
    this.filtros.update((f) => ({ ...f, ...(reiniciarPagina ? { page: 0 } : {}), ...cambio }));
  }

  protected ordenar(orden: OrdenTabla | null): void {
    this.filtrar({ sort: orden ? `${orden.columna},${orden.direccion}` : null });
  }

  protected verDetalle(moto: Motocicleta): void {
    void this.router.navigate(['/motocicletas', moto.id]);
  }

  protected abrirFormulario(): void {
    this.dialogos
      .abrirDrawer<MotoFormDrawer, DatosFormMoto, Motocicleta>(MotoFormDrawer, { datos: {} })
      .closed.subscribe((guardada) => {
        if (!guardada) return;
        this.toast.exito(this.transloco.translate('motos.creada', { placa: guardada.placa }));
        void this.router.navigate(['/motocicletas', guardada.id]);
      });
  }
}
