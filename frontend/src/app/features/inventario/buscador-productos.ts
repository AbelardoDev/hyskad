import { computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { translateSignal } from '@jsverse/transloco';
import { map, switchMap, timer } from 'rxjs';

import { erroresManejados } from '../../core/http/contexto-http';
import { formatoCantidad } from '../../core/utils/formato';
import { LanguageService } from '../../core/i18n/language.service';
import { OpcionCombobox } from '../../shared/ui/forms/combobox';
import { InventarioApiService, Producto } from './inventario-api.service';

const ESPERA_MS = 250;
const RESULTADOS = 10;

/**
 * Opciones de `hk-combobox` para elegir un producto buscando en el servidor (código, nombre o
 * marca), con el disponible visible. Recuerda los productos vistos para que `producto(id)` siga
 * respondiendo aunque cambie la búsqueda. Llamar en un contexto de inyección.
 */
export function buscadorProductos(opciones: { soloActivos: boolean }) {
  const api = inject(InventarioApiService);
  const idioma = inject(LanguageService);
  const texto = signal('');
  const vistos = signal(new Map<number, Producto>());
  const resultados = rxResource({
    params: () => texto(),
    stream: ({ params }) =>
      timer(params ? ESPERA_MS : 0).pipe(
        switchMap(() =>
          api.productos(
            {
              q: params,
              categoriaId: null,
              activo: opciones.soloActivos ? true : null,
              soloStockBajo: false,
              page: 0,
              size: RESULTADOS,
              sort: 'nombre,asc',
            },
            erroresManejados(),
          ),
        ),
        map((pagina) => {
          vistos.update((m) => new Map([...m, ...pagina.content.map((p) => [p.id, p] as const)]));
          return pagina.content;
        }),
      ),
  });
  const textoDisponible = translateSignal('inventario.ajuste.disponible_opcion');

  return {
    opciones: computed<OpcionCombobox[]>(() =>
      (resultados.value() ?? []).map((p) => ({
        valor: String(p.id),
        etiqueta: p.nombre,
        descripcion: `${p.codigo} · ${textoDisponible()} ${formatoCantidad(p.stockDisponible, idioma.locale())}`,
      })),
    ),
    cargando: resultados.isLoading,
    buscar: (consulta: string) => texto.set(consulta.trim()),
    producto: (id: string | null) => (id ? (vistos().get(Number(id)) ?? null) : null),
  };
}
