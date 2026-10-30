import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import es from '../../../../public/i18n/es.json';
import { PingPage } from './ping-page';

describe('PingPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        PingPage,
        TranslocoTestingModule.forRoot({
          langs: { es },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function crear(): {
    boton: HTMLButtonElement;
    estado: () => string;
    detectar: () => Promise<void>;
  } {
    const fixture = TestBed.createComponent(PingPage);
    const el = fixture.nativeElement as HTMLElement;
    return {
      boton: el.querySelector('button') as HTMLButtonElement,
      estado: () => el.querySelector('[role="status"]')?.textContent?.trim() ?? '',
      detectar: () => fixture.whenStable(),
    };
  }

  it('muestra la respuesta del backend al probar el ping', async () => {
    const pagina = crear();
    await pagina.detectar();

    pagina.boton.click();
    http.expectOne('/api/v1/ping').flush({ mensaje: 'pong', fecha: '2026-10-29T00:00:00Z' });
    await pagina.detectar();

    expect(pagina.estado()).toBe('Respuesta del servidor: pong');
  });

  it('muestra un error si el backend no responde', async () => {
    const pagina = crear();
    await pagina.detectar();

    pagina.boton.click();
    http.expectOne('/api/v1/ping').flush(null, { status: 503, statusText: 'Service Unavailable' });
    await pagina.detectar();

    expect(pagina.estado()).toBe('No se pudo conectar con el servidor');
  });
});
