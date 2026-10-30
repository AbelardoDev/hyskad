import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize, Observable } from 'rxjs';

import { conFormulario, marcarErroresServidor } from '../../core/http/contexto-http';
import { codigoDeError } from '../../core/http/error.interceptor';
import { FechaPipe } from '../../core/utils/formato.pipes';
import {
  documentoSegunTipo,
  normalizarTelefono,
  numeroConDv,
  telefonoColombiano,
  TipoDocumento,
} from '../../core/utils/validadores';
import { HkButton } from '../../shared/ui/button/button';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkDrawer } from '../../shared/ui/dialog/drawer';
import { HkCamposDocumento } from '../../shared/ui/forms/campos-documento';
import { HkCheckbox } from '../../shared/ui/forms/checkbox';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { Cliente, ClientesApiService, DatosCliente } from './clientes-api.service';
import { PoliticaDatosModal } from './politica-datos-modal';

export interface DatosFormCliente {
  /** Si viene, se edita; si no, se crea. */
  cliente?: Cliente;
}

/** Crear o editar un cliente (RF5, RF6) en un drawer. Cierra devolviendo el cliente guardado. */
@Component({
  selector: 'hk-cliente-form-drawer',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    FechaPipe,
    HkButton,
    HkCamposDocumento,
    HkCheckbox,
    HkDrawer,
    HkFormField,
    HkInput,
  ],
  template: `
    <hk-drawer
      [titulo]="
        (esNuevo ? 'clientes.form.titulo_nuevo' : 'clientes.form.titulo_editar') | transloco
      "
    >
      <form
        id="form-cliente"
        class="space-y-5"
        [formGroup]="form"
        (ngSubmit)="guardar()"
        novalidate
      >
        <hk-campos-documento
          [tipoDocumento]="form.controls.tipoDocumento"
          [numeroDocumento]="form.controls.numeroDocumento"
        />

        @if (esNit()) {
          <hk-form-field [etiqueta]="'clientes.campos.razon_social' | transloco">
            <hk-input
              formControlName="razonSocial"
              autocompletar="organization"
              [maxCaracteres]="150"
            />
          </hk-form-field>
        } @else {
          <div class="grid gap-5 sm:grid-cols-2">
            <hk-form-field [etiqueta]="'clientes.campos.nombres' | transloco">
              <hk-input formControlName="nombres" autocompletar="off" [maxCaracteres]="80" />
            </hk-form-field>
            <hk-form-field [etiqueta]="'clientes.campos.apellidos' | transloco">
              <hk-input formControlName="apellidos" autocompletar="off" [maxCaracteres]="80" />
            </hk-form-field>
          </div>
        }

        <div class="grid gap-5 sm:grid-cols-2">
          <hk-form-field
            [etiqueta]="'clientes.campos.telefono' | transloco"
            [ayuda]="'clientes.form.telefono_ayuda' | transloco"
          >
            <hk-input
              formControlName="telefono"
              tipo="tel"
              modoTeclado="tel"
              [maxCaracteres]="20"
            />
          </hk-form-field>
          <hk-form-field [etiqueta]="'clientes.campos.email' | transloco" [opcional]="true">
            <hk-input
              formControlName="email"
              tipo="email"
              modoTeclado="email"
              autocompletar="off"
              [maxCaracteres]="254"
            />
          </hk-form-field>
        </div>
        <div class="grid gap-5 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <hk-form-field [etiqueta]="'clientes.campos.direccion' | transloco" [opcional]="true">
            <hk-input formControlName="direccion" autocompletar="off" [maxCaracteres]="200" />
          </hk-form-field>
          <hk-form-field [etiqueta]="'clientes.campos.ciudad' | transloco" [opcional]="true">
            <hk-input formControlName="ciudad" autocompletar="off" [maxCaracteres]="80" />
          </hk-form-field>
        </div>

        <fieldset class="rounded-xl border border-border bg-surface-2/60 p-4">
          <legend class="px-1 text-xs font-medium text-fg">
            {{ 'clientes.form.datos_personales' | transloco }}
          </legend>
          <hk-checkbox formControlName="aceptaTratamientoDatos">
            {{ 'clientes.form.autoriza' | transloco }}
          </hk-checkbox>
          <p class="mt-1 text-xs text-muted">
            {{ 'clientes.form.autoriza_ayuda' | transloco }}
            <button
              type="button"
              class="rounded font-medium text-primary hk-foco hover:underline"
              (click)="verPolitica()"
            >
              {{ 'clientes.politica.ver' | transloco }}
            </button>
          </p>
          @if (fechaAceptacion(); as fecha) {
            <p class="mt-2 text-xs text-muted">
              {{ 'clientes.form.autorizado_el' | transloco: { fecha: (fecha | fecha) } }}
            </p>
          }
        </fieldset>
      </form>
      <div hkDrawerPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button hk-button tipo="submit" form="form-cliente" icono="check" [cargando]="guardando()">
          {{ 'comun.guardar' | transloco }}
        </button>
      </div>
    </hk-drawer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClienteFormDrawer {
  private readonly api = inject(ClientesApiService);
  private readonly dialogos = inject(DialogosService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly ref = inject<DialogRef<Cliente>>(DialogRef);
  private readonly cliente = inject<DatosFormCliente | undefined>(DIALOG_DATA)?.cliente;

  protected readonly esNuevo = !this.cliente;
  protected readonly guardando = signal(false);
  protected readonly fechaAceptacion = signal(this.cliente?.fechaAceptacionDatos ?? null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    tipoDocumento: [
      (this.cliente?.tipoDocumento ?? 'CC') as TipoDocumento | '',
      Validators.required,
    ],
    numeroDocumento: [this.cliente?.numeroDocumento ?? '', Validators.required],
    nombres: [this.cliente?.nombres ?? '', Validators.maxLength(80)],
    apellidos: [this.cliente?.apellidos ?? '', Validators.maxLength(80)],
    razonSocial: [this.cliente?.razonSocial ?? '', Validators.maxLength(150)],
    telefono: [this.cliente?.telefono ?? '', [Validators.required, telefonoColombiano]],
    email: [this.cliente?.email ?? '', [Validators.email, Validators.maxLength(254)]],
    direccion: [this.cliente?.direccion ?? '', Validators.maxLength(200)],
    ciudad: [this.cliente?.ciudad ?? '', Validators.maxLength(80)],
    aceptaTratamientoDatos: [this.cliente?.aceptaTratamientoDatos ?? false],
  });

  private readonly tipo = toSignal(this.form.controls.tipoDocumento.valueChanges, {
    initialValue: this.form.controls.tipoDocumento.value,
  });

  protected readonly esNit = computed(() => this.tipo() === 'NIT');

  constructor() {
    const { numeroDocumento, tipoDocumento } = this.form.controls;
    numeroDocumento.addValidators(documentoSegunTipo(() => tipoDocumento.value));
    numeroDocumento.updateValueAndValidity();
    this.aplicarNombreSegunTipo();
    this.form.controls.tipoDocumento.valueChanges.subscribe(() => this.aplicarNombreSegunTipo());
  }

  protected verPolitica(): void {
    this.dialogos.abrirModal(PoliticaDatosModal, { tamano: 'lg' });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const valores = this.form.getRawValue();
    const tipo = valores.tipoDocumento;
    if (!tipo) return;
    const esNit = tipo === 'NIT';
    const datos: DatosCliente = {
      tipoDocumento: tipo,
      numeroDocumento: numeroConDv(tipo, valores.numeroDocumento),
      nombres: esNit ? null : texto(valores.nombres),
      apellidos: esNit ? null : texto(valores.apellidos),
      razonSocial: esNit ? texto(valores.razonSocial) : null,
      telefono: normalizarTelefono(valores.telefono),
      email: texto(valores.email),
      direccion: texto(valores.direccion),
      ciudad: texto(valores.ciudad),
      aceptaTratamientoDatos: valores.aceptaTratamientoDatos,
    };
    const contexto = conFormulario(this.form);
    const peticion: Observable<Cliente> = this.cliente
      ? this.api.actualizar(this.cliente.id, datos, contexto)
      : this.api.crear(datos, contexto);

    this.guardando.set(true);
    peticion.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (guardado) => this.ref.close(guardado),
      error: (e: HttpErrorResponse) => {
        if (codigoDeError(e) === 'DOCUMENTO_DUPLICADO')
          marcarErroresServidor(this.form, [
            { campo: 'numeroDocumento', code: 'DOCUMENTO_DUPLICADO' },
          ]);
        enfocarPrimerError(this.host.nativeElement, this.injector);
      },
    });
  }

  /** RN-39: con NIT se pide razón social; con los demás, nombres y apellidos. */
  private aplicarNombreSegunTipo(): void {
    const { nombres, apellidos, razonSocial, tipoDocumento } = this.form.controls;
    const esNit = tipoDocumento.value === 'NIT';
    for (const [control, requerido] of [
      [nombres, !esNit],
      [apellidos, !esNit],
      [razonSocial, esNit],
    ] as const) {
      if (requerido) control.addValidators(Validators.required);
      else control.removeValidators(Validators.required);
      control.updateValueAndValidity();
    }
  }
}

function texto(valor: string): string | null {
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}
