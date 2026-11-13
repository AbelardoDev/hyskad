import { TranslocoService } from '@jsverse/transloco';

import { Notificacion, TipoNotificacion } from './notificaciones-api.service';

/** Ícono de cada tipo de notificación (registrados en `shared/ui/iconos.ts`). */
export const ICONO_NOTIFICACION: Record<TipoNotificacion, string> = {
  ORDEN_CREADA: 'inbox',
  MECANICO_ASIGNADO: 'wrench',
  ESTADO_ORDEN_CAMBIADO: 'arrow-left-right',
  PRESUPUESTO_ENVIADO: 'hourglass',
  PRESUPUESTO_APROBADO: 'circle-check',
  PRESUPUESTO_RECHAZADO: 'circle-x',
  ORDEN_FINALIZADA: 'package',
  ORDEN_ENTREGADA: 'package-check',
  STOCK_BAJO: 'triangle-alert',
  VENTA_ANULADA: 'shopping-cart',
};

/** Parámetros con el estado de la orden traducido (llega como `EN_DIAGNOSTICO`). */
function parametros(n: Notificacion, transloco: TranslocoService): Record<string, string | number> {
  const p = { ...n.parametros };
  if (typeof p['estado'] === 'string')
    p['estado'] = transloco.translate(`estados.orden.${p['estado']}`);
  return p;
}

/** Título y mensaje de la notificación en el idioma activo. */
export function textoNotificacion(
  n: Notificacion,
  transloco: TranslocoService,
): { titulo: string; mensaje: string } {
  const p = parametros(n, transloco);
  return {
    titulo: transloco.translate(n.tituloClave, p),
    mensaje: transloco.translate(n.mensajeClave, p),
  };
}
