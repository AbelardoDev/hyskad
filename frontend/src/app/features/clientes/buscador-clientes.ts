import { computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map, switchMap, timer } from 'rxjs';

import { erroresManejados } from '../../core/http/contexto-http';
import { OpcionCombobox } from '../../shared/ui/forms/combobox';
import { ClientesApiService } from './clientes-api.service';

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

  const opciones = computed<OpcionCombobox[]>(() =>
    (resultados.value() ?? [])
      .filter((c) => c.id !== excluir)
      .map((c) => ({
        valor: String(c.id),
        etiqueta: c.nombreCompleto,
        descripcion: `${c.tipoDocumento} ${c.numeroDocumento} · ${c.telefono}`,
      })),
  );

  return {
    opciones,
    cargando: resultados.isLoading,
    buscar: (consulta: string) => texto.set(consulta.trim()),
  };
}
