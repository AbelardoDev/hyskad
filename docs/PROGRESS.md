# Progreso de HYSKAD

> Claude Code actualiza este archivo al **cerrar cada fase** y cuando una sesión se interrumpe. Es la memoria del proyecto entre sesiones.

## Estado de las fases

| Fase | Nombre | Estado | PR | Notas |
|---|---|---|---|---|
| F00 | Preparación del entorno | ✅ Terminada | — | Entorno verificado 2026-10-29 |
| F01 | Monorepo, infraestructura local y CI | 🟦 En curso | | |
| F02 | Base del backend | ⬜ Pendiente | | |
| F03 | Autenticación, usuarios y permisos (backend) | ⬜ Pendiente | | |
| F04A | Sistema de diseño, tema, i18n y layout | ⬜ Pendiente | | |
| F04B | Sesión, guards y administración de usuarios (frontend) | ⬜ Pendiente | | |
| F05 | Clientes y motocicletas | ⬜ Pendiente | | |
| F06 | Catálogo de productos e inventario | ⬜ Pendiente | | |
| F07 | Proveedores y compras | ⬜ Pendiente | | |
| F08 | Ventas y comprobantes | ⬜ Pendiente | | |
| F09A | Órdenes: creación, asignación, estados y diagnóstico | ⬜ Pendiente | | |
| F09B | Órdenes: servicios, repuestos y presupuestos | ⬜ Pendiente | | |
| F09C | Órdenes: pago, entrega, historial y vista del mecánico | ⬜ Pendiente | | |
| F10 | Notificaciones en tiempo real, correos y auditoría | ⬜ Pendiente | | |
| F11 | Reportes, dashboard, búsqueda global y configuración | ⬜ Pendiente | | |
| F12 | Calidad: E2E, accesibilidad, rendimiento y seguridad | ⬜ Pendiente | | |
| F13 | Despliegue en VPS | ⬜ Pendiente | | |

Leyenda: ⬜ Pendiente · 🟦 En curso · ✅ Terminada

## Sesión actual / última sesión

- **Fase:** F00 ✅ (cerrada 2026-10-29)
- **Rama:** — (el repositorio git se crea en F01)
- **Hecho:** Entorno verificado: Java 25 Temurin (`JAVA_HOME` OK), Node 24.19 + npm, Git 2.55 con user.name/email, GitHub CLI 2.103.3 autenticado (AbelardoDev), Docker 28.3 con daemon activo y Compose v2.38; puertos 3306, 8080, 4200, 1025 y 8025 libres.
- **Siguiente paso concreto:** Iniciar F01 con `/fase F01`.
- **Bloqueos o dudas:** El token de `gh` no tiene el scope `workflow`; hará falta `gh auth refresh -s workflow` antes de hacer push de `.github/workflows` en F01. `gh` no está en el PATH de la sesión anterior de la terminal (se resuelve reabriéndola).

## Decisiones tomadas durante el desarrollo

<!-- Formato: AAAA-MM-DD · Fase · Decisión · Motivo -->

## Deuda técnica conocida

<!-- Qué quedó pendiente a propósito y por qué -->
