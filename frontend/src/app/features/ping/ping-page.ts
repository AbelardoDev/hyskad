import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { PingApiService, PingResponse } from './ping-api.service';

type EstadoPing = 'inicial' | 'cargando' | 'ok' | 'error';

/** Página temporal de F01 para probar Angular → proxy → Spring Boot. Se elimina en F02. */
@Component({
  selector: 'hk-ping-page',
  imports: [TranslocoPipe],
  templateUrl: './ping-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PingPage {
  private readonly pingApi = inject(PingApiService);

  protected readonly estado = signal<EstadoPing>('inicial');
  protected readonly respuesta = signal<PingResponse | null>(null);

  protected probarPing(): void {
    this.estado.set('cargando');
    this.pingApi.ping().subscribe({
      next: (respuesta) => {
        this.respuesta.set(respuesta);
        this.estado.set('ok');
      },
      error: () => {
        this.respuesta.set(null);
        this.estado.set('error');
      },
    });
  }
}
