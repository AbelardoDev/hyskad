import {
  booleanAttribute,
  computed,
  Directive,
  inject,
  InjectionToken,
  input,
  ModelSignal,
  Signal,
  signal,
} from '@angular/core';
import { ControlValueAccessor } from '@angular/forms';

/** Lo que `hk-form-field` comparte con el control que contiene (ids y estado de error). */
export interface ContextoCampo {
  readonly idControl: string;
  readonly descritoPor: Signal<string | null>;
  readonly invalido: Signal<boolean>;
  readonly requerido: Signal<boolean>;
}

export const HK_CAMPO = new InjectionToken<ContextoCampo>('HK_CAMPO');

let siguienteId = 0;
export const nuevoId = (prefijo: string) => `${prefijo}-${++siguienteId}`;

/**
 * Base de los controles del kit (`ControlValueAccessor`). Funcionan con formularios reactivos
 * y también solos con `[(valor)]`. Dentro de `hk-form-field` toman de él el id y los atributos ARIA.
 */
@Directive()
export abstract class ControlBase<T> implements ControlValueAccessor {
  protected readonly campo = inject(HK_CAMPO, { optional: true });

  abstract readonly valor: ModelSignal<T>;
  readonly id = input<string>();
  readonly deshabilitado = input(false, { transform: booleanAttribute });

  private readonly idPropio = nuevoId('hk-control');
  private readonly deshabilitadoPorForm = signal(false);
  private alCambiar: (valor: T) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  readonly idControl = computed(() => this.id() ?? this.campo?.idControl ?? this.idPropio);
  readonly estaDeshabilitado = computed(() => this.deshabilitado() || this.deshabilitadoPorForm());
  readonly invalido = computed(() => this.campo?.invalido() ?? false);
  readonly descritoPor = computed(() => this.campo?.descritoPor() ?? null);
  readonly requerido = computed(() => this.campo?.requerido() ?? false);

  /** Lo llama la vista cuando el usuario cambia el valor. */
  protected actualizar(valor: T): void {
    this.valor.set(valor);
    this.alCambiar(valor);
  }

  /** Texto actual del elemento que disparó el evento (`input`, `textarea`, `select`). */
  protected texto(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  protected tocar(): void {
    this.alTocar();
  }

  writeValue(valor: T): void {
    this.valor.set(valor);
  }

  registerOnChange(fn: (valor: T) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitadoPorForm.set(deshabilitado);
  }
}
