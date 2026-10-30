import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HkButton, VarianteBoton } from './button';
import { HkIconButton } from './icon-button';

@Component({
  imports: [HkButton, HkIconButton],
  template: `
    <button
      hk-button
      [variante]="variante()"
      [cargando]="cargando()"
      [deshabilitado]="deshabilitado()"
      icono="plus"
      (click)="clics = clics + 1"
    >
      Guardar
    </button>
    <a hk-button variante="link" [deshabilitado]="true">Enlace</a>
    <button hk-button tipo="submit" tamano="lg">Enviar</button>
    <button hk-icon-button icono="pencil" etiqueta="Editar" (click)="clics = clics + 1"></button>
  `,
})
class Anfitrion {
  readonly variante = signal<VarianteBoton>('primary');
  readonly cargando = signal(false);
  readonly deshabilitado = signal(false);
  clics = 0;
}

async function montar() {
  const fixture = TestBed.createComponent(Anfitrion);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const [principal, enviar, icono] = Array.from(el.querySelectorAll<HTMLElement>('button'));
  return { fixture, el, principal, enviar, icono, enlace: el.querySelector<HTMLElement>('a')! };
}

describe('HkButton', () => {
  it('renderiza el contenido, el ícono y type="button" por defecto', async () => {
    const { principal, enviar } = await montar();

    expect(principal.textContent?.trim()).toBe('Guardar');
    expect(principal.getAttribute('type')).toBe('button');
    expect(principal.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(enviar.getAttribute('type')).toBe('submit');
    expect(enviar.className).toContain('h-12');
  });

  it('aplica las clases de cada variante con tokens semánticos', async () => {
    const { fixture, principal } = await montar();
    expect(principal.className).toContain('bg-primary');

    fixture.componentInstance.variante.set('danger');
    await fixture.whenStable();
    expect(principal.className).toContain('bg-danger');

    fixture.componentInstance.variante.set('secondary');
    await fixture.whenStable();
    expect(principal.className).toContain('border-border');
  });

  it('en carga muestra el spinner, se deshabilita y anuncia aria-busy', async () => {
    const { fixture, principal } = await montar();

    fixture.componentInstance.cargando.set(true);
    await fixture.whenStable();

    expect(principal.hasAttribute('disabled')).toBe(true);
    expect(principal.getAttribute('aria-busy')).toBe('true');
    expect(principal.querySelector('svg')?.classList.contains('animate-spin')).toBe(true);
  });

  it('emite click al activarse y no lo hace deshabilitado', async () => {
    const { fixture, principal } = await montar();

    principal.click();
    expect(fixture.componentInstance.clics).toBe(1);

    fixture.componentInstance.deshabilitado.set(true);
    await fixture.whenStable();
    principal.click();
    expect(fixture.componentInstance.clics).toBe(1);
  });

  it('en enlaces usa aria-disabled en lugar de disabled', async () => {
    const { enlace } = await montar();

    expect(enlace.hasAttribute('disabled')).toBe(false);
    expect(enlace.getAttribute('aria-disabled')).toBe('true');
    expect(enlace.hasAttribute('type')).toBe(false);
  });
});

describe('HkIconButton', () => {
  it('usa la etiqueta como nombre accesible y emite click', async () => {
    const { fixture, icono } = await montar();

    expect(icono.getAttribute('aria-label')).toBe('Editar');
    expect(icono.getAttribute('type')).toBe('button');
    icono.click();
    expect(fixture.componentInstance.clics).toBe(1);
  });
});
