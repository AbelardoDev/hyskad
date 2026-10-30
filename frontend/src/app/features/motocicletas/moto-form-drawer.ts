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
import { normalizarPlaca, placaColombiana, vinValido } from '../../core/utils/validadores';
import { HkButton } from '../../shared/ui/button/button';
import { HkDrawer } from '../../shared/ui/dialog/drawer';
import { HkCombobox } from '../../shared/ui/forms/combobox';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkPlaca } from '../../shared/ui/placa/placa';
import { buscadorClientes } from '../clientes/buscador-clientes';
import { FichaMotocicleta, Motocicleta, MotocicletasApiService } from './motocicletas-api.service';

export interface DatosFormMoto {
  /** Si viene, se edita su ficha (el propietario se cambia aparte). */
  moto?: Motocicleta;
  /** Al crear desde la ficha del cliente: queda preseleccionado y no se puede cambiar. */
  cliente?: { id: number; nombreCompleto: string };
}

/** Límites de la ficha, iguales a `FichaMotocicleta` del backend. */
export const ANIO_MINIMO = 1900;
export const ANIO_MAXIMO = 2100;
export const CILINDRADA_MAXIMA = 3000;

const CAMPO_DUPLICADO: Partial<Record<string, 'placa' | 'vin'>> = {
  PLACA_DUPLICADA: 'placa',
  VIN_DUPLICADO: 'vin',
};

/** Registrar o editar una moto (RF7, RF8). Cierra devolviendo la moto guardada. */
@Component({
  selector: 'hk-moto-form-drawer',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HkButton,
    HkCombobox,
    HkDrawer,
    HkFormField,
    HkInput,
    HkPlaca,
  ],
  template: `
    <hk-drawer
      [titulo]="(moto ? 'motos.form.titulo_editar' : 'motos.form.titulo_nuevo') | transloco"
    >
      <form id="form-moto" class="space-y-5" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        @if (!moto) {
          @if (clienteFijo; as fijo) {
            <div class="rounded-xl border border-border bg-surface-2/60 px-4 py-3">
              <p class="text-xs text-muted">{{ 'motos.campos.propietario' | transloco }}</p>
              <p class="font-medium text-fg">{{ fijo.nombreCompleto }}</p>
            </div>
          } @else {
            <hk-form-field
              [etiqueta]="'motos.campos.propietario' | transloco"
              [ayuda]="'motos.form.propietario_ayuda' | transloco"
            >
              <hk-combobox
                formControlName="clienteId"
                [opciones]="clientes.opciones()"
                [cargando]="clientes.cargando()"
                [filtrarLocal]="false"
                [placeholder]="'motos.form.buscar_cliente' | transloco"
                (busqueda)="clientes.buscar($event)"
              />
            </hk-form-field>
          }
        }

        <hk-form-field
          [etiqueta]="'motos.campos.placa' | transloco"
          [ayuda]="'motos.form.placa_ayuda' | transloco"
        >
          <div class="flex items-center gap-3">
            <hk-input
              class="min-w-0 flex-1"
              formControlName="placa"
              autocompletar="off"
              [maxCaracteres]="8"
            />
            @if (placaVista(); as placa) {
              <hk-placa [placa]="placa" aria-hidden="true" />
            }
          </div>
        </hk-form-field>
        <div class="grid gap-5 sm:grid-cols-2">
          <hk-form-field [etiqueta]="'motos.campos.marca' | transloco">
            <hk-input formControlName="marca" autocompletar="off" [maxCaracteres]="60" />
          </hk-form-field>
          <hk-form-field [etiqueta]="'motos.campos.modelo' | transloco">
            <hk-input formControlName="modelo" autocompletar="off" [maxCaracteres]="60" />
          </hk-form-field>
        </div>
        <div class="grid gap-5 sm:grid-cols-3">
          <hk-form-field [etiqueta]="'motos.campos.anio' | transloco" [opcional]="true">
            <hk-input formControlName="anio" modoTeclado="numeric" [maxCaracteres]="4" />
          </hk-form-field>
          <hk-form-field [etiqueta]="'motos.campos.cilindrada' | transloco" [opcional]="true">
            <hk-input formControlName="cilindradaCc" modoTeclado="numeric" [maxCaracteres]="4" />
          </hk-form-field>
          <hk-form-field [etiqueta]="'motos.campos.color' | transloco" [opcional]="true">
            <hk-input formControlName="color" autocompletar="off" [maxCaracteres]="40" />
          </hk-form-field>
        </div>
        <hk-form-field
          [etiqueta]="'motos.campos.vin' | transloco"
          [ayuda]="'motos.form.vin_ayuda' | transloco"
          [opcional]="true"
        >
          <hk-input formControlName="vin" autocompletar="off" [maxCaracteres]="17" />
        </hk-form-field>
      </form>
      <div hkDrawerPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button hk-button tipo="submit" form="form-moto" icono="check" [cargando]="guardando()">
          {{ 'comun.guardar' | transloco }}
        </button>
      </div>
    </hk-drawer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotoFormDrawer {
  private readonly api = inject(MotocicletasApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly ref = inject<DialogRef<Motocicleta>>(DialogRef);
  private readonly datos = inject<DatosFormMoto | undefined>(DIALOG_DATA);
  protected readonly moto = this.datos?.moto;
  protected readonly clienteFijo = this.datos?.cliente;
  protected readonly clientes = buscadorClientes();
  protected readonly guardando = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    clienteId: [
      this.clienteFijo ? String(this.clienteFijo.id) : (null as string | null),
      this.moto ? [] : [Validators.required],
    ],
    placa: [this.moto?.placa ?? '', [Validators.required, placaColombiana]],
    marca: [this.moto?.marca ?? '', [Validators.required, Validators.maxLength(60)]],
    modelo: [this.moto?.modelo ?? '', [Validators.required, Validators.maxLength(60)]],
    anio: [
      this.moto?.anio?.toString() ?? '',
      [Validators.pattern(/^\d{4}$/), Validators.min(ANIO_MINIMO), Validators.max(ANIO_MAXIMO)],
    ],
    cilindradaCc: [
      this.moto?.cilindradaCc?.toString() ?? '',
      [Validators.pattern(/^\d+$/), Validators.min(1), Validators.max(CILINDRADA_MAXIMA)],
    ],
    color: [this.moto?.color ?? '', Validators.maxLength(40)],
    vin: [this.moto?.vin ?? '', vinValido],
  });

  protected readonly placaVista = signal(this.moto?.placa ?? '');

  constructor() {
    // RN-41: la placa se normaliza mientras se escribe (mayúsculas, sin espacios ni guiones).
    const placa = this.form.controls.placa;
    placa.valueChanges.subscribe((valor) => {
      const normalizada = normalizarPlaca(valor);
      if (normalizada !== valor) placa.setValue(normalizada, { emitEvent: false });
      this.placaVista.set(placa.valid ? normalizada : '');
    });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const v = this.form.getRawValue();
    const ficha: FichaMotocicleta = {
      placa: normalizarPlaca(v.placa),
      marca: v.marca.trim(),
      modelo: v.modelo.trim(),
      anio: v.anio ? Number(v.anio) : null,
      vin: v.vin.trim().toUpperCase() || null,
      cilindradaCc: v.cilindradaCc ? Number(v.cilindradaCc) : null,
      color: v.color.trim() || null,
    };
    const contexto = conFormulario(this.form);
    const peticion: Observable<Motocicleta> = this.moto
      ? this.api.actualizar(this.moto.id, ficha, contexto)
      : this.api.crear({ ...ficha, clienteId: Number(v.clienteId) }, contexto);

    this.guardando.set(true);
    peticion.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (guardada) => this.ref.close(guardada),
      error: (e: HttpErrorResponse) => {
        const codigo = codigoDeError(e);
        const campo = CAMPO_DUPLICADO[codigo];
        if (campo) marcarErroresServidor(this.form, [{ campo, code: codigo }]);
        enfocarPrimerError(this.host.nativeElement, this.injector);
      },
    });
  }
}
