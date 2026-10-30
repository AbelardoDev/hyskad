import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { HkCombobox, OpcionCombobox } from './combobox';

@Component({
  imports: [ReactiveFormsModule, HkCombobox],
  template: `
    <hk-combobox
      [formControl]="control"
      [opciones]="opciones"
      placeholder="Buscar moto"
      (busqueda)="busquedas.push($event)"
    />
  `,
})
class Anfitrion {
  readonly control = new FormControl<string | null>(null);
  readonly opciones: OpcionCombobox[] = [
    { valor: 'ABC12D', etiqueta: 'ABC12D', descripcion: 'Yamaha NMAX' },
    { valor: 'XYZ34E', etiqueta: 'XYZ34E', descripcion: 'Honda CB 190R' },
    { valor: 'KLM56F', etiqueta: 'KLM56F', descripcion: 'Suzuki Gixxer' },
  ];
  readonly busquedas: string[] = [];
}

async function montar() {
  const fixture = TestBed.createComponent(Anfitrion);
  await fixture.whenStable();
  const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input')!;
  const teclear = async (key: string) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await fixture.whenStable();
  };
  const opciones = () => Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
  return { fixture, input, teclear, opciones, anfitrion: fixture.componentInstance };
}

describe('HkCombobox', () => {
  it('expone el patrón ARIA de combobox y abre la lista con flecha abajo', async () => {
    const { input, teclear, opciones } = await montar();

    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');

    await teclear('ArrowDown');

    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(opciones()).toHaveLength(3);
    expect(
      document.getElementById(input.getAttribute('aria-controls')!)?.getAttribute('role'),
    ).toBe('listbox');
    expect(input.getAttribute('aria-activedescendant')).toBe(opciones()[0].id);
  });

  it('filtra sin importar tildes ni mayúsculas, incluyendo la descripción, y emite la búsqueda', async () => {
    const { fixture, input, opciones, anfitrion } = await montar();

    input.value = 'hónda';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(opciones().map((o) => o.textContent?.trim())).toEqual([
      expect.stringContaining('XYZ34E'),
    ]);
    expect(anfitrion.busquedas).toEqual(['hónda']);
  });

  it('se navega con flechas (circular) y Enter selecciona', async () => {
    const { input, teclear, anfitrion } = await montar();

    await teclear('ArrowDown');
    await teclear('ArrowDown');
    await teclear('ArrowUp');
    await teclear('ArrowUp');
    await teclear('Enter');

    expect(anfitrion.control.value).toBe('KLM56F');
    expect(input.value).toBe('KLM56F');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('Escape cierra sin cambiar el valor y muestra "Sin resultados" si no hay coincidencias', async () => {
    const { fixture, input, teclear, anfitrion } = await montar();

    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(document.querySelector('[role="listbox"]')?.textContent).toContain('Sin resultados');

    await teclear('Escape');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(anfitrion.control.value).toBeNull();
  });

  it('muestra la etiqueta del valor inicial y lo limpia al borrar el texto', async () => {
    const { fixture, input, anfitrion } = await montar();

    anfitrion.control.setValue('XYZ34E');
    await fixture.whenStable();
    expect(input.value).toBe('XYZ34E');

    input.value = '';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(anfitrion.control.value).toBeNull();
  });

  it('selecciona con clic en la opción', async () => {
    const { fixture, teclear, opciones, anfitrion } = await montar();

    await teclear('ArrowDown');
    opciones()[1].click();
    await fixture.whenStable();

    expect(anfitrion.control.value).toBe('XYZ34E');
  });
});
