import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize, Observable } from 'rxjs';

import { conFormulario, marcarErroresServidor } from '../../core/http/contexto-http';
import { codigoDeError } from '../../core/http/error.interceptor';
import { HkButton } from '../../shared/ui/button/button';
import { HkDrawer } from '../../shared/ui/dialog/drawer';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkMoneyInput } from '../../shared/ui/forms/money-input';
import { HkTextarea } from '../../shared/ui/forms/textarea';
import { DatosServicio, MAX_MINUTOS, Servicio, ServiciosApiService } from './servicios-api.service';

export interface DatosFormServicio {
  /** Si viene, se edita; si no, se crea. */
  servicio?: Servicio;
}

/** Crear o editar un servicio del catálogo (RF16): nombre único, precio y tiempo positivos. */
@Component({
  selector: 'hk-servicio-form-drawer',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HkButton,
    HkDrawer,
    HkFormField,
    HkInput,
    HkMoneyInput,
    HkTextarea,
  ],
  template: `
    <hk-drawer
      [titulo]="
        (servicio ? 'servicios.form.titulo_editar' : 'servicios.form.titulo_nuevo') | transloco
      "
    >
      <form
        id="form-servicio"
        class="space-y-5"
        [formGroup]="form"
        (ngSubmit)="guardar()"
        novalidate
      >
        <hk-form-field [etiqueta]="'servicios.campos.nombre' | transloco">
          <hk-input formControlName="nombre" autocompletar="off" [maxCaracteres]="120" />
        </hk-form-field>
        <div class="grid gap-5 sm:grid-cols-2">
          <hk-form-field [etiqueta]="'servicios.campos.precio_base' | transloco">
            <hk-money-input formControlName="precioBase" />
          </hk-form-field>
          <hk-form-field
            [etiqueta]="'servicios.campos.tiempo' | transloco"
            [ayuda]="'servicios.form.tiempo_ayuda' | transloco"
          >
            <hk-input
              formControlName="tiempoEstimadoMin"
              modoTeclado="numeric"
              [maxCaracteres]="5"
            />
          </hk-form-field>
        </div>
        <hk-form-field [etiqueta]="'servicios.campos.descripcion' | transloco" [opcional]="true">
          <hk-textarea formControlName="descripcion" [filas]="3" [maxCaracteres]="500" />
        </hk-form-field>
      </form>
      <div hkDrawerPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button hk-button tipo="submit" form="form-servicio" icono="check" [cargando]="guardando()">
          {{ 'comun.guardar' | transloco }}
        </button>
      </div>
    </hk-drawer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicioFormDrawer {
  private readonly api = inject(ServiciosApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly ref = inject<DialogRef<Servicio>>(DialogRef);
  protected readonly servicio = inject<DatosFormServicio | undefined>(DIALOG_DATA)?.servicio;
  protected readonly guardando = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: [this.servicio?.nombre ?? '', [Validators.required, Validators.maxLength(120)]],
    precioBase: [
      this.servicio?.precioBase ?? (null as number | null),
      [Validators.required, Validators.min(1)],
    ],
    tiempoEstimadoMin: [
      this.servicio?.tiempoEstimadoMin.toString() ?? '',
      [
        Validators.required,
        Validators.pattern(/^\d+$/),
        Validators.min(1),
        Validators.max(MAX_MINUTOS),
      ],
    ],
    descripcion: [this.servicio?.descripcion ?? '', Validators.maxLength(500)],
  });

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const v = this.form.getRawValue();
    const datos: DatosServicio = {
      nombre: v.nombre.trim(),
      descripcion: v.descripcion.trim() || null,
      precioBase: v.precioBase ?? 0,
      tiempoEstimadoMin: Number(v.tiempoEstimadoMin),
    };
    const contexto = conFormulario(this.form);
    const peticion: Observable<Servicio> = this.servicio
      ? this.api.actualizar(this.servicio.id, datos, contexto)
      : this.api.crear(datos, contexto);
    this.guardando.set(true);
    peticion.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (guardado) => this.ref.close(guardado),
      error: (e: HttpErrorResponse) => {
        if (codigoDeError(e) === 'SERVICIO_DUPLICADO')
          marcarErroresServidor(this.form, [{ campo: 'nombre', code: 'SERVICIO_DUPLICADO' }]);
        enfocarPrimerError(this.host.nativeElement, this.injector);
      },
    });
  }
}
