import { TestBed } from '@angular/core/testing';

import { CLAVE_TEMA, THEME_COLOR, ThemeService } from './theme.service';

/** matchMedia falso que permite simular el cambio de preferencia del sistema. */
function simularMatchMedia(oscuro: boolean) {
  const oyentes = new Set<(e: MediaQueryListEvent) => void>();
  const consulta = {
    matches: oscuro,
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => oyentes.add(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => oyentes.delete(fn),
  };
  window.matchMedia = vi.fn().mockReturnValue(consulta);
  return {
    cambiar(valor: boolean) {
      consulta.matches = valor;
      oyentes.forEach((fn) => fn({ matches: valor } as MediaQueryListEvent));
    },
  };
}

describe('ThemeService', () => {
  const html = document.documentElement;
  let meta: HTMLMetaElement;

  beforeEach(() => {
    localStorage.clear();
    html.classList.remove('dark', 'hk-cambiando-tema');
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  });

  afterEach(() => meta.remove());

  function crear(): ThemeService {
    const servicio = TestBed.inject(ThemeService);
    TestBed.tick();
    return servicio;
  }

  it('por defecto sigue al sistema', () => {
    simularMatchMedia(true);
    const servicio = crear();

    expect(servicio.preferencia()).toBe('system');
    expect(servicio.oscuro()).toBe(true);
    expect(html.classList.contains('dark')).toBe(true);
    expect(meta.content).toBe(THEME_COLOR.dark);
  });

  it('reacciona en vivo al cambio de prefers-color-scheme en modo sistema', () => {
    const sistema = simularMatchMedia(false);
    const servicio = crear();
    expect(html.classList.contains('dark')).toBe(false);

    sistema.cambiar(true);
    TestBed.tick();

    expect(servicio.oscuro()).toBe(true);
    expect(html.classList.contains('dark')).toBe(true);
  });

  it('una preferencia explícita ignora al sistema y se guarda en localStorage', () => {
    const sistema = simularMatchMedia(true);
    const servicio = crear();

    servicio.cambiar('light');
    TestBed.tick();
    sistema.cambiar(true);
    TestBed.tick();

    expect(html.classList.contains('dark')).toBe(false);
    expect(meta.content).toBe(THEME_COLOR.light);
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('light');
  });

  it('lee la preferencia guardada al iniciar e ignora valores inválidos', () => {
    simularMatchMedia(false);
    localStorage.setItem(CLAVE_TEMA, 'dark');
    expect(crear().oscuro()).toBe(true);

    TestBed.resetTestingModule();
    localStorage.setItem(CLAVE_TEMA, 'morado');
    expect(crear().preferencia()).toBe('system');
  });

  it('marca la transición de colores solo al cambiar, no al iniciar', () => {
    simularMatchMedia(false);
    const servicio = crear();
    expect(html.classList.contains('hk-cambiando-tema')).toBe(false);

    servicio.cambiar('dark');
    TestBed.tick();

    expect(html.classList.contains('hk-cambiando-tema')).toBe(true);
  });
});
