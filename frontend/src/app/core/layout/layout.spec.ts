import { BreakpointObserver } from '@angular/cdk/layout';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import {
  provideRouter,
  Router,
  RouterOutlet,
  TitleStrategy,
  withComponentInputBinding,
} from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';

import { routes } from '../../app.routes';
import { authInterceptor } from '../auth/auth.interceptor';
import { UsuarioSesion } from '../auth/auth.models';
import { iniciarSesionDePrueba } from '../auth/sesion-de-prueba';
import { ThemeService } from '../theme/theme.service';
import { CLAVE_SIDEBAR, ESCRITORIO, LayoutService, MOVIL } from './layout.service';
import { ACCESOS_RAPIDOS, MENU } from './menu.config';
import { MigasService } from './migas.service';
import { TituloStrategy } from './titulo.strategy';

/** Simula el ancho de pantalla para BreakpointObserver. */
function simularPantalla(ancho: number) {
  const coincide = (consulta: string) =>
    (consulta === MOVIL && ancho < 768) || (consulta === ESCRITORIO && ancho >= 1024);
  return {
    provide: BreakpointObserver,
    useValue: {
      isMatched: coincide,
      observe: (consulta: string) => of({ matches: coincide(consulta), breakpoints: {} }),
    },
  };
}

function configurar(ancho: number, sesion: Partial<UsuarioSesion> | null = {}) {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      simularPantalla(ancho),
      { provide: TitleStrategy, useClass: TituloStrategy },
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  if (sesion) iniciarSesionDePrueba(sesion);
}

@Component({ imports: [RouterOutlet], template: '<router-outlet />' })
class Anfitrion {}

beforeEach(() => localStorage.clear());

describe('menú', () => {
  it('cada ítem declara ícono, clave i18n, ruta y permiso; hay 4 accesos rápidos', () => {
    const items = MENU.flatMap((g) => g.items);
    const transloco = TestBed.inject(TranslocoService);

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.ruta.startsWith('/')).toBe(true);
      expect(item.permisos.length).toBeGreaterThan(0);
      expect(transloco.translate(item.clave)).not.toBe(item.clave);
    }
    expect(ACCESOS_RAPIDOS).toHaveLength(4);
  });
});

describe('LayoutService', () => {
  it('en escritorio el sidebar empieza expandido y recuerda el cambio', () => {
    configurar(1440);
    const layout = TestBed.inject(LayoutService);

    expect(layout.colapsado()).toBe(false);
    layout.alternarSidebar();
    expect(layout.colapsado()).toBe(true);
    expect(localStorage.getItem(CLAVE_SIDEBAR)).toBe('colapsado');
  });

  it('en tablet empieza colapsado salvo que el usuario haya elegido', () => {
    configurar(900);
    expect(TestBed.inject(LayoutService).colapsado()).toBe(true);

    TestBed.resetTestingModule();
    localStorage.setItem(CLAVE_SIDEBAR, 'expandido');
    configurar(900);
    expect(TestBed.inject(LayoutService).colapsado()).toBe(false);
  });

  it('detecta móvil', () => {
    configurar(375);
    expect(TestBed.inject(LayoutService).esMovil()).toBe(true);
  });
});

describe('migas y título', () => {
  it('se construyen desde data.miga sin repetir la de las rutas hijas', async () => {
    configurar(1440);
    const migas = TestBed.inject(MigasService);
    await TestBed.inject(Router).navigateByUrl('/clientes');

    expect(migas.migas()).toEqual([{ clave: 'menu.clientes', url: '/clientes' }]);
    expect(TestBed.inject(Title).getTitle()).toBe('Clientes · HYSKAD');
  });
});

describe('HkShell', () => {
  // Inicio (dashboard) sigue siendo "Próximamente" hasta F11: no hace peticiones al backend.
  async function montar(ancho: number, url = '/dashboard', sesion: Partial<UsuarioSesion> = {}) {
    configurar(ancho, sesion);
    const fixture = TestBed.createComponent(Anfitrion);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('renderiza sidebar, topbar, migas, contenido y la página "Próximamente" del módulo', async () => {
    const { el } = await montar(1440);

    expect(el.querySelector('a[href="#contenido"]')?.textContent).toContain('Saltar al contenido');
    expect(el.querySelector('aside nav')?.getAttribute('aria-label')).toBe('Navegación principal');
    expect(el.querySelector('aside [aria-current="page"]')?.textContent).toContain('Inicio');
    expect(el.querySelector('hk-topbar [aria-current="page"]')?.textContent?.trim()).toBe('Inicio');
    expect(el.querySelector('main#contenido h1')?.textContent?.trim()).toBe('Inicio');
    expect(el.querySelector('main hk-empty-state')?.textContent).toContain('Inicio llega pronto');
  });

  it('el botón de menú colapsa el sidebar a solo íconos en escritorio', async () => {
    const { fixture, el } = await montar(1440);
    const boton = el.querySelector<HTMLButtonElement>('hk-topbar button[aria-expanded]')!;

    expect(boton.getAttribute('aria-label')).toBe('Colapsar menú');
    expect(el.querySelector('aside')?.className).toContain('w-[260px]');
    boton.click();
    await fixture.whenStable();

    expect(el.querySelector('aside')?.className).toContain('w-[76px]');
    expect(el.querySelector('aside a[aria-label="Clientes"]')).not.toBeNull();
    expect(boton.getAttribute('aria-label')).toBe('Expandir menú');
  });

  it('en móvil el botón de menú abre el drawer de navegación', async () => {
    const { fixture, el } = await montar(375);
    const boton = el.querySelector<HTMLButtonElement>('hk-topbar button[aria-label="Abrir menú"]')!;

    boton.click();
    await fixture.whenStable();

    const drawer = document.querySelector('.hk-drawer-izquierda hk-menu-movil')!;
    expect(drawer.querySelectorAll('nav a').length).toBe(MENU.flatMap((g) => g.items).length);
    (drawer.querySelector('button[aria-label="Cerrar menú"]') as HTMLButtonElement).click();
  });

  it('la barra inferior ofrece los accesos rápidos', async () => {
    const { el } = await montar(375);
    const enlaces = Array.from(el.querySelectorAll('hk-bottom-nav a'));

    expect(enlaces.map((a) => a.textContent?.trim())).toEqual([
      'Inicio',
      'Órdenes',
      'Clientes',
      'Ventas',
    ]);
    expect(el.querySelector('hk-bottom-nav [aria-current="page"]')?.textContent).toContain(
      'Inicio',
    );
  });

  it('el menú de tema de la topbar cambia la preferencia', async () => {
    const { fixture, el } = await montar(1440);
    const disparador = el.querySelector<HTMLButtonElement>('hk-topbar button[aria-label="Tema"]')!;

    disparador.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'))
      .find((b) => b.textContent?.includes('Oscuro'))!
      .click();
    await fixture.whenStable();

    expect(TestBed.inject(ThemeService).preferencia()).toBe('dark');
  });

  it('el menú, el drawer y la barra inferior muestran solo lo que permite el rol', async () => {
    const { el } = await montar(375, '/dashboard', {
      rol: 'MECANICO',
      permisos: [
        'DASHBOARD_VER',
        'CLIENTES_VER',
        'MOTOS_VER',
        'PRODUCTOS_VER',
        'ORDENES_VER_ASIGNADAS',
      ],
    });

    expect(
      Array.from(el.querySelectorAll('hk-bottom-nav a')).map((a) => a.textContent?.trim()),
    ).toEqual(['Inicio', 'Órdenes', 'Clientes', 'Motocicletas']);
    const enSidebar = Array.from(el.querySelectorAll('aside nav a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(enSidebar).toEqual([
      '/dashboard',
      '/ordenes',
      '/clientes',
      '/motocicletas',
      '/inventario',
    ]);
  });

  it('el menú de usuario muestra nombre y rol, y cierra la sesión', async () => {
    const { fixture, el } = await montar(1440);
    Array.from(el.querySelectorAll<HTMLButtonElement>('hk-topbar button'))
      .find((b) => b.querySelector('hk-avatar') && b.textContent?.includes('Menú de usuario'))!
      .click();
    await fixture.whenStable();

    expect(document.querySelector('[role="menu"]')?.textContent).toContain('Ana Admin');
    expect(document.querySelector('[role="menu"]')?.textContent).toContain('Administrador');
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      .find((b) => b.textContent?.includes('Cerrar sesión'))!
      .click();
    TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/logout').flush(null);
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('Ctrl+K abre el buscador global (placeholder)', async () => {
    const { fixture } = await montar(1440);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    await fixture.whenStable();

    expect(document.querySelector('hk-busqueda-proximamente')?.textContent).toContain(
      'La búsqueda global llega pronto',
    );
  });
});
