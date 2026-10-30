# F10 — Notificaciones en tiempo real, correos y auditoría

**Rama:** `feature/f10-notificaciones`
**Requisitos:** RF30, RF31 · IC5 · RNF Trazabilidad, Observabilidad, Privacidad · RN-14, RN-45, RN-51 · Tabla de `BUSINESS-RULES.md` §9
**Lee antes:** `CLAUDE.md`, `docs/ARCHITECTURE.md` §6 (Observer) y §7, `docs/BUSINESS-RULES.md` §9 y §10

## Prompt

Ejecuta la fase F10 de HYSKAD: notificaciones internas en tiempo real (SSE), correos a usuarios y clientes, y la consulta de auditoría. Muéstrame un plan corto y espera mi OK.

### Backend
- Migración: `notificacion` (índice por `usuario_id, leida, fecha`).
- **`NotificacionListener`** con `@TransactionalEventListener(phase = AFTER_COMMIT)` + `@Async` para cada evento de la tabla de `BUSINESS-RULES.md` §9. Resuelve destinatarios (por rol, por asignación o por creador), guarda una notificación por destinatario con `titulo_clave`, `mensaje_clave`, `parametros` (JSON) y `enlace` (ruta del front), y la empuja por SSE si el usuario está conectado.
- **SSE**:
  - `POST /notificaciones/stream-ticket` (autenticado) → ticket aleatorio de un solo uso válido 30 s, guardado en memoria.
  - `GET /notificaciones/stream?ticket=...` → `SseEmitter` sin timeout corto; heartbeat cada 25 s; registro de emisores por usuario (varias pestañas permitidas); limpieza en `onCompletion`/`onTimeout`/`onError`.
  - Al desactivar un usuario se cierran sus emisores.
- `GET /notificaciones` (paginado, filtro `soloNoLeidas`), `GET /notificaciones/conteo-no-leidas`, `PATCH /notificaciones/{id}/leida`, `PATCH /notificaciones/leidas` (todas). Cada usuario solo ve las suyas.
- **Correos**:
  - `CorreoService` con `JavaMailSender` y plantillas Thymeleaf en `templates/email/`: layout base con `logo-email.png` (copia el archivo a `backend/src/main/resources/static/email/` y adjúntalo inline con CID; mostrar a 240 px de ancho), colores de marca, pie con datos del taller y versión en texto plano.
  - Plantillas para clientes (español): `orden-recibida`, `presupuesto-pendiente` (con tabla de ítems y total), `orden-lista`, `orden-entregada`. Para usuarios ya existe `recuperar-password` (revísala con el nuevo layout).
  - Solo se envía al cliente si tiene email y `acepta_tratamiento_datos = true` (RN-45).
  - Envío asíncrono; si falla, se reintenta 2 veces con espera creciente y se registra en log con `requestId`, sin afectar la operación (CP-54).
- **Auditoría (RF31)**: revisa que todos los módulos anteriores registren lo indicado en RN-51; completa lo que falte. `GET /auditoria` (`AUDITORIA_VER`) con filtros por usuario, entidad, acción y rango de fechas, y `GET /auditoria/entidad/{entidad}/{id}`.
- Desde ahora, cualquier otro módulo que necesite notificar solo publica eventos.

### Frontend
- `NotificacionesStreamService` en `core/realtime`: pide ticket, abre `EventSource`, reconecta con espera exponencial (máx. 30 s), se cierra al cerrar sesión, y actualiza un signal de conteo y la lista reciente.
- **Campana** en la topbar: contador con punto cian pulsante, panel desplegable con las últimas 10 (ícono por tipo, texto traducido con parámetros, tiempo relativo, enlace), "Marcar todas como leídas" y "Ver todas".
- Toast discreto cuando llega una notificación nueva (no si la pestaña está oculta).
- Página **Notificaciones** con filtro leídas/no leídas.
- Página **Auditoría** (solo admin): tabla con filtros y un panel lateral que muestra el `detalle` JSON de forma legible (clave → valor), y acceso desde el detalle de orden, venta y usuario a "Ver auditoría de este registro".

### Pruebas obligatorias
CP-52, CP-53, CP-54, CP-55, y además:
- Un evento dentro de una transacción que hace rollback **no** genera notificación.
- Ticket SSE: no reutilizable y vence a los 30 s.
- Un usuario no puede leer ni marcar notificaciones de otro (404).
- Renderizado de cada plantilla de correo con datos de ejemplo (sin errores de Thymeleaf) y snapshot del HTML.
- E2E: con dos navegadores (vendedor y mecánico), el vendedor asigna una orden y al mecánico le aparece la notificación sin recargar.

### Criterios de aceptación
- [ ] Capturas de la campana y de un correo de cliente en Mailpit (escritorio y móvil de Mailpit).
- [ ] El proxy de desarrollo y la configuración de Nginx prevista no bufferizan SSE (anótalo para F13).
- [ ] Todo en verde. `PROGRESS.md` y `TEST-PLAN.md` actualizados. PR, CI verde, merge.
