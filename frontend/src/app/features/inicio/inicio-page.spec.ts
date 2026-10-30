import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import es from '../../../../public/i18n/es.json';
import { InicioPage } from './inicio-page';

describe('InicioPage', () => {
  it('muestra el nombre y el logo de HYSKAD', async () => {
    await TestBed.configureTestingModule({
      imports: [
        InicioPage,
        TranslocoTestingModule.forRoot({
          langs: { es },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(InicioPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('h1')?.textContent?.trim()).toBe('HYSKAD');
    expect(el.querySelector('img')?.getAttribute('alt')).toBe('HYSKAD');
  });
});
