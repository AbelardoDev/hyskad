import { computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map, switchMap, timer } from 'rxjs';

import { erroresManejados } from '../../core/http/contexto-http';
import { OpcionCombobox } from '../../shared/ui/forms/combobox';
import { ClienteResumen, ClientesApiService } from './clientes-api.service';

const ESPERA_MS = 250;
const RESULTADOS = 10;

/**
 * Opciones de `hk-combobox` para elegir un cliente activo buscando en el servidor (nombre,
 * documento o teléfono). Llamar en un contexto de inyección; `excluir` deja fuera un cliente
 * (p. ej. el propietario actual al cambiarlo).
 */
export function buscadorClientes(excluir?: number) {
  const api = inject(ClientesApiService);
  const texto = signal('');
  const conocido = signal<Pick<
    ClienteResumen,
    'id' | 'nombreCompleto' | 'tipoDocumento' | 'numeroDocumento' | 'telefono'
  > | null>(null);
  const resultados = rxResource({
    params: () => texto(),
    stream: ({ params }) =>
      timer(params ? ESPERA_MS : 0).pipe(
        switchMap(() =>
          api.listar(
            { q: params, activo: true, page: 0, size: RESULTADOS, sort: 'nombreCompleto,asc' },
            erroresManejados(),
          ),
        ),
        map((pagina) => pagina.content),
      ),
  });

  const opciones = computed<OpcionCombobox[]>(() => {
    const lista = resultados.value() ?? [];
    const extra = conocido();
    return (extra && !lista.some((c) => c.id === extra.id) ? [extra, ...lista] : lista)
      .filter((c) => c.id !== excluir)
      .map((c) => ({
        valor: String(c.id),
        etiqueta: c.nombreCompleto,
        descripcion: `${c.tipoDocumento} ${c.numeroDocumento} · ${c.telefono}`,
      }));
  });

  return {
    opciones,
    cargando: resultados.isLoading,
    buscar: (consulta: string) => texto.set(consulta.trim()),
    /** Agrega un cliente conocido (p. ej. recién creado) para que el combobox muestre su nombre. */
    incluir: (cliente: Parameters<typeof conocido.set>[0]) => conocido.set(cliente),
  };
}
