import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ThemeService } from '../../core/theme/theme.service';
import { HkAvatar, iniciales, indiceColor } from './avatar/avatar';
import { HkBadge } from './badge/badge';
import { EstadoOrden, HkStatusBadge } from './badge/status-badge';
import { HkCard } from './card/card';
import { HkStatCard, puntosSparkline } from './card/stat-card';
import { HkEmptyState } from './empty-state/empty-state';
import { HkLogo } from './logo/logo';
import { HkPageHeader } from './page-header/page-header';
import { HkSkeleton } from './skeleton/skeleton';

async function crear<T>(tipo: new () => T) {
  const fixture = TestBed.createComponent(tipo);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('HkBadge y HkStatusBadge', () => {
  @Component({
    imports: [HkBadge, HkStatusBadge],
    template: `
      <hk-badge tono="warning" icono="info">Stock bajo</hk-badge>
      <hk-badge tono="success" [punto]="true">Activo</hk-badge>
      <hk-status-badge [estado]="estado()" />
    `,
  })
  class Anfitrion {
    readonly estado = signal<EstadoOrden>('EN_REPARACION');
  }

  it('aplica el tono con fondo -soft y texto -ink, con ícono o punto', async () => {
    const { el } = await crear(Anfitrion);
    const [aviso, exito] = Array.from(el.querySelectorAll('hk-badge'));

    expect(aviso.className).toContain('bg-warning-soft');
    expect(aviso.className).toContain('text-warning-ink');
    expect(aviso.querySelector('svg')).not.toBeNull();
    expect(exito.querySelector('span.rounded-full')).not.toBeNull();
  });

  it('el estado de orden lleva siempre ícono + texto traducido', async () => {
    const { fixture, el } = await crear(Anfitrion);
    const badge = () => el.querySelector('hk-status-badge hk-badge')!;

    expect(badge().textContent?.trim()).toBe('En reparación');
    expect(badge().className).toContain('bg-primary-soft');
    expect(badge().querySelector('svg')).not.toBeNull();

    fixture.componentInstance.estado.set('CANCELADA');
    await fixture.whenStable();
    expect(badge().textContent?.trim()).toBe('Cancelada');
    expect(badge().className).toContain('bg-danger-soft');
  });
});

describe('HkCard y HkPageHeader', () => {
  @Component({
    imports: [HkCard, HkPageHeader],
    template: `
      <hk-page-header titulo="Clientes" subtitulo="Todos los clientes">
        <button>Exportar</button>
        <button hkAccionPrincipal>Nuevo</button>
      </hk-page-header>
      <hk-card titulo="Resumen" subtitulo="Hoy"
        ><button hkCardAcciones>PDF</button>Contenido</hk-card
      >
    `,
  })
  class Anfitrion {}

  it('el encabezado usa h1 y proyecta acciones; la tarjeta usa h2 y su slot de acciones', async () => {
    const { el } = await crear(Anfitrion);

    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Clientes');
    expect(el.querySelector('hk-page-header')?.textContent).toContain('Todos los clientes');
    expect(
      el.querySelector('hk-page-header [hkAccionPrincipal]')?.parentElement?.className,
    ).toContain('max-md:fixed');
    expect(el.querySelector('hk-card h2')?.textContent?.trim()).toBe('Resumen');
    expect(el.querySelector('hk-card header button')?.textContent).toBe('PDF');
    expect(el.querySelector('hk-card')?.textContent).toContain('Contenido');
  });
});

describe('HkStatCard', () => {
  @Component({
    imports: [HkStatCard],
    template: `
      <hk-stat-card
        titulo="Ventas"
        valor="$ 10"
        icono="shopping-cart"
        [variacion]="12.5"
        [tendencia]="[1, 3, 2]"
      />
      <hk-stat-card titulo="Pendientes" valor="5" [variacion]="8" [subirEsMalo]="true" />
    `,
  })
  class Anfitrion {}

  it('muestra valor, variación con signo y color según si subir es bueno o malo', async () => {
    const { el } = await crear(Anfitrion);
    const [ventas, pendientes] = Array.from(el.querySelectorAll('hk-stat-card'));

    expect(ventas.textContent).toContain('$ 10');
    expect(ventas.textContent).toContain('+12,5 %');
    expect(ventas.querySelector('.text-success-ink')).not.toBeNull();
    expect(ventas.querySelector('polyline')).not.toBeNull();
    expect(pendientes.querySelector('.text-danger-ink')).not.toBeNull();
    expect(pendientes.querySelector('polyline')).toBeNull();
  });

  it('calcula los puntos del sparkline dentro del área', () => {
    expect(puntosSparkline([5])).toBe('');
    expect(puntosSparkline([0, 10], 100, 20)).toBe('0.0,18.0 100.0,2.0');
  });
});

describe('HkEmptyState y HkSkeleton', () => {
  @Component({
    imports: [HkEmptyState, HkSkeleton],
    template: `
      <hk-empty-state icono="users-round" titulo="Sin clientes" texto="Crea el primero"
        ><button>Nuevo</button></hk-empty-state
      >
      <hk-skeleton [lineas]="3" />
      <hk-skeleton variante="circulo" />
    `,
  })
  class Anfitrion {}

  it('el estado vacío muestra ícono decorativo, título, texto y acción', async () => {
    const { el } = await crear(Anfitrion);
    const vacio = el.querySelector('hk-empty-state')!;

    expect(vacio.querySelector('h2')?.textContent?.trim()).toBe('Sin clientes');
    expect(vacio.textContent).toContain('Crea el primero');
    expect(vacio.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(vacio.querySelector('button')?.textContent).toBe('Nuevo');
  });

  it('el skeleton es decorativo y respeta el número de líneas y la forma', async () => {
    const { el } = await crear(Anfitrion);
    const [texto, circulo] = Array.from(el.querySelectorAll('hk-skeleton'));

    expect(texto.getAttribute('aria-hidden')).toBe('true');
    expect(texto.querySelectorAll('span')).toHaveLength(3);
    expect((texto.querySelectorAll('span')[2] as HTMLElement).style.width).toBe('60%');
    expect(circulo.querySelector('span')?.className).toContain('rounded-full');
  });
});

describe('HkAvatar', () => {
  it('calcula iniciales y un color estable por nombre', () => {
    expect(iniciales('Andrea Martínez')).toBe('AM');
    expect(iniciales('  carlos  ')).toBe('C');
    expect(iniciales('Juan Pablo de la Torre')).toBe('JT');
    expect(iniciales('')).toBe('?');
    expect(indiceColor('Luis Pérez')).toBe(indiceColor('Luis Pérez'));
  });

  @Component({ imports: [HkAvatar], template: `<hk-avatar nombre="Luis Pérez" tamano="lg" />` })
  class Anfitrion {}

  it('se anuncia como imagen con el nombre completo', async () => {
    const { el } = await crear(Anfitrion);
    const avatar = el.querySelector('hk-avatar')!;

    expect(avatar.getAttribute('role')).toBe('img');
    expect(avatar.getAttribute('aria-label')).toBe('Luis Pérez');
    expect(avatar.textContent?.trim()).toBe('LP');
    expect(avatar.className).toContain('size-12');
  });
});

describe('HkLogo', () => {
  @Component({
    imports: [HkLogo],
    template: `<hk-logo /><hk-logo variante="simbolo" fondo="oscuro" />`,
  })
  class Anfitrion {}

  it('elige la versión clara u oscura según el tema y el fondo', async () => {
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    localStorage.clear();
    const { fixture, el } = await crear(Anfitrion);
    const [auto, sidebar] = Array.from(el.querySelectorAll('img'));

    expect(auto.getAttribute('src')).toBe('brand/logo.svg');
    expect(auto.alt).toBe('HYSKAD');
    expect(sidebar.getAttribute('src')).toBe('brand/logo-mark-on-dark.svg');

    TestBed.inject(ThemeService).cambiar('dark');
    await fixture.whenStable();
    expect(auto.getAttribute('src')).toBe('brand/logo-on-dark.svg');
  });
});
