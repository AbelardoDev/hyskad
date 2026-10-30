import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ColumnaTabla, HkCelda, HkTable, OrdenTabla, siguienteOrden } from './table';

interface Fila {
  id: number;
  nombre: string;
  total: number;
}

@Component({
  imports: [HkTable, HkCelda],
  template: `
    <hk-table
      [columnas]="columnas"
      [filas]="filas()"
      [cargando]="cargando()"
      etiqueta="Clientes"
      [(orden)]="orden"
      [seleccionable]="true"
      [(seleccion)]="seleccion"
      [filasClicables]="true"
      [pagina]="0"
      [tamano]="2"
      [total]="total()"
      vacioTitulo="Sin clientes"
      (filaClic)="clics.push($event.id)"
      (paginaCambio)="paginas.push($event)"
    >
      <ng-template hkCelda="total" let-fila>$ {{ fila.total }}</ng-template>
    </hk-table>
  `,
})
class Anfitrion {
  readonly columnas: ColumnaTabla[] = [
    { clave: 'nombre', etiqueta: 'Nombre', ordenable: true, principal: true },
    { clave: 'total', etiqueta: 'Total', numerica: true },
  ];
  readonly filas = signal<Fila[]>([
    { id: 1, nombre: 'Ana', total: 100 },
    { id: 2, nombre: 'Luis', total: 250 },
  ]);
  readonly cargando = signal(false);
  readonly total = signal<number | undefined>(5);
  readonly orden = signal<OrdenTabla | null>(null);
  readonly seleccion = signal<readonly unknown[]>([]);
  readonly clics: number[] = [];
  readonly paginas: number[] = [];
}

async function montar() {
  const fixture = TestBed.createComponent(Anfitrion);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, a: fixture.componentInstance };
}

describe('siguienteOrden', () => {
  it('rota asc → desc → sin orden y reinicia al cambiar de columna', () => {
    expect(siguienteOrden(null, 'nombre')).toEqual({ columna: 'nombre', direccion: 'asc' });
    expect(siguienteOrden({ columna: 'nombre', direccion: 'asc' }, 'nombre')).toEqual({
      columna: 'nombre',
      direccion: 'desc',
    });
    expect(siguienteOrden({ columna: 'nombre', direccion: 'desc' }, 'nombre')).toBeNull();
    expect(siguienteOrden({ columna: 'nombre', direccion: 'desc' }, 'total')).toEqual({
      columna: 'total',
      direccion: 'asc',
    });
  });
});

describe('HkTable', () => {
  it('renderiza encabezados con scope, caption, celdas de texto y plantillas propias', async () => {
    const { el } = await montar();
    const ths = Array.from(el.querySelectorAll('thead th'));

    expect(el.querySelector('caption')?.textContent?.trim()).toBe('Clientes');
    expect(ths.every((th) => th.getAttribute('scope') === 'col')).toBe(true);
    expect(ths[1].getAttribute('aria-sort')).toBe('none');
    const celdas = Array.from(el.querySelectorAll('tbody tr')[0].querySelectorAll('td')).map((td) =>
      td.textContent?.trim(),
    );
    expect(celdas.slice(1)).toEqual(['Ana', '$ 100']);
    expect(el.querySelector('tbody td:last-child')?.className).toContain('text-right');
  });

  it('ordena al pulsar el encabezado y lo anuncia con aria-sort', async () => {
    const { fixture, el, a } = await montar();
    const boton = el.querySelector<HTMLButtonElement>('thead th button')!;

    boton.click();
    await fixture.whenStable();
    expect(a.orden()).toEqual({ columna: 'nombre', direccion: 'asc' });
    expect(el.querySelectorAll('thead th')[1].getAttribute('aria-sort')).toBe('ascending');

    boton.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('thead th')[1].getAttribute('aria-sort')).toBe('descending');
  });

  it('emite la fila al hacer clic o pulsar Enter', async () => {
    const { el, a } = await montar();
    const fila = el.querySelectorAll<HTMLElement>('tbody tr')[1];

    expect(fila.getAttribute('tabindex')).toBe('0');
    fila.click();
    fila.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(a.clics).toEqual([2, 2]);
  });

  it('selecciona filas individuales y todas, sin disparar el clic de la fila', async () => {
    const { fixture, el, a } = await montar();
    const casillaFila = el.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')[0];

    casillaFila.click();
    await fixture.whenStable();
    expect(a.seleccion()).toEqual([1]);
    expect(a.clics).toEqual([]);
    expect(el.querySelector<HTMLInputElement>('thead input')!.indeterminate).toBe(true);

    el.querySelector<HTMLInputElement>('thead input')!.click();
    await fixture.whenStable();
    expect(a.seleccion()).toEqual([1, 2]);

    el.querySelector<HTMLInputElement>('thead input')!.click();
    await fixture.whenStable();
    expect(a.seleccion()).toEqual([]);
  });

  it('muestra skeleton y aria-busy mientras carga', async () => {
    const { fixture, el, a } = await montar();

    a.cargando.set(true);
    await fixture.whenStable();

    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(el.querySelectorAll('tbody hk-skeleton').length).toBeGreaterThan(0);
  });

  it('muestra el estado vacío sin tabla ni paginación', async () => {
    const { fixture, el, a } = await montar();

    a.filas.set([]);
    a.total.set(0);
    await fixture.whenStable();

    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('hk-empty-state')?.textContent).toContain('Sin clientes');
    expect(el.querySelector('hk-pagination')).toBeNull();
  });

  it('en móvil ofrece la lista de tarjetas con la columna principal como título', async () => {
    const { el } = await montar();
    const tarjetas = el.querySelectorAll('ul.md\\:hidden > li');

    expect(tarjetas).toHaveLength(2);
    expect(tarjetas[0].textContent).toContain('Ana');
    expect(tarjetas[0].querySelector('dt')?.textContent).toBe('Total');
    expect(tarjetas[0].querySelector('dd')?.textContent?.trim()).toBe('$ 100');
  });

  it('pagina con hk-pagination', async () => {
    const { el, a } = await montar();

    el.querySelector<HTMLButtonElement>('hk-pagination [aria-label="Página siguiente"]')!.click();

    expect(a.paginas).toEqual([1]);
  });
});
