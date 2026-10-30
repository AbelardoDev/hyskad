import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';

import { CLAVE_IDIOMA, LanguageService, leerIdiomaGuardado } from './language.service';

describe('LanguageService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'es';
  });

  function crear(): LanguageService {
    const servicio = TestBed.inject(LanguageService);
    TestBed.tick();
    return servicio;
  }

  it('usa español (es-CO) por defecto', () => {
    const servicio = crear();

    expect(servicio.idioma()).toBe('es');
    expect(servicio.locale()).toBe('es-CO');
    expect(document.documentElement.lang).toBe('es');
  });

  it('al cambiar sincroniza Transloco, <html lang>, la locale y localStorage', () => {
    const servicio = crear();
    const transloco = TestBed.inject(TranslocoService);

    servicio.cambiar('en');
    TestBed.tick();

    expect(transloco.getActiveLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(servicio.locale()).toBe('en-US');
    expect(localStorage.getItem(CLAVE_IDIOMA)).toBe('en');
    expect(transloco.translate('comun.cerrar')).toBe('Close');
  });

  it('recupera el idioma guardado e ignora valores no soportados', () => {
    localStorage.setItem(CLAVE_IDIOMA, 'en');
    expect(leerIdiomaGuardado()).toBe('en');
    expect(crear().idioma()).toBe('en');

    localStorage.setItem(CLAVE_IDIOMA, 'fr');
    expect(leerIdiomaGuardado()).toBe('es');
  });
});
