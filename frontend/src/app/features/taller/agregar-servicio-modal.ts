import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize, map, switchMap, timer } from 'rxjs';

import { conFormulario, erroresManejados } from '../../core/http/contexto-http';
import { HkButton } from '../../shared/ui/button/button';
import { HkModal } from '../../shared/ui/dialog/modal';
import { HkCombobox, OpcionCombobox } from '../../shared/ui/forms/combobox';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkMoneyInput } from '../../shared/ui/forms/money-input';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { ServiciosApiService } from '../servicios/servicios-api.service';
import { Orden, OrdenesApiService } from './ordenes-api.service';

const ESPERA_MS = 250;
const RESULTADOS = 10;

type Origen = 'catalogo' | 'libre';

/**
 * Agregar un servicio a la orden (RF15, RN-30): del catálogo con su precio sugerido editable, o mano
 * de obra libre con descripción y precio. Opcionalmente, el mecánico asignado que lo hará.
 */
@Component({
  selector: 'hk-agregar-servicio-modal',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HkButton,
    HkCombobox,
    HkFormField,
    HkInput,
    HkModal,
    HkMoneyInput,
    HkSelect,
  ],
  template: `
    <hk-modal [titulo]="'taller.items.agregar_servicio' | transloco">
      <div
        class="mb-5 inline-flex w-full rounded-lg border border-border-strong p-0.5 sm:w-auto"
        role="group"
        [attr.aria-label]="'taller.items.origen' | transloco"
      >
        @for (o of origenes; track o) {
          <button
            type="button"
            class="inline-flex h-10 flex-1 items-center justify-center rounded-md px-4 text-sm font-medium hk-foco transition-colors"
            [class]="
              origen() === o ? 'bg-primary-soft text-primary-ink' : 'text-muted hover:text-fg'
            "
            [attr.aria-pressed]="origen() === o"
            (click)="cambiarOrigen(o)"
          >
            {{ 'taller.items.origenes.' + o | transloco }}
          </button>
        }
      </div>
      <form
        id="form-servicio-orden"
        class="space-y-5"
        [formGroup]="form"
        (ngSubmit)="guardar()"
        novalidate
      >
        @if (origen() === 'catalogo') {
          <hk-form-field [etiqueta]="'taller.items.servicio' | transloco">
            <hk-combobox
              formControlName="servicioId"
              [opciones]="opciones()"
              [cargando]="resultados.isLoading()"
              [filtrarLocal]="false"
              [placeholder]="'taller.items.buscar_servicio' | transloco"
              (busqueda)="texto.set($event.trim())"
            />
          </hk-form-field>
        } @else {
          <hk-form-field [etiqueta]="'taller.items.descripcion' | transloco">
            <hk-input formControlName="descripcion" autocompletar="off" [maxCaracteres]="200" />
          </hk-form-field>
        }
        <div class="grid gap-5 sm:grid-cols-2">
          <hk-form-field
            [etiqueta]="'taller.items.precio' | transloco"
            [ayuda]="
              origen() === 'catalogo' ? ('taller.items.precio_ayuda' | transloco) : undefined
            "
          >
            <hk-money-input formControlName="precio" />
          </hk-form-field>
          @if (opcionesMecanico().length > 0) {
            <hk-form-field [etiqueta]="'taller.campos.mecanico' | transloco" [opcional]="true">
              <hk-select
                formControlName="mecanicoId"
                [opciones]="opcionesMecanico()"
                [placeholder]="'taller.items.sin_mecanico' | transloco"
              />
            </hk-form-field>
          }
        </div>
      </form>
      <div hkModalPie class="contents">
        <button hk-button variante="secondary" tamano="lg" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button
          hk-button
          tipo="submit"
          tamano="lg"
          form="form-servicio-orden"
          icono="plus"
          [cargando]="guardando()"
        >
          {{ 'taller.items.agregar' | transloco }}
        </button>
      </div>
    </hk-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgregarServicioModal {
  private readonly api = inject(OrdenesApiService);
  private readonly servicios = inject(ServiciosApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly ref = inject<DialogRef<Orden>>(DialogRef);
  private readonly orden = inject<Orden>(DIALOG_DATA);

  protected readonly origenes: readonly Origen[] = ['catalogo', 'libre'];
  protected readonly origen = signal<Origen>('catalogo');
  protected readonly guardando = signal(false);
  protected readonly texto = signal('');

  protected readonly form = inject(NonNullableFormBuilder).group({
    servicioId: ['', Validators.required],
    descripcion: ['', Validators.maxLength(200)],
    precio: [null as number | null, [Validators.required, Validators.min(1)]],
    mecanicoId: [null as string | null],
  });

  protected readonly resultados = rxResource({
    params: () => this.texto(),
    stream: ({ params }) =>
      timer(params ? ESPERA_MS : 0).pipe(
        switchMap(() =>
          this.servicios.listar(
            { q: params, activo: true, page: 0, size: RESULTADOS, sort: 'nombre,asc' },
            erroresManejados(),
          ),
        ),
        map((pagina) => pagina.content),
      ),
  });
  protected readonly opciones = computed<OpcionCombobox[]>(() =>
    (this.resultados.value() ?? []).map((s) => ({ valor: String(s.id), etiqueta: s.nombre })),
  );
  protected readonly opcionesMecanico = computed<OpcionSelect[]>(() =>
    this.orden.mecanicos.map((m) => ({ valor: String(m.id), etiqueta: m.nombre })),
  );

  constructor() {
    // El precio sugerido es el del catálogo; se puede cambiar antes de agregar
    this.form.controls.servicioId.valueChanges.subscribe((id) => {
      const servicio = (this.resultados.value() ?? []).find((s) => s.id === Number(id));
      if (!servicio) return;
      this.form.controls.precio.setValue(servicio.precioBase);
    });
  }

  protected cambiarOrigen(origen: Origen): void {
    this.origen.set(origen);
    const { servicioId, descripcion } = this.form.controls;
    servicioId.setValidators(origen === 'catalogo' ? Validators.required : null);
    descripcion.setValidators(
      origen === 'libre' ? [Validators.required, Validators.maxLength(200)] : null,
    );
    servicioId.updateValueAndValidity();
    descripcion.updateValueAndValidity();
  }

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const v = this.form.getRawValue();
    const catalogo = this.origen() === 'catalogo';
    this.guardando.set(true);
    this.api
      .agregarServicio(
        this.orden,
        {
          servicioId: catalogo ? Number(v.servicioId) : null,
          descripcion: catalogo ? null : v.descripcion.trim(),
          precio: v.precio,
          tiempoMin: null,
          mecanicoId: v.mecanicoId ? Number(v.mecanicoId) : null,
        },
        conFormulario(this.form),
      )
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe((orden) => this.ref.close(orden));
  }
}
