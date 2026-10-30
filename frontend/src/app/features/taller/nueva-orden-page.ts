import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { finalize, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { HkTienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import {
  conFormulario,
  erroresManejados,
  marcarErroresServidor,
  problemaDe,
} from '../../core/http/contexto-http';
import { codigoDeError } from '../../core/http/error.interceptor';
import { LanguageService } from '../../core/i18n/language.service';
import { formatoCantidad } from '../../core/utils/formato';
import { CantidadPipe } from '../../core/utils/formato.pipes';
import { HkStatusBadge } from '../../shared/ui/badge/status-badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkCheckbox } from '../../shared/ui/forms/checkbox';
import { HkCombobox } from '../../shared/ui/forms/combobox';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkTextarea } from '../../shared/ui/forms/textarea';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkPlaca } from '../../shared/ui/placa/placa';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { HkStepper, Paso } from '../../shared/ui/stepper/stepper';
import { ToastService } from '../../shared/ui/toast/toast';
import { buscadorClientes } from '../clientes/buscador-clientes';
import { ClienteFormDrawer, DatosFormCliente } from '../clientes/cliente-form-drawer';
import { Cliente } from '../clientes/clientes-api.service';
import { DatosFormMoto, MotoFormDrawer } from '../motocicletas/moto-form-drawer';
import { Motocicleta, MotocicletasApiService } from '../motocicletas/motocicletas-api.service';
import { MAX_KILOMETRAJE, MAX_MECANICOS, Orden, OrdenesApiService } from './ordenes-api.service';

const PASOS = ['cliente', 'moto', 'ingreso', 'mecanicos', 'confirmar'] as const;
type IdPaso = (typeof PASOS)[number];

/** RN-25: el kilometraje no puede ser menor que la última lectura registrada de la moto. */
export function noMenorQue(minimo: () => number | null): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor: unknown = control.value;
    const limite = minimo();
    if (typeof valor !== 'string' || !/^\d+$/.test(valor) || limite === null) return null;
    return Number(valor) < limite ? { kilometrajeMenor: { minimo: limite } } : null;
  };
}

/**
 * Recepción de una moto (RF10, RN-24, RN-25) en cinco pasos: cliente (o alta rápida), moto (o
 * registro) con su última lectura de kilometraje, datos de ingreso, mecánicos (opcional) y
 * confirmación. Si la moto ya tiene una orden activa lo advierte con un enlace a ella.
 */
@Component({
  selector: 'hk-nueva-orden-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    LucideDynamicIcon,
    CantidadPipe,
    HkTienePermisoDirective,
    HkButton,
    HkCard,
    HkCheckbox,
    HkCombobox,
    HkEmptyState,
    HkFormField,
    HkInput,
    HkPageHeader,
    HkPlaca,
    HkSkeleton,
    HkStatusBadge,
    HkStepper,
    HkTextarea,
  ],
  template: `
    <hk-page-header
      [titulo]="'taller.recepcion.titulo' | transloco"
      [subtitulo]="'taller.recepcion.subtitulo' | transloco"
    />

    <hk-card>
      <hk-stepper
        [pasos]="pasos()"
        [actual]="paso()"
        [etiqueta]="'taller.recepcion.progreso' | transloco"
      />
    </hk-card>

    <form class="mt-6" [formGroup]="form" (ngSubmit)="siguiente()" novalidate>
      <hk-card>
        <h2
          #titulo
          tabindex="-1"
          class="mb-5 font-display text-lg font-semibold text-fg outline-none"
        >
          {{ 'taller.recepcion.pasos.' + paso() | transloco }}
        </h2>

        @switch (paso()) {
          @case ('cliente') {
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
              <hk-form-field class="sm:flex-1" [etiqueta]="'taller.campos.cliente' | transloco">
                <hk-combobox
                  formControlName="clienteId"
                  [opciones]="clientes.opciones()"
                  [cargando]="clientes.cargando()"
                  [filtrarLocal]="false"
                  [placeholder]="'taller.recepcion.buscar_cliente' | transloco"
                  (busqueda)="clientes.buscar($event)"
                />
              </hk-form-field>
              <button
                *hkTienePermiso="'CLIENTES_GESTIONAR'"
                hk-button
                variante="secondary"
                icono="plus"
                class="sm:mt-6"
                (click)="nuevoCliente()"
              >
                {{ 'taller.recepcion.nuevo_cliente' | transloco }}
              </button>
            </div>
          }
          @case ('moto') {
            @if (motos.isLoading()) {
              <hk-skeleton variante="rectangulo" alto="5rem" />
            } @else {
              @if (motosActivas().length === 0) {
                <hk-empty-state
                  compacto
                  icono="bike"
                  [titulo]="'taller.recepcion.sin_motos' | transloco"
                />
              } @else {
                <fieldset>
                  <legend class="sr-only">{{ 'taller.campos.moto' | transloco }}</legend>
                  <div class="grid gap-3 sm:grid-cols-2">
                    @for (m of motosActivas(); track m.id) {
                      <label
                        class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring"
                        [class]="
                          form.controls.motocicletaId.value === m.id
                            ? 'border-primary bg-primary-soft'
                            : 'border-border hover:border-border-strong'
                        "
                      >
                        <input
                          type="radio"
                          name="moto"
                          class="sr-only"
                          [value]="m.id"
                          [checked]="form.controls.motocicletaId.value === m.id"
                          (change)="elegirMoto(m.id)"
                        />
                        <hk-placa [placa]="m.placa" />
                        <span class="min-w-0">
                          <span class="block truncate font-medium text-fg"
                            >{{ m.marca }} {{ m.modelo }}</span
                          >
                          <span class="block text-xs text-muted"
                            >{{ m.anio ?? '' }} {{ m.color ?? '' }}</span
                          >
                        </span>
                      </label>
                    }
                  </div>
                </fieldset>
              }
              <button
                *hkTienePermiso="'MOTOS_GESTIONAR'"
                hk-button
                variante="secondary"
                icono="plus"
                class="mt-4"
                (click)="nuevaMoto()"
              >
                {{ 'taller.recepcion.nueva_moto' | transloco }}
              </button>

              @if (info.value(); as i) {
                @if (i.ordenActiva; as activa) {
                  <div
                    class="mt-5 flex gap-3 rounded-lg border border-warning bg-warning-soft p-4 text-sm text-warning-ink"
                    role="alert"
                  >
                    <svg
                      lucideIcon="triangle-alert"
                      class="mt-0.5 size-5 shrink-0"
                      aria-hidden="true"
                    />
                    <div class="min-w-0 flex-1 space-y-3">
                      <p>
                        {{ 'taller.recepcion.orden_activa' | transloco: { numero: activa.numero } }}
                      </p>
                      <div class="flex flex-wrap items-center gap-3">
                        <hk-status-badge [estado]="activa.estado" />
                        <a
                          hk-button
                          variante="secondary"
                          tamano="sm"
                          [routerLink]="['/ordenes', activa.id]"
                        >
                          {{ 'taller.recepcion.ver_orden' | transloco }}
                        </a>
                      </div>
                    </div>
                  </div>
                } @else {
                  <p class="mt-5 flex items-center gap-2 text-sm text-muted">
                    <svg lucideIcon="info" class="size-4" aria-hidden="true" />
                    @if (i.ultimoKilometraje !== null) {
                      {{
                        'taller.recepcion.ultimo_km'
                          | transloco: { km: (i.ultimoKilometraje | cantidad) }
                      }}
                    } @else {
                      {{ 'taller.recepcion.sin_km' | transloco }}
                    }
                  </p>
                }
              }
              @if (errorMoto()) {
                <p class="mt-3 text-xs font-medium text-danger" role="alert">
                  {{ 'taller.recepcion.elige_moto' | transloco }}
                </p>
              }
            }
          }
          @case ('ingreso') {
            <div class="space-y-5">
              <hk-form-field
                class="sm:max-w-xs"
                [etiqueta]="'taller.campos.kilometraje' | transloco"
                [ayuda]="ayudaKilometraje()"
              >
                <hk-input
                  formControlName="kilometrajeIngreso"
                  modoTeclado="numeric"
                  [maxCaracteres]="7"
                />
              </hk-form-field>
              <hk-form-field [etiqueta]="'taller.campos.motivo' | transloco">
                <hk-input
                  formControlName="motivoIngreso"
                  autocompletar="off"
                  [maxCaracteres]="200"
                />
              </hk-form-field>
              <hk-form-field [etiqueta]="'taller.campos.descripcion_problema' | transloco">
                <hk-textarea
                  formControlName="descripcionProblema"
                  [filas]="4"
                  [maxCaracteres]="2000"
                />
              </hk-form-field>
              <hk-form-field
                [etiqueta]="'taller.campos.observaciones' | transloco"
                [opcional]="true"
              >
                <hk-textarea
                  formControlName="observaciones"
                  [filas]="3"
                  [maxCaracteres]="2000"
                  [placeholder]="'taller.recepcion.observaciones_ayuda' | transloco"
                />
              </hk-form-field>
            </div>
          }
          @case ('mecanicos') {
            @if (!puedeAsignar()) {
              <p class="text-sm text-muted">
                {{ 'taller.recepcion.sin_permiso_asignar' | transloco }}
              </p>
            } @else if (mecanicos.isLoading()) {
              <hk-skeleton variante="rectangulo" alto="5rem" />
            } @else if ((mecanicos.value() ?? []).length === 0) {
              <p class="text-sm text-muted">
                {{ 'taller.mecanicos.ninguno_disponible' | transloco }}
              </p>
            } @else {
              <p class="mb-4 text-sm text-muted">
                {{ 'taller.recepcion.mecanicos_ayuda' | transloco }}
              </p>
              <ul class="space-y-3">
                @for (m of mecanicos.value(); track m.id) {
                  <li class="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <hk-checkbox
                      class="sm:w-56"
                      [valor]="asignados().has(m.id)"
                      [deshabilitado]="!asignados().has(m.id) && asignados().size >= maxMecanicos"
                      (valorChange)="alternarMecanico(m.id, $event)"
                    >
                      {{ m.nombre }}
                    </hk-checkbox>
                    @if (asignados().has(m.id)) {
                      <hk-input
                        class="sm:flex-1"
                        [placeholder]="'taller.mecanicos.actividad_placeholder' | transloco"
                        [etiquetaAccesible]="
                          'taller.mecanicos.actividad_de' | transloco: { nombre: m.nombre }
                        "
                        [maxCaracteres]="200"
                        [valor]="asignados().get(m.id) ?? ''"
                        (valorChange)="cambiarActividad(m.id, $event)"
                      />
                    }
                  </li>
                }
              </ul>
            }
          }
          @case ('confirmar') {
            <dl class="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt class="text-muted">{{ 'taller.campos.cliente' | transloco }}</dt>
                <dd class="font-medium text-fg">{{ nombreCliente() }}</dd>
              </div>
              <div>
                <dt class="text-muted">{{ 'taller.campos.moto' | transloco }}</dt>
                <dd class="flex items-center gap-2 font-medium text-fg">
                  @if (motoElegida(); as m) {
                    <hk-placa tamano="sm" [placa]="m.placa" /> {{ m.marca }} {{ m.modelo }}
                  }
                </dd>
              </div>
              <div>
                <dt class="text-muted">{{ 'taller.campos.kilometraje' | transloco }}</dt>
                <dd class="font-medium text-fg tabular">
                  {{ kilometrajeElegido() | cantidad }} km
                </dd>
              </div>
              <div>
                <dt class="text-muted">{{ 'taller.campos.motivo' | transloco }}</dt>
                <dd class="font-medium text-fg">{{ form.controls.motivoIngreso.value }}</dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="text-muted">{{ 'taller.campos.descripcion_problema' | transloco }}</dt>
                <dd class="whitespace-pre-line text-fg">
                  {{ form.controls.descripcionProblema.value }}
                </dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="text-muted">{{ 'taller.campos.mecanicos' | transloco }}</dt>
                <dd class="text-fg">
                  {{ nombresAsignados() || ('taller.mecanicos.sin_asignar' | transloco) }}
                </dd>
              </div>
            </dl>
          }
        }

        <div class="mt-8 flex flex-wrap justify-between gap-3 border-t border-border pt-5">
          <button
            hk-button
            variante="secondary"
            icono="chevron-left"
            [deshabilitado]="indice() === 0"
            (click)="anterior()"
          >
            {{ 'taller.recepcion.anterior' | transloco }}
          </button>
          @if (paso() === 'confirmar') {
            <button hk-button tipo="submit" icono="check" [cargando]="guardando()">
              {{ 'taller.recepcion.recibir' | transloco }}
            </button>
          } @else {
            <button hk-button tipo="submit" iconoFinal="chevron-right">
              {{ 'taller.recepcion.siguiente' | transloco }}
            </button>
          }
        </div>
      </hk-card>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NuevaOrdenPage {
  private readonly api = inject(OrdenesApiService);
  private readonly motosApi = inject(MotocicletasApiService);
  private readonly auth = inject(AuthService);
  private readonly dialogos = inject(DialogosService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly idioma = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly titulo = viewChild.required<ElementRef<HTMLElement>>('titulo');

  protected readonly maxMecanicos = MAX_MECANICOS;
  protected readonly clientes = buscadorClientes();
  protected readonly indice = signal(0);
  protected readonly paso = computed<IdPaso>(() => PASOS[this.indice()]);
  protected readonly guardando = signal(false);
  protected readonly errorMoto = signal(false);
  /** Mecánico elegido → actividad. */
  protected readonly asignados = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly puedeAsignar = computed(() => this.auth.tienePermiso('ORDENES_ASIGNAR'));

  protected readonly form = inject(NonNullableFormBuilder).group({
    clienteId: ['', Validators.required],
    motocicletaId: [null as number | null, Validators.required],
    kilometrajeIngreso: [
      '',
      [Validators.required, Validators.pattern(/^\d+$/), Validators.max(MAX_KILOMETRAJE)],
    ],
    motivoIngreso: ['', [Validators.required, Validators.maxLength(200)]],
    descripcionProblema: ['', [Validators.required, Validators.maxLength(2000)]],
    observaciones: ['', Validators.maxLength(2000)],
  });

  private readonly clienteId = toSignal(this.form.controls.clienteId.valueChanges, {
    initialValue: '',
  });
  private readonly motoId = toSignal(this.form.controls.motocicletaId.valueChanges, {
    initialValue: null,
  });
  private readonly nuevaMotoRegistrada = signal(0);

  protected readonly motos = rxResource({
    params: () => ({ cliente: this.clienteId(), recarga: this.nuevaMotoRegistrada() }),
    stream: ({ params }) =>
      params.cliente
        ? this.motosApi.delCliente(Number(params.cliente), erroresManejados())
        : of([]),
  });
  protected readonly motosActivas = computed(() =>
    (this.motos.value() ?? []).filter((m) => m.activo),
  );
  protected readonly motoElegida = computed<Motocicleta | undefined>(() =>
    this.motosActivas().find((m) => m.id === this.motoId()),
  );
  protected readonly info = rxResource({
    params: () => this.motoId(),
    stream: ({ params }) =>
      params === null ? of(undefined) : this.api.recepcion(params, erroresManejados()),
  });
  protected readonly mecanicos = rxResource({
    stream: () => (this.puedeAsignar() ? this.api.mecanicos(erroresManejados()) : of([])),
  });

  /** Cambia al cargar las traducciones o el idioma: los `computed` que traducen la leen. */
  private readonly traducciones = toSignal(this.transloco.selectTranslation());
  protected readonly pasos = computed<Paso[]>(() => {
    this.traducciones();
    return PASOS.map((id) => ({
      id,
      etiqueta: this.transloco.translate(`taller.recepcion.pasos.${id}`),
    }));
  });
  protected readonly ayudaKilometraje = computed(() => {
    this.traducciones();
    const ultimo = this.info.value()?.ultimoKilometraje;
    return ultimo === null || ultimo === undefined
      ? this.transloco.translate('taller.recepcion.sin_km')
      : this.transloco.translate('taller.recepcion.ultimo_km', {
          km: formatoCantidad(ultimo, this.idioma.locale()),
        });
  });
  private readonly kilometrajeTexto = toSignal(this.form.controls.kilometrajeIngreso.valueChanges, {
    initialValue: '',
  });
  protected readonly kilometrajeElegido = computed(() => Number(this.kilometrajeTexto()));
  protected readonly nombreCliente = computed(() => {
    this.clienteId();
    return this.clientes.opciones().find((o) => o.valor === this.form.controls.clienteId.value)
      ?.etiqueta;
  });
  protected readonly nombresAsignados = computed(() =>
    (this.mecanicos.value() ?? [])
      .filter((m) => this.asignados().has(m.id))
      .map((m) => m.nombre)
      .join(', '),
  );

  constructor() {
    this.form.controls.kilometrajeIngreso.addValidators(
      noMenorQue(() => this.info.value()?.ultimoKilometraje ?? null),
    );
    // Otra persona, otras motos: la elegida deja de valer
    this.form.controls.clienteId.valueChanges.subscribe(() =>
      this.form.controls.motocicletaId.setValue(null),
    );
  }

  protected elegirMoto(id: number): void {
    this.errorMoto.set(false);
    this.form.controls.motocicletaId.setValue(id);
  }

  protected alternarMecanico(id: number, elegido: boolean): void {
    this.asignados.update((actual) => {
      const nuevo = new Map(actual);
      if (elegido) nuevo.set(id, '');
      else nuevo.delete(id);
      return nuevo;
    });
  }

  protected cambiarActividad(id: number, actividad: string | null): void {
    this.asignados.update((actual) => new Map(actual).set(id, actividad ?? ''));
  }

  protected anterior(): void {
    this.irA(Math.max(0, this.indice() - 1));
  }

  protected siguiente(): void {
    if (!this.pasoValido()) return;
    if (this.paso() === 'confirmar') {
      this.guardar();
      return;
    }
    this.irA(this.indice() + 1);
  }

  private pasoValido(): boolean {
    const c = this.form.controls;
    switch (this.paso()) {
      case 'cliente':
        return this.exigir([c.clienteId]);
      case 'moto': {
        const lista = this.info.value() !== undefined && !this.info.value()?.ordenActiva;
        this.errorMoto.set(c.motocicletaId.value === null);
        return c.motocicletaId.value !== null && lista;
      }
      case 'ingreso':
        c.kilometrajeIngreso.updateValueAndValidity();
        return this.exigir([
          c.kilometrajeIngreso,
          c.motivoIngreso,
          c.descripcionProblema,
          c.observaciones,
        ]);
      default:
        return true;
    }
  }

  private exigir(controles: AbstractControl[]): boolean {
    if (controles.every((control) => control.valid)) return true;
    controles.forEach((control) => control.markAsTouched());
    enfocarPrimerError(this.host.nativeElement, this.injector);
    return false;
  }

  private irA(indice: number): void {
    this.indice.set(indice);
    // El foco va al título del paso para que el lector de pantalla lo anuncie
    setTimeout(() => this.titulo().nativeElement.focus());
  }

  protected nuevoCliente(): void {
    this.dialogos
      .abrirDrawer<ClienteFormDrawer, DatosFormCliente, Cliente>(ClienteFormDrawer, {
        datos: {},
        tamano: 'lg',
      })
      .closed.subscribe((cliente) => {
        if (!cliente) return;
        this.clientes.incluir(cliente);
        this.form.controls.clienteId.setValue(String(cliente.id));
      });
  }

  protected nuevaMoto(): void {
    const id = Number(this.form.controls.clienteId.value);
    this.dialogos
      .abrirDrawer<MotoFormDrawer, DatosFormMoto, Motocicleta>(MotoFormDrawer, {
        datos: { cliente: { id, nombreCompleto: this.nombreCliente() ?? '' } },
      })
      .closed.subscribe((moto) => {
        if (!moto) return;
        this.nuevaMotoRegistrada.update((n) => n + 1);
        this.elegirMoto(moto.id);
      });
  }

  private guardar(): void {
    if (this.guardando()) return;
    const v = this.form.getRawValue();
    if (v.motocicletaId === null) return;
    this.guardando.set(true);
    this.api
      .crear(
        {
          clienteId: Number(v.clienteId),
          motocicletaId: v.motocicletaId,
          kilometrajeIngreso: Number(v.kilometrajeIngreso),
          motivoIngreso: v.motivoIngreso.trim(),
          descripcionProblema: v.descripcionProblema.trim(),
          observaciones: v.observaciones.trim() || null,
          mecanicos: [...this.asignados()].map(([mecanicoId, actividad]) => ({
            mecanicoId,
            actividad: actividad.trim() || null,
          })),
        },
        conFormulario(this.form),
      )
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (orden: Orden) => {
          this.toast.exito(
            this.transloco.translate('taller.recepcion.creada', { numero: orden.numero }),
          );
          void this.router.navigate(['/ordenes', orden.id]);
        },
        error: (e: HttpErrorResponse) => this.alFallar(e),
      });
  }

  /** Vuelve al paso donde está el problema para que se pueda corregir. */
  private alFallar(e: HttpErrorResponse): void {
    const codigo = codigoDeError(e);
    if (
      codigo === 'MOTO_CON_ORDEN_ACTIVA' ||
      codigo === 'MOTO_INACTIVA' ||
      codigo === 'MOTO_NO_PERTENECE_CLIENTE'
    ) {
      this.info.reload();
      this.irA(PASOS.indexOf('moto'));
      return;
    }
    const errores = problemaDe(e.error)?.errors ?? [];
    if (errores.some((error) => error.campo === 'kilometrajeIngreso')) {
      this.irA(PASOS.indexOf('ingreso'));
      marcarErroresServidor(this.form, errores);
    } else if (errores.some((error) => error.campo.startsWith('mecanicos'))) {
      this.irA(PASOS.indexOf('mecanicos'));
    }
  }
}
