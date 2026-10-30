import { computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map, switchMap, timer } from 'rxjs';

import { erroresManejados } from '../../core/http/contexto-http';
import { OpcionCombobox } from '../../shared/ui/forms/combobox';
import { Proveedor, ProveedoresApiService } from './proveedores-api.service';

const ESPERA_MS = 250;
const RESULTADOS = 10;

/**
 * Opciones de `hk-combobox` para elegir un proveedor buscando en el servidor. `incluir` agrega un
 * proveedor conocido (p. ej. el preseleccionado) para que el combobox muestre su nombre.
 */
export function buscadorProveedores(opciones: { soloActivos: boolean }) {
  const api = inject(ProveedoresApiService);
  const texto = signal('');
  const conocido = signal<Proveedor | null>(null);
  const resultados = rxResource({
    params: () => texto(),
    stream: ({ params }) =>
      timer(params ? ESPERA_MS : 0).pipe(
        switchMap(() =>
          api.listar(
            {
              q: params,
              activo: opciones.soloActivos ? true : null,
              page: 0,
              size: RESULTADOS,
              sort: 'razonSocial,asc',
            },
            erroresManejados(),
          ),
        ),
        map((pagina) => pagina.content),
      ),
  });

  return {
    opciones: computed<OpcionCombobox[]>(() => {
      const lista = resultados.value() ?? [];
      const extra = conocido();
      const todos = extra && !lista.some((p) => p.id === extra.id) ? [extra, ...lista] : lista;
      return todos.map((p) => ({
        valor: String(p.id),
        etiqueta: p.razonSocial,
        descripcion: `${p.tipoDocumento} ${p.numeroDocumento}`,
      }));
    }),
    cargando: resultados.isLoading,
    buscar: (consulta: string) => texto.set(consulta.trim()),
    incluir: (proveedor: Proveedor) => conocido.set(proveedor),
  };
}
