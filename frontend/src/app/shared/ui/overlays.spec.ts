import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { ConfirmacionService } from './dialog/confirm-dialog';
import { DialogosService } from './dialog/dialogos.service';
import { HkDrawer } from './dialog/drawer';
import { HkModal } from './dialog/modal';
import { HkDropdownMenu, ItemMenu } from './dropdown-menu/dropdown-menu';
import { DURACION_TOAST_MS, HkToast, ToastService } from './toast/toast';
import { HkTooltipDirective } from './tooltip/tooltip';

const esperar = () => new Promise((r) => setTimeout(r, 0));
/** El CDK detecta Escape por `keyCode`, que jsdom no rellena a partir de `key`. */
function tecla(el: Element, key: string): void {
  const evento = new KeyboardEvent('keydown', { key, bubbles: true });
  if (key === 'Escape') Object.defineProperty(evento, 'keyCode', { value: 27 });
  el.dispatchEvent(evento);
}

afterEach(() => {
  document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
});

@Component({
  imports: [HkModal],
  template: `<hk-modal titulo="Registrar diagnóstico" descripcion="Detalle"
    ><input aria-label="Notas"
  /></hk-modal>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ModalPrueba {
  readonly ref = inject(DialogRef);
}

@Component({
  imports: [HkDrawer],
  template: `<hk-drawer titulo="Filtros">Contenido</hk-drawer>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DrawerPrueba {}

describe('DialogosService + HkModal / HkDrawer', () => {
  it('abre un modal accesible: role dialog, aria-modal y título enlazado', async () => {
    const ref = TestBed.inject(DialogosService).abrirModal(ModalPrueba);
    await esperar();
    const contenedor = document.querySelector('.cdk-dialog-container')!;
    const titulo = document.querySelector('hk-modal h2')!;

    expect(contenedor.getAttribute('role')).toBe('dialog');
    expect(contenedor.getAttribute('aria-modal')).toBe('true');
    expect(contenedor.getAttribute('aria-labelledby')).toBe(titulo.id);
    expect(titulo.textContent?.trim()).toBe('Registrar diagnóstico');
    ref.close();
  });

  it('el botón cerrar (traducido) cierra el modal', async () => {
    const ref = TestBed.inject(DialogosService).abrirModal(ModalPrueba);
    await esperar();
    const cerrado = firstValueFrom(ref.closed);

    const boton = document.querySelector<HTMLButtonElement>('hk-modal header button')!;
    expect(boton.getAttribute('aria-label')).toBe('Cerrar');
    boton.click();

    await expect(cerrado).resolves.toBeUndefined();
  });

  it('Escape cierra, salvo que el diálogo no sea cerrable', async () => {
    const dialogos = TestBed.inject(DialogosService);
    const ref = dialogos.abrirModal(ModalPrueba);
    await esperar();
    const cerrado = firstValueFrom(ref.closed);
    tecla(document.querySelector('.cdk-dialog-container')!, 'Escape');
    await expect(cerrado).resolves.toBeUndefined();

    const fijo = dialogos.abrirModal(ModalPrueba, { cerrable: false });
    await esperar();
    tecla(document.querySelector('.cdk-dialog-container')!, 'Escape');
    await esperar();
    expect(fijo.disableClose).toBe(true);
    expect(document.querySelector('hk-modal')).not.toBeNull();
    fijo.close();
  });

  it('el drawer usa las clases de panel lateral', async () => {
    const ref = TestBed.inject(DialogosService).abrirDrawer(DrawerPrueba, { lado: 'izquierda' });
    await esperar();

    expect(document.querySelector('.hk-drawer-izquierda hk-drawer h2')?.textContent?.trim()).toBe(
      'Filtros',
    );
    ref.close();
  });
});

describe('ConfirmacionService', () => {
  it('resuelve null al cancelar y {} al confirmar', async () => {
    const servicio = TestBed.inject(ConfirmacionService);

    const cancelada = servicio.pedir({ titulo: '¿Enviar?', mensaje: 'Se enviará' });
    await esperar();
    expect(document.querySelector('hk-confirm-dialog')?.textContent).toContain('Se enviará');
    botonConTexto('Cancelar').click();
    await expect(cancelada).resolves.toBeNull();

    const confirmada = servicio.pedir({ titulo: '¿Enviar?', mensaje: 'Se enviará' });
    await esperar();
    botonConTexto('Confirmar').click();
    await expect(confirmada).resolves.toEqual({});
  });

  it('una acción peligrosa con motivo no se confirma hasta escribirlo', async () => {
    const resultado = TestBed.inject(ConfirmacionService).pedir({
      titulo: 'Anular venta',
      mensaje: 'No se puede deshacer',
      textoConfirmar: 'Anular',
      peligrosa: true,
      pedirMotivo: true,
    });
    await esperar();
    const anular = botonConTexto('Anular');

    expect(anular.disabled).toBe(true);
    expect(anular.className).toContain('bg-danger');

    const area = document.querySelector<HTMLTextAreaElement>('hk-confirm-dialog textarea')!;
    area.value = '  Cliente desistió  ';
    area.dispatchEvent(new Event('input'));
    await esperar();
    TestBed.tick();

    expect(anular.disabled).toBe(false);
    anular.click();
    await expect(resultado).resolves.toEqual({ motivo: 'Cliente desistió' });
  });
});

function botonConTexto(texto: string): HTMLButtonElement {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('.cdk-overlay-container button'),
  ).find((b) => b.textContent?.trim() === texto)!;
}

describe('ToastService + HkToast', () => {
  @Component({ imports: [HkToast], template: `<hk-toast />` })
  class Anfitrion {}

  it('muestra toasts en una región aria-live y se cierran solos a los 4 s', async () => {
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    vi.useFakeTimers();
    try {
      const servicio = TestBed.inject(ToastService);
      const el = fixture.nativeElement as HTMLElement;

      servicio.exito('Orden guardada', 'OT-000001');
      fixture.detectChanges();
      expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain('Orden guardada');

      vi.advanceTimersByTime(DURACION_TOAST_MS);
      fixture.detectChanges();
      expect(el.textContent).not.toContain('Orden guardada');
    } finally {
      vi.useRealTimers();
    }
  });

  it('se pausa con el puntero encima y se puede cerrar con su botón', async () => {
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    vi.useFakeTimers();
    try {
      const servicio = TestBed.inject(ToastService);
      const el = fixture.nativeElement as HTMLElement;
      servicio.error('No se pudo guardar');
      fixture.detectChanges();
      const toast = el.querySelector('[aria-live] > div')!;

      toast.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(DURACION_TOAST_MS * 2);
      fixture.detectChanges();
      expect(el.textContent).toContain('No se pudo guardar');

      el.querySelector<HTMLButtonElement>('[aria-label="Cerrar"]')!.click();
      fixture.detectChanges();
      expect(servicio.toasts()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('no acumula más de 4 toasts visibles', () => {
    const servicio = TestBed.inject(ToastService);
    for (let i = 0; i < 6; i++) servicio.info(`Aviso ${i}`);

    expect(servicio.toasts().map((t) => t.titulo)).toEqual([
      'Aviso 2',
      'Aviso 3',
      'Aviso 4',
      'Aviso 5',
    ]);
  });
});

describe('HkDropdownMenu', () => {
  @Component({
    imports: [HkDropdownMenu],
    template: `
      <hk-dropdown-menu etiqueta="Acciones" [items]="items" (seleccion)="elegidos.push($event)"
        >Abrir</hk-dropdown-menu
      >
      <hk-dropdown-menu etiqueta="Tema" [items]="items" seleccionado="editar"
        >Tema</hk-dropdown-menu
      >
    `,
  })
  class Anfitrion {
    readonly items: ItemMenu[] = [
      { id: 'editar', etiqueta: 'Editar', icono: 'pencil' },
      { id: 'bloqueado', etiqueta: 'Bloqueado', deshabilitado: true },
      { id: 'eliminar', etiqueta: 'Eliminar', peligro: true, separadorAntes: true },
    ];
    readonly elegidos: string[] = [];
  }

  it('abre un menú accesible, ítems con teclado y emite la selección', async () => {
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    const disparador = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button',
    )!;

    expect(disparador.getAttribute('aria-label')).toBe('Acciones');
    expect(disparador.getAttribute('aria-haspopup')).toBe('menu');
    disparador.click();
    await fixture.whenStable();

    const menu = document.querySelector('[role="menu"]')!;
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    expect(menu.getAttribute('aria-label')).toBe('Acciones');
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Editar', 'Bloqueado', 'Eliminar']);
    expect(items[1].getAttribute('aria-disabled')).toBe('true');
    expect(menu.querySelector('[role="separator"]')).not.toBeNull();

    items[2].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.elegidos).toEqual(['eliminar']);
  });

  it('con `seleccionado` usa menuitemradio con aria-checked', async () => {
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('hk-dropdown-menu > button')[1]
      .click();
    await fixture.whenStable();

    const radios = Array.from(document.querySelectorAll('[role="menuitemradio"]'));
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
  });
});

describe('HkTooltipDirective', () => {
  @Component({
    imports: [HkTooltipDirective],
    template: `<button hkTooltip="Colapsar menú">X</button>`,
  })
  class Anfitrion {}

  it('aparece con foco o hover, se enlaza con aria-describedby y se oculta con Escape', async () => {
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    const boton = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    boton.dispatchEvent(new FocusEvent('focusin'));
    await fixture.whenStable();
    const tooltip = document.querySelector('[role="tooltip"]')!;
    expect(tooltip.textContent).toBe('Colapsar menú');
    expect(boton.getAttribute('aria-describedby')).toBe(tooltip.id);

    tecla(boton, 'Escape');
    await fixture.whenStable();
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    expect(boton.hasAttribute('aria-describedby')).toBe(false);

    boton.dispatchEvent(new MouseEvent('mouseenter'));
    await fixture.whenStable();
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
    boton.dispatchEvent(new MouseEvent('mouseleave'));
    await fixture.whenStable();
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });
});
