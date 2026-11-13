import { expect } from '@playwright/test';

import { crearClienteConMoto, placaUnica } from './datos';
import { apiComoAdmin, crearUsuario } from './sesion';

/** Orden finalizada por la API (sin pago) con un servicio libre de $100.000 + IVA. */
export async function ordenFinalizadaPorApi(): Promise<{
  id: number;
  numero: string;
  placa: string;
  motoId: number;
}> {
  const placa = placaUnica();
  const cliente = await crearClienteConMoto(`Cobro ${placa}`, placa);
  const mecanico = await crearUsuario('MECANICO');
  const { api, token: t } = await apiComoAdmin();
  const headers = { Authorization: `Bearer ${t}` };
  const base = '/api/v1/ordenes-trabajo';
  const creada = await api.post(base, {
    headers,
    data: {
      clienteId: cliente.clienteId,
      motocicletaId: cliente.motoId,
      kilometrajeIngreso: 5000,
      motivoIngreso: 'Mantenimiento',
      descripcionProblema: 'Revisión general',
      mecanicos: [{ mecanicoId: mecanico.id }],
    },
  });
  expect(creada.status()).toBe(201);
  let orden = (await creada.json()) as { id: number; numero: string; version: number };
  const paso = async (ruta: string, data: object, metodo: 'post' | 'put' = 'post') => {
    const r = await api[metodo](`${base}/${orden.id}${ruta}`, { headers, data: { version: orden.version, ...data } });
    expect(r.ok()).toBe(true);
    return r.json();
  };
  orden = await paso('/transiciones', { estado: 'EN_DIAGNOSTICO' });
  orden = await paso('/diagnostico', { diagnostico: 'Cambio de aceite y ajuste de cadena' }, 'put');
  orden = await paso('/servicios', { descripcion: 'Mantenimiento general', precio: 100000 });
  const presupuesto = (await paso('/presupuestos', { descuento: 0 })) as { id: number };
  const decision = await api.post(`/api/v1/presupuestos/${presupuesto.id}/decision`, {
    headers,
    data: { decision: 'APROBADO' },
  });
  expect(decision.ok()).toBe(true);
  orden = await (await api.get(`${base}/${orden.id}`, { headers })).json();
  orden = await paso('/transiciones', { estado: 'FINALIZADA' });
  await api.dispose();
  return { id: orden.id, numero: orden.numero, placa, motoId: cliente.motoId! };
}

/** Orden recibida por la API asignada al mecánico; devuelve su id. */
export async function nuevaOrdenAsignada(mecanicoId: number): Promise<number> {
  const placa = placaUnica();
  const cliente = await crearClienteConMoto(`Movil ${placa}`, placa);
  const { api, token: t } = await apiComoAdmin();
  const respuesta = await api.post('/api/v1/ordenes-trabajo', {
    headers: { Authorization: `Bearer ${t}` },
    data: {
      clienteId: cliente.clienteId,
      motocicletaId: cliente.motoId,
      kilometrajeIngreso: 100,
      motivoIngreso: 'Revisión de frenos delanteros y trasero',
      descripcionProblema: 'Frena largo',
      mecanicos: [{ mecanicoId }],
    },
  });
  expect(respuesta.status()).toBe(201);
  const { id } = (await respuesta.json()) as { id: number };
  await api.dispose();
  return id;
}
