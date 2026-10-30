import { expect } from '@playwright/test';

import { apiComoAdmin } from './sesion';

const LETRAS = 'ABCDEFGHJKLMNPRSTUVWXYZ';
const PESOS_NIT = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

const azar = (n: number) => Math.floor(Math.random() * n);
const digitos = (n: number) => Array.from({ length: n }, () => azar(10)).join('');
const letras = (n: number) => Array.from({ length: n }, () => LETRAS[azar(LETRAS.length)]).join('');

/** Placa de moto actual (`ABC12D`) casi seguro irrepetible: las pruebas comparten la BD. */
export const placaUnica = () => letras(3) + digitos(2) + letras(1);

export const cedulaUnica = () => '1' + digitos(9);

/** NIT de 9 dígitos sin DV. */
export const nitUnico = () => '8' + digitos(8);

/** DV DIAN (RN-39), para comprobar el que calcula la interfaz. */
export function dvNit(nit: string): number {
  const suma = [...nit].reverse().reduce((total, d, i) => total + Number(d) * PESOS_NIT[i], 0);
  const residuo = suma % 11;
  return residuo < 2 ? residuo : 11 - residuo;
}

/** Crea por la API un cliente con cédula y, si se pide, una moto suya. */
export async function crearClienteConMoto(
  nombres: string,
  placa?: string,
): Promise<{ clienteId: number; motoId?: number; nombreCompleto: string }> {
  const { api, token } = await apiComoAdmin();
  const headers = { Authorization: `Bearer ${token}` };
  const cliente = await api.post('/api/v1/clientes', {
    headers,
    data: {
      tipoDocumento: 'CC',
      numeroDocumento: cedulaUnica(),
      nombres,
      apellidos: 'E2E',
      telefono: '3001234567',
      aceptaTratamientoDatos: true,
    },
  });
  expect(cliente.status()).toBe(201);
  const { id: clienteId } = (await cliente.json()) as { id: number };
  let motoId: number | undefined;
  if (placa) {
    const moto = await api.post('/api/v1/motocicletas', {
      headers,
      data: { clienteId, placa, marca: 'Honda', modelo: 'CB 190R' },
    });
    expect(moto.status()).toBe(201);
    motoId = ((await moto.json()) as { id: number }).id;
  }
  await api.dispose();
  return { clienteId, motoId, nombreCompleto: `${nombres} E2E` };
}

/** Crea por la API un producto activo sin stock en la primera categoría activa. */
export async function crearProducto(nombre: string): Promise<{ id: number; codigo: string; nombre: string }> {
  const { api, token } = await apiComoAdmin();
  const headers = { Authorization: `Bearer ${token}` };
  const categorias = (await (await api.get('/api/v1/categorias?activo=true', { headers })).json()) as {
    id: number;
  }[];
  const codigo = `E2E-${letras(3)}${digitos(5)}`;
  const respuesta = await api.post('/api/v1/productos', {
    headers,
    data: {
      codigo,
      nombre,
      categoriaId: categorias[0].id,
      unidad: 'UNIDAD',
      precioVenta: 50000,
      stockMinimo: 1,
    },
  });
  expect(respuesta.status()).toBe(201);
  const { id } = (await respuesta.json()) as { id: number };
  await api.dispose();
  return { id, codigo, nombre };
}
