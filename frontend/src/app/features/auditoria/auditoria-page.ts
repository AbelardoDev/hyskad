import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  numberAttribute,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';

import { erroresManejados } from '../../core/http/contexto-http';
import { FechaPipe } from '../../core/utils/formato.pipes';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkDateInput } from '../../shared/ui/forms/date-input';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { ColumnaTabla, HkCelda, HkTable } from '../../shared/ui/table/table';
import { UsuariosApiService } from '../usuarios/usuarios-api.service';
import {
  AuditoriaApiService,
  ENTIDADES_AUDITADAS,
  FiltrosAuditoria,
  RegistroAuditoria,
} from './auditoria-api.service';
import { DetalleAuditoriaDrawer } from './detalle-auditoria-drawer';

const TAMANO = 20;
const ESPERA_BUSQUEDA_MS = 300;

/**
 * Auditoría (RF31, solo con `AUDITORIA_VER`): registros con filtros por usuario, entidad, acción y
 * fechas, y el detalle en un panel lateral. `?entidad=venta&entidadId=5` muestra la historia de un
 * registro (lo usan los detalles de orden, venta y usuario).
 */
@Component({
  selector: 'hk-auditoria-page',
  imports: [
    TranslocoPipe,
    FechaPipe,
    HkButton,
    HkCard,
    HkDateInput,
    HkEmptyState,
    HkFormField,
    HkInput,
    HkSelect,
    HkPageHeader,
    HkTable,
    HkCelda,
  ],
  template: `
    <hk-page-header
      [titulo]="'auditoria.titulo' | transloco"
      [subtitulo]="'auditoria.subtitulo' | transloco"
    />

    <hk-card>
      @if (filtros().entidadId !== null) {
        <div
          class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary-ink"
          role="status"
        >
          <span>
            {{
              'auditoria.de_registro'
                | transloco
                  : {
                      entidad: ('auditoria.entidades.' + filtros().entidad | transloco),
                      id: filtros().entidadId,
                    }
            }}
          </span>
          <button hk-button variante="secondary" tamano="sm" icono="circle-x" (click)="verTodo()">
            {{ 'auditoria.ver_todo' | transloco }}
          </button>
        </div>
      } @else {
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <hk-form-field [etiqueta]="'auditoria.campos.usuario' | transloco">
            <hk-select
              [opciones]="opcionesUsuario()"
              [placeholder]="'auditoria.todos_usuarios' | transloco"
              [valor]="filtros().usuarioId?.toString() ?? null"
              (valorChange)="filtrar({ usuarioId: aNumero($event) })"
            />
          </hk-form-field>
          <hk-form-field [etiqueta]="'auditoria.campos.entidad' | transloco">
            <hk-select
              [opciones]="opcionesEntidad()"
              [placeholder]="'auditoria.todas_entidades' | transloco"
              [valor]="filtros().entidad"
              (valorChange)="filtrar({ entidad: $event })"
            />
          </hk-form-field>
          <hk-form-field [etiqueta]="'auditoria.campos.accion' | transloco">
            <hk-input
              tipo="search"
              icono="search"
              placeholder="VENTA_ANULADA"
              [valor]="filtros().accion"
              (valorChange)="buscarAccion($event)"
            />
          </hk-form-field>
          <hk-form-field [etiqueta]="'inventario.movimientos.desde' | transloco">
            <hk-date-input
              [valor]="filtros().desde"
              (valorChange)="filtrar({ desde: $event || null })"
            />
          </hk-form-field>
          <hk-form-field [etiqueta]="'inventario.movimientos.hasta' | transloco">
            <hk-date-input
              [valor]="filtros().hasta"
              (valorChange)="filtrar({ hasta: $event || null })"
            />
          </hk-form-field>
        </div>
      }

      <div class="mt-5">
        @if (registros.error()) {
          <hk-empty-state
            icono="circle-alert"
            [titulo]="'auditoria.error' | transloco"
            [texto]="'comun.error_texto' | transloco"
          >
            <button hk-button variante="secondary" icono="rotate-ccw" (click)="registros.reload()">
              {{ 'comun.reintentar' | transloco }}
            </button>
          </hk-empty-state>
        } @else {
          <hk-table
            [columnas]="columnas()"
            [filas]="registros.value()?.content ?? []"
            [cargando]="registros.isLoading()"
            [etiqueta]="'auditoria.titulo' | transloco"
            [pagina]="filtros().page"
            [tamano]="tamano"
            [total]="registros.value()?.totalElements"
            (paginaCambio)="filtrar({ page: $event }, false)"
            filasClicables
            (filaClic)="verDetalle($event)"
            vacioIcono="clipboard-list"
            [vacioTitulo]="'auditoria.vacio_titulo' | transloco"
            [vacioTexto]="'auditoria.vacio_texto' | transloco"
          >
            <ng-template hkCelda="fecha" let-r>{{ r.fecha | fecha: 'fechaHora' }}</ng-template>
            <ng-template hkCelda="usuario" let-r>{{
              r.usuario?.nombre ?? ('auditoria.sistema' | transloco)
            }}</ng-template>
            <ng-template hkCelda="accion" let-r>
              <span class="font-mono text-xs font-medium text-fg">{{ r.accion }}</span>
            </ng-template>
            <ng-template hkCelda="entidad" let-r>
              {{ 'auditoria.entidades.' + r.entidad | transloco }}
              @if (r.entidadId !== null) {
                <span class="text-muted tabular">#{{ r.entidadId }}</span>
              }
            </ng-template>
            <ng-template hkCelda="ip" let-r
              ><span class="tabular">{{ r.ip ?? '—' }}</span></ng-template
            >
          </hk-table>
        }
      </div>
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditoriaPage {
  private readonly api = inject(AuditoriaApiService);
  private readonly usuariosApi = inject(UsuariosApiService);
  private readonly dialogos = inject(DialogosService);
  private readonly router = inject(Router);

  /** `?entidad=` y `?entidadId=` desde la URL. */
  readonly entidad = input<string>();
  readonly entidadId = input<number | undefined, unknown>(undefined, {
    transform: (v: unknown) =>
      v === undefined || v === null || v === '' ? undefined : numberAttribute(v),
  });

  protected readonly tamano = TAMANO;
  protected readonly filtros = linkedSignal<FiltrosAuditoria>(() => ({
    usuarioId: null,
    entidad: this.entidad() ?? null,
    entidadId: this.entidad() ? (this.entidadId() ?? null) : null,
    accion: '',
    desde: null,
    hasta: null,
    page: 0,
    size: TAMANO,
  }));
  protected readonly registros = rxResource({
    params: () => this.filtros(),
    stream: ({ params }) => this.api.buscar(params, erroresManejados()),
  });
  private readonly usuarios = rxResource({
    stream: () =>
      this.usuariosApi.listar(
        { q: '', rol: null, activo: null, page: 0, size: 200, sort: 'nombre,asc' },
        erroresManejados(),
      ),
  });

  private readonly textos = translateSignal([
    'auditoria.campos.fecha',
    'auditoria.campos.usuario',
    'auditoria.campos.accion',
    'auditoria.campos.entidad',
    'auditoria.campos.ip',
  ]);
  private readonly textosEntidad = translateSignal(
    ENTIDADES_AUDITADAS.map((e) => `auditoria.entidades.${e}`),
  );
  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [fecha, usuario, accion, entidad, ip] = this.textos();
    return [
      { clave: 'accion', etiqueta: accion, principal: true },
      { clave: 'fecha', etiqueta: fecha },
      { clave: 'usuario', etiqueta: usuario },
      { clave: 'entidad', etiqueta: entidad },
      { clave: 'ip', etiqueta: ip, ocultarEnMovil: true },
    ];
  });
  protected readonly opcionesEntidad = computed<OpcionSelect[]>(() =>
    ENTIDADES_AUDITADAS.map((valor, i) => ({ valor, etiqueta: this.textosEntidad()[i] })),
  );
  protected readonly opcionesUsuario = computed<OpcionSelect[]>(() =>
    (this.usuarios.value()?.content ?? []).map((u) => ({
      valor: String(u.id),
      etiqueta: u.nombre,
    })),
  );

  private temporizador: ReturnType<typeof setTimeout> | undefined;

  protected aNumero(valor: string | null): number | null {
    return valor ? Number(valor) : null;
  }

  protected filtrar(cambio: Partial<FiltrosAuditoria>, reiniciarPagina = true): void {
    this.filtros.update((f) => ({ ...f, ...(reiniciarPagina ? { page: 0 } : {}), ...cambio }));
  }

  protected buscarAccion(texto: string | null): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(
      () => this.filtrar({ accion: (texto ?? '').trim() }),
      ESPERA_BUSQUEDA_MS,
    );
  }

  protected verTodo(): void {
    void this.router.navigate(['/auditoria']);
  }

  protected verDetalle(registro: RegistroAuditoria): void {
    this.dialogos.abrirDrawer<DetalleAuditoriaDrawer, RegistroAuditoria>(DetalleAuditoriaDrawer, {
      datos: registro,
    });
  }
}
