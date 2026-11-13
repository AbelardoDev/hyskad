import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideRouter } from '@angular/router';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { iniciarSesionDePrueba } from '../../core/auth/sesion-de-prueba';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { NavegacionService } from '../../core/layout/navegacion.service';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { exigirReferenciaSalvoEfectivo, MetodoPago } from '../../shared/ui/forms/campos-pago';
import { tonoAntiguedad } from '../reportes/cuentas-pendientes-page';
import { agruparMisOrdenes } from './mis-ordenes-page';
import { Orden, OrdenResumen } from './ordenes-api.service';
import { HkPagoEntregaOrden } from './pago-entrega-orden';

const API = '/api/v1/ordenes-trabajo';

function orden(cambios: Partial<Orden> = {}): Orden {
  return {
    id: 7,
    numero: 'OT-000007',
    estado: 'FINALIZADA',
    version: 9,
    fechaIngreso: '2026-11-10T14:00:00Z',
    kilometrajeIngreso: 15200,
    motivoIngreso: 'Mantenimiento',
    descripcionProblema: 'Ruido en la cadena',
    observaciones: null,
    diagnostico: 'Cadena destensionada',
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
    historial: [],
    creadaPor: null,
    servicios: [],
    repuestos: [],
    subtotal: 100000,
    descuento: 0,
    ivaPorcentaje: 19,
    impuesto: 19000,
    total: 119000,
    fechaFinalizacion: '2026-11-11T14:00:00Z',
    pago: null,
    entrega: null,
    accionesPermitidas: {
      editar: false,
      asignarMecanicos: false,
      registrarDiagnostico: false,
      editarItems: false,
      gestionarPresupuestos: true,
      registrarPago: true,
      registrarEntrega: false,
      transiciones: [{ estado: 'ENTREGADA', requiereNota: false, bloqueo: 'SIN_PAGO' }],
    },
    ...cambios,
  };
}

const resumen = (id: number, estado: OrdenResumen['estado']): OrdenResumen => ({
  id,
  numero: `OT-00000${id}`,
  estado,
  fechaIngreso: '2026-11-10T14:00:00Z',
  placa: 'ABC12D',
  moto: 'Yamaha FZ 150',
  cliente: 'Carlos Pérez',
  motivoIngreso: 'Mantenimiento',
  mecanicos: [],
});

function configurar(permisos?: string[]) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  iniciarSesionDePrueba(permisos ? { rol: 'MECANICO', permisos } : {});
  return TestBed.inject(HttpTestingController);
}

const texto = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('reglas de pago y entrega en el front', () => {
  it('la referencia es obligatoria salvo en efectivo (RN-20)', () => {
    const metodo = new FormControl<MetodoPago>('EFECTIVO', { nonNullable: true });
    const referencia = new FormControl('', { nonNullable: true });
    exigirReferenciaSalvoEfectivo(metodo, referencia);
    expect(referencia.valid).toBe(true);
    metodo.setValue('TRANSFERENCIA');
    expect(referencia.hasError('required')).toBe(true);
    metodo.setValue('EFECTIVO');
    expect(referencia.valid).toBe(true);
  });

  it('la antigüedad de la deuda se colorea por días (RN-37)', () => {
    expect(tonoAntiguedad(0)).toBe('neutral');
    expect(tonoAntiguedad(3)).toBe('neutral');
    expect(tonoAntiguedad(4)).toBe('warning');
    expect(tonoAntiguedad(7)).toBe('warning');
    expect(tonoAntiguedad(8)).toBe('danger');
  });

  it('"Mis órdenes" se agrupa por estado en el orden de trabajo y sin grupos vacíos', () => {
    const grupos = agruparMisOrdenes([
      resumen(1, 'EN_REPARACION'),
      resumen(2, 'RECIBIDA'),
      resumen(3, 'EN_DIAGNOSTICO'),
    ]);
    expect(grupos.map((g) => g.clave)).toEqual(['por_diagnosticar', 'en_reparacion']);
    expect(grupos[0].ordenes.map((o) => o.id)).toEqual([2, 3]);
  });

  it('quien solo ve sus órdenes empieza en "Mis órdenes"; quien ve todas, en el inicio', () => {
    configurar(['DASHBOARD_VER', 'CLIENTES_VER', 'MOTOS_VER', 'ORDENES_VER_ASIGNADAS']);
    expect(TestBed.inject(NavegacionService).rutaInicio()).toBe('/ordenes/mias');
  });

  it('el administrador empieza en el dashboard', () => {
    configurar();
    expect(TestBed.inject(NavegacionService).rutaInicio()).toBe('/dashboard');
  });
});

describe('HkPagoEntregaOrden', () => {
  async function montar(o: Orden) {
    const http = configurar();
    const fixture = TestBed.createComponent(HkPagoEntregaOrden);
    fixture.componentRef.setInput('orden', o);
    const emitidas: Orden[] = [];
    fixture.componentInstance.cambio.subscribe((x) => emitidas.push(x));
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const boton = (inicio: string) =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
        texto(b).startsWith(inicio),
      );
    return { fixture, http, el, boton, emitidas };
  }

  it('cobra exactamente el total en efectivo, con lo recibido y sin referencia', async () => {
    const { fixture, http, el, boton, emitidas } = await montar(orden());
    vi.spyOn(TestBed.inject(ConfirmacionService), 'pedir').mockResolvedValue({});
    expect(texto(el)).toContain('Total a pagar');

    const recibido = el.querySelector<HTMLInputElement>('hk-money-input input')!;
    recibido.value = '120000';
    recibido.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(texto(el)).toContain('Cambio');

    boton('Cobrar')!.click();
    await new Promise((r) => setTimeout(r));
    const req = http.expectOne(`${API}/7/pago`);
    expect(req.request.body).toEqual({
      monto: 119000,
      metodo: 'EFECTIVO',
      referencia: null,
      montoRecibido: 120000,
    });
    const pagada = orden({
      pago: {
        monto: 119000,
        metodo: 'EFECTIVO',
        referencia: null,
        montoRecibido: 120000,
        cambio: 1000,
        fecha: '2026-11-12T15:00:00Z',
        usuario: { id: 1, nombre: 'Ana Admin' },
      },
    });
    req.flush(pagada);
    expect(emitidas).toEqual([pagada]);
  });

  it('con transferencia no envía sin referencia', async () => {
    const { fixture, http, el, boton } = await montar(orden());
    const transferencia = Array.from(el.querySelectorAll<HTMLLabelElement>('label')).find(
      (l) => texto(l) === 'Transferencia',
    )!;
    transferencia.click();
    fixture.detectChanges();

    boton('Cobrar')!.click();
    await new Promise((r) => setTimeout(r));
    http.expectNone(`${API}/7/pago`);
  });

  it('pagada, registra la entrega con las observaciones', async () => {
    const pagada = orden({
      pago: {
        monto: 119000,
        metodo: 'TARJETA',
        referencia: 'AUT-1',
        montoRecibido: null,
        cambio: null,
        fecha: '2026-11-12T15:00:00Z',
        usuario: null,
      },
      accionesPermitidas: {
        ...orden().accionesPermitidas,
        registrarPago: false,
        registrarEntrega: true,
      },
    });
    const { fixture, http, el, boton } = await montar(pagada);
    vi.spyOn(TestBed.inject(ConfirmacionService), 'pedir').mockResolvedValue({});
    expect(el.querySelector('a[href="/ordenes/7/comprobante"]')).not.toBeNull();

    const area = el.querySelector<HTMLTextAreaElement>('textarea')!;
    area.value = 'Se entrega lavada';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    boton('Registrar entrega')!.click();
    await new Promise((r) => setTimeout(r));
    const req = http.expectOne(`${API}/7/entrega`);
    expect(req.request.body).toEqual({ observaciones: 'Se entrega lavada' });
  });

  it('entregada, muestra el éxito y el botón del comprobante', async () => {
    const { el } = await montar(
      orden({
        estado: 'ENTREGADA',
        entrega: {
          fecha: '2026-11-12T16:00:00Z',
          usuario: { id: 1, nombre: 'Ana Admin' },
          observaciones: null,
        },
      }),
    );
    expect(texto(el)).toContain('Orden OT-000007 entregada');
    expect(texto(el)).toContain('Ana Admin');
    expect(el.querySelector('a[href="/ordenes/7/comprobante"]')).not.toBeNull();
  });

  it('sin finalizar, explica que el pago llega después', async () => {
    const { el } = await montar(orden({ estado: 'EN_REPARACION' }));
    expect(texto(el)).toContain('El pago se registra con la orden finalizada');
    expect(el.querySelector('form')).toBeNull();
  });
});
