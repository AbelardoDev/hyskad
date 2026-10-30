import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideRouter, Router } from '@angular/router';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { iniciarSesionDePrueba } from '../../core/auth/sesion-de-prueba';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { HkDiagnosticoForm } from './diagnostico-form';
import { EnviarPresupuestoModal } from './enviar-presupuesto-modal';
import { HkItemsOrden } from './items-orden';
import { noMenorQue } from './nueva-orden-page';
import { OrdenDetallePage } from './orden-detalle-page';
import { accionTransicion } from './orden-ui';
import { Orden, OrdenResumen } from './ordenes-api.service';
import { OrdenesPage } from './ordenes-page';

const API = '/api/v1/ordenes-trabajo';

function orden(cambios: Partial<Orden> = {}): Orden {
  return {
    id: 5,
    numero: 'OT-000005',
    estado: 'RECIBIDA',
    version: 3,
    fechaIngreso: '2026-10-30T14:00:00Z',
    kilometrajeIngreso: 15200,
    motivoIngreso: 'Mantenimiento',
    descripcionProblema: 'Ruido en la cadena',
    observaciones: null,
    diagnostico: null,
    observacionesDiagnostico: null,
    kilometrajeInspeccion: null,
    cliente: {
      id: 2,
      nombreCompleto: 'Carlos Pérez',
      tipoDocumento: 'CC',
      numeroDocumento: '1067845123',
      telefono: '3004567812',
    },
    motocicleta: {
      id: 9,
      placa: 'ABC12D',
      marca: 'Yamaha',
      modelo: 'FZ 150',
      anio: 2022,
      color: null,
    },
    mecanicos: [],
    historial: [
      {
        estadoAnterior: null,
        estadoNuevo: 'RECIBIDA',
        nota: null,
        usuario: { id: 1, nombre: 'Ana Admin' },
        fecha: '2026-10-30T14:00:00Z',
      },
    ],
    creadaPor: { id: 1, nombre: 'Ana Admin' },
    servicios: [],
    repuestos: [],
    subtotal: 0,
    descuento: 0,
    ivaPorcentaje: 19,
    impuesto: 0,
    total: 0,
    fechaFinalizacion: null,
    accionesPermitidas: {
      editar: true,
      asignarMecanicos: true,
      registrarDiagnostico: false,
      editarItems: false,
      gestionarPresupuestos: false,
      transiciones: [
        { estado: 'EN_DIAGNOSTICO', requiereNota: false, bloqueo: 'SIN_MECANICOS' },
        { estado: 'CANCELADA', requiereNota: true, bloqueo: null },
      ],
    },
    ...cambios,
  };
}

const resumen = (id: number, estado: OrdenResumen['estado']): OrdenResumen => ({
  id,
  numero: `OT-00000${id}`,
  estado,
  fechaIngreso: '2026-10-30T14:00:00Z',
  placa: 'ABC12D',
  moto: 'Yamaha FZ 150',
  cliente: 'Carlos Pérez',
  mecanicos: [{ id: 4, nombre: 'Mario Mecánico' }],
});

function configurar() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  iniciarSesionDePrueba();
  return TestBed.inject(HttpTestingController);
}

const texto = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('reglas de la orden en el front', () => {
  it('cada transición tiene su nombre según el estado de origen', () => {
    expect(accionTransicion('RECIBIDA', 'EN_DIAGNOSTICO').clave).toBe('iniciar_diagnostico');
    expect(accionTransicion('EN_REPARACION', 'EN_DIAGNOSTICO').clave).toBe('requiere_ajuste');
    expect(accionTransicion('PENDIENTE_APROBACION', 'EN_DIAGNOSTICO').clave).toBe(
      'retirar_presupuesto',
    );
    expect(accionTransicion('EN_REPARACION', 'CANCELADA').variante).toBe('danger');
  });

  it('el kilometraje no baja de la última lectura (RN-25)', () => {
    const validar = noMenorQue(() => 12000);
    expect(validar(new FormControl('11999'))).toEqual({ kilometrajeMenor: { minimo: 12000 } });
    expect(validar(new FormControl('12000'))).toBeNull();
    expect(noMenorQue(() => null)(new FormControl('1'))).toBeNull();
  });
});

describe('OrdenDetallePage', () => {
  async function montar(o: Orden) {
    const http = configurar();
    const fixture = TestBed.createComponent(OrdenDetallePage);
    fixture.componentRef.setInput('id', o.id);
    fixture.detectChanges();
    http.expectOne(`${API}/${o.id}`).flush(o);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const boton = (nombre: string) =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => texto(b) === nombre);
    return { fixture, http, el, boton };
  }

  it('muestra solo las acciones que manda el backend y explica las bloqueadas', async () => {
    const { el, boton } = await montar(orden());
    expect(boton('Iniciar diagnóstico')?.disabled).toBe(true);
    expect(el.textContent).toContain('Asigna al menos un mecánico');
    expect(boton('Cancelar orden')?.disabled).toBe(false);
    expect(boton('Finalizar')).toBeUndefined();
    const pestanas = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(pestanas.find((p) => texto(p).startsWith('Servicios y repuestos'))?.disabled).toBe(
      false,
    );
    expect(pestanas.find((p) => texto(p).startsWith('Pago y entrega'))?.disabled).toBe(true);
    expect(pestanas.find((p) => texto(p).startsWith('Diagnóstico'))?.disabled).toBe(false);
  });

  it('cancelar pide el motivo y lo envía con la versión leída', async () => {
    const { fixture, http, el, boton } = await montar(orden());
    const pedir = vi
      .spyOn(TestBed.inject(ConfirmacionService), 'pedir')
      .mockResolvedValue({ motivo: 'El cliente desiste' });

    boton('Cancelar orden')!.click();
    await new Promise((r) => setTimeout(r));

    expect(pedir).toHaveBeenCalledWith(
      expect.objectContaining({ pedirMotivo: true, peligrosa: true }),
    );
    const req = http.expectOne(`${API}/5/transiciones`);
    expect(req.request.body).toEqual({
      version: 3,
      estado: 'CANCELADA',
      nota: 'El cliente desiste',
    });
    req.flush(
      orden({
        estado: 'CANCELADA',
        version: 4,
        accionesPermitidas: {
          editar: false,
          asignarMecanicos: false,
          registrarDiagnostico: false,
          editarItems: false,
          gestionarPresupuestos: false,
          transiciones: [],
        },
      }),
    );
    fixture.detectChanges();
    expect(texto(el.querySelector('hk-status-badge')!)).toBe('Cancelada');
    expect(boton('Cancelar orden')).toBeUndefined();
  });
});

describe('HkDiagnosticoForm', () => {
  it('valida el kilometraje de inspección contra el de ingreso y envía la versión', async () => {
    const http = configurar();
    const fixture = TestBed.createComponent(HkDiagnosticoForm);
    fixture.componentRef.setInput(
      'orden',
      orden({
        estado: 'EN_DIAGNOSTICO',
        accionesPermitidas: {
          editar: true,
          asignarMecanicos: true,
          registrarDiagnostico: true,
          editarItems: false,
          gestionarPresupuestos: false,
          transiciones: [],
        },
      }),
    );
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const textarea = el.querySelector('textarea')!;
    const km = el.querySelector<HTMLInputElement>('input')!;
    textarea.value = 'Cadena estirada';
    textarea.dispatchEvent(new Event('input'));
    km.value = '15000';
    km.dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(el.textContent).toContain('No puede ser menor que 15200 km');
    http.expectNone(`${API}/5/diagnostico`);

    km.value = '15300';
    km.dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    const req = http.expectOne(`${API}/5/diagnostico`);
    expect(req.request.body).toEqual({
      version: 3,
      diagnostico: 'Cadena estirada',
      observaciones: null,
      kilometrajeInspeccion: 15300,
    });
  });
});

describe('OrdenesPage', () => {
  async function montar() {
    const http = configurar();
    const fixture = TestBed.createComponent(OrdenesPage);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r));
    const responder = () => {
      http
        .match((r) => r.url === API)
        .forEach((r) =>
          r.flush({
            content: [resumen(1, 'RECIBIDA'), resumen(2, 'EN_DIAGNOSTICO')],
            page: 0,
            size: 20,
            totalElements: 2,
            totalPages: 1,
          }),
        );
      http
        .match(`${API}/resumen-estados`)
        .forEach((r) => r.flush({ RECIBIDA: 1, EN_DIAGNOSTICO: 1 }));
      http.match('/api/v1/usuarios/mecanicos').forEach((r) => r.flush([]));
      fixture.detectChanges();
    };
    responder();
    return { fixture, http, el: fixture.nativeElement as HTMLElement, responder };
  }

  it('los estados elegidos van a la URL y al backend', async () => {
    const { fixture, http, el } = await montar();
    const chip = Array.from(el.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')).find(
      (b) => texto(b).startsWith('En diagnóstico'),
    )!;
    chip.click();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();

    expect(TestBed.inject(Router).url).toContain('estado=EN_DIAGNOSTICO');
    const req = http.expectOne((r) => r.url === API);
    expect(req.request.params.getAll('estado')).toEqual(['EN_DIAGNOSTICO']);
    expect(req.request.params.get('page')).toBe('0');
  });

  it('el kanban reparte las órdenes en columnas por estado', async () => {
    const { fixture, el, responder } = await montar();
    const kanban = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => texto(b) === 'Tablero',
    )!;
    kanban.click();
    await new Promise((r) => setTimeout(r));
    responder();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();

    const columnas = Array.from(el.querySelectorAll('section[aria-labelledby^="kanban-"]'));
    expect(columnas).toHaveLength(7);
    const recibidas = columnas.find(
      (c) => c.getAttribute('aria-labelledby') === 'kanban-RECIBIDA',
    )!;
    expect(recibidas.querySelectorAll('a')).toHaveLength(1);
    const entregadas = columnas.find(
      (c) => c.getAttribute('aria-labelledby') === 'kanban-ENTREGADA',
    )!;
    expect(texto(entregadas)).toContain('Sin órdenes');
  });
});

/** Orden en diagnóstico con un servicio y un repuesto, editable. */
function conItems(cambios: Partial<Orden> = {}): Orden {
  return orden({
    estado: 'EN_DIAGNOSTICO',
    diagnostico: 'Frenos gastados',
    servicios: [
      {
        id: 11,
        servicioId: 3,
        descripcion: 'Mantenimiento de frenos',
        precio: 45000,
        tiempoMin: 60,
        mecanico: null,
      },
    ],
    repuestos: [
      {
        id: 21,
        productoId: 7,
        codigo: 'PAS-01',
        nombre: 'Pastillas delanteras',
        unidad: 'UNIDAD',
        cantidad: 2,
        precioUnitario: 25000,
        subtotal: 50000,
        stockDisponible: 8,
        stockMinimo: 2,
      },
    ],
    subtotal: 95000,
    impuesto: 18050,
    total: 113050,
    accionesPermitidas: {
      editar: true,
      asignarMecanicos: true,
      registrarDiagnostico: true,
      editarItems: true,
      gestionarPresupuestos: true,
      transiciones: [{ estado: 'PENDIENTE_APROBACION', requiereNota: false, bloqueo: null }],
    },
    ...cambios,
  });
}

describe('HkItemsOrden', () => {
  function montar(o: Orden) {
    const http = configurar();
    const fixture = TestBed.createComponent(HkItemsOrden);
    fixture.componentRef.setInput('orden', o);
    fixture.detectChanges();
    return { fixture, http, el: fixture.nativeElement as HTMLElement };
  }

  it('cambiar la cantidad de un repuesto envía la nueva cantidad con la versión', () => {
    const { el, http } = montar(conItems());
    expect(texto(el).replace(/\s/g, '')).toContain('$113.050');
    const cantidad = el.querySelector<HTMLInputElement>(
      'input[aria-label="Cantidad de Pastillas delanteras"]',
    )!;
    cantidad.value = '5';
    cantidad.dispatchEvent(new Event('input'));
    cantidad.dispatchEvent(new Event('change', { bubbles: true }));

    const req = http.expectOne(`${API}/5/repuestos/21`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ version: 3, cantidad: 5 });
  });

  it('fuera de diagnóstico es de solo lectura y explica por qué', () => {
    const { el } = montar(
      conItems({
        estado: 'EN_REPARACION',
        accionesPermitidas: { ...conItems().accionesPermitidas, editarItems: false },
      }),
    );
    expect(el.textContent).toContain('solo se modifican mientras la orden está en diagnóstico');
    expect(el.querySelector('input')).toBeNull();
    expect(texto(el)).not.toContain('Agregar repuesto');
  });
});

describe('EnviarPresupuestoModal', () => {
  it('muestra los totales con el descuento y envía descuento, observaciones y versión', async () => {
    const cerrar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: DialogRef, useValue: { close: cerrar } },
        { provide: DIALOG_DATA, useValue: conItems() },
      ],
    });
    const fixture = TestBed.createComponent(EnviarPresupuestoModal);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const descuento = el.querySelector<HTMLInputElement>('hk-money-input input')!;
    descuento.value = '5000';
    descuento.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    // 95.000 − 5.000 = 90.000 + IVA 17.100 = 107.100
    expect(texto(el).replace(/\s/g, '')).toContain('$107.100');

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    const req = TestBed.inject(HttpTestingController).expectOne(`${API}/5/presupuestos`);
    expect(req.request.body).toEqual({ version: 3, descuento: 5000, observaciones: null });
  });
});
