import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideRouter } from '@angular/router';

import { iniciarSesionDePrueba } from '../../core/auth/sesion-de-prueba';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { Producto } from '../inventario/inventario-api.service';
import { cambioEfectivo, hastaDisponible, PuntoVentaPage } from './punto-venta-page';

const producto = (id: number, nombre: string, precio: number, disponible: number): Producto => ({
  id,
  codigo: `P-${id}`,
  nombre,
  descripcion: null,
  marca: null,
  categoria: { id: 1, nombre: 'Filtros' },
  unidad: 'UNIDAD',
  precioVenta: precio,
  stockActual: disponible,
  stockReservado: 0,
  stockDisponible: disponible,
  stockMinimo: 0,
  estadoStock: 'OK',
  activo: true,
  createdAt: '2026-10-30T00:00:00Z',
});

describe('reglas del punto de venta', () => {
  it('no deja vender más de lo disponible (RN-19)', () => {
    expect(hastaDisponible(3)(new FormControl('3'))).toBeNull();
    expect(hastaDisponible(3)(new FormControl('3,5'))).toEqual({ maxDisponible: { max: 3 } });
  });

  it('el cambio es lo recibido menos el total', () => {
    expect(cambioEfectivo(100000, 95200)).toBe(4800);
    expect(cambioEfectivo(90000, 95200)).toBe(-5200);
    expect(cambioEfectivo(null, 95200)).toBeNull();
  });
});

describe('PuntoVentaPage', () => {
  async function montar() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    iniciarSesionDePrueba();
    const fixture = TestBed.createComponent(PuntoVentaPage);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/configuracion/iva').flush({ porcentaje: 19 });
    await new Promise((r) => setTimeout(r));
    http
      .match((r) => r.url === '/api/v1/clientes')
      .forEach((r) => r.flush({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buscador = el.querySelector<HTMLInputElement>('#buscador-pos input')!;

    /** Escribe en el buscador, responde la búsqueda y pulsa Enter. */
    const agregarConTeclado = async (texto: string, resultados: Producto[]) => {
      buscador.value = texto;
      buscador.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 250));
      http
        .expectOne((r) => r.url === '/api/v1/productos' && r.params.get('q') === texto)
        .flush({
          content: resultados,
          page: 0,
          size: 8,
          totalElements: resultados.length,
          totalPages: 1,
        });
      fixture.detectChanges();
      await fixture.whenStable();
      buscador.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();
    };
    return { fixture, http, el, agregarConTeclado };
  }

  it('Enter agrega el primer resultado, repetirlo suma y los totales salen como en el backend', async () => {
    const { el, agregarConTeclado } = await montar();
    const filtro = producto(1, 'Filtro de aceite', 16000, 2);
    await agregarConTeclado('fil', [filtro, producto(2, 'Filtro de aire', 19000, 5)]);
    await agregarConTeclado('fil', [filtro]);
    // No pasa del disponible (2)
    await agregarConTeclado('fil', [filtro]);

    const cantidad = el.querySelector<HTMLInputElement>('[formarrayname="items"] input')!;
    expect(cantidad.value).toBe('2');
    // 2 × 16.000 = 32.000 + IVA 19 % 6.080 = 38.080
    expect(el.textContent?.replace(/\s/g, '')).toContain('$38.080');
  });

  it('cobra con F9 y envía solo producto y cantidad (sin precios) con el monto recibido', async () => {
    const { el, fixture, http, agregarConTeclado } = await montar();
    const pedir = vi.spyOn(TestBed.inject(ConfirmacionService), 'pedir').mockResolvedValue({});
    await agregarConTeclado('buj', [producto(7, 'Bujía', 13000, 40)]);
    const recibido = Array.from(el.querySelectorAll<HTMLInputElement>('hk-money-input input')).at(
      -1,
    )!;
    recibido.value = '20000';
    recibido.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    // 13.000 + 2.470 = 15.470 → cambio 4.530
    expect(el.textContent?.replace(/\s/g, '')).toContain('$4.530');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F9' }));
    await new Promise((r) => setTimeout(r));

    expect(pedir).toHaveBeenCalled();
    const req = http.expectOne((r) => r.url === '/api/v1/ventas' && r.method === 'POST');
    expect(req.request.body).toEqual({
      clienteId: null,
      items: [{ productoId: 7, cantidad: 1 }],
      descuento: 0,
      metodoPago: 'EFECTIVO',
      referenciaPago: null,
      montoRecibido: 20000,
    });
  });
});
