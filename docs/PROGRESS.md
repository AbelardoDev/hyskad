# Progreso de HYSKAD

> Claude Code actualiza este archivo al **cerrar cada fase** y cuando una sesión se interrumpe. Es la memoria del proyecto entre sesiones.

## Estado de las fases

| Fase | Nombre | Estado | PR | Notas |
|---|---|---|---|---|
| F00 | Preparación del entorno | ✅ Terminada | — | Entorno verificado 2026-10-29 |
| F01 | Monorepo, infraestructura local y CI | ✅ Terminada | #1 | Repo público AbelardoDev/hyskad; `main` protegida por el CI |
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

- **Fase:** F01 ✅ (cerrada 2026-10-29, PR #1)
- **Rama:** `main`
- **Hecho:** repo git con `main` (commit inicial). Backend Spring Boot 4.1.2 (Java 25) con MapStruct 1.6.3, springdoc 3.2.0, Bucket4j 8.21.0, ArchUnit 1.5.1, Testcontainers MySQL 8.4 y JaCoCo 0.8.16 (regla 70 % en `application`/`domain`); perfiles dev/test/prod; `PingController` temporal. Frontend Angular 22.1 (zoneless y Vitest por defecto) con Tailwind v4 (PostCSS), Transloco es/en, ESLint + Prettier, proxy `/api`, marca en `public/brand`. E2E Playwright (3 navegadores). Compose dev (MySQL + Mailpit), `.env.example`, CI, dependabot y plantilla de PR. Verificación local: `mvnw verify` (3 pruebas), lint, test (2), build y E2E (3/3) en verde; ping de punta a punta probado.
- **Siguiente paso concreto:** iniciar F02 con `/fase F02`.
- **Bloqueos o dudas:** hay un `mysqld` local ocupando el 3306 (pendiente de que el usuario decida si lo detiene o usa `DB_HOST_PORT=3307`). `gh` no está en el PATH: usar `C:\Program Files\GitHub CLI\gh.exe`.

## Decisiones tomadas durante el desarrollo

<!-- Formato: AAAA-MM-DD · Fase · Decisión · Motivo -->
- 2026-10-29 · F01 · Transloco se instala ya en F01 · la página de ping no debe tener textos quemados; F04A completa la configuración de i18n.
- 2026-10-29 · F01 · Seguridad temporal en `com.hyskad.ping.PingSecurityConfig` (solo `/api/v1/ping` y `/actuator/health` públicos, lo demás `denyAll`) · se reemplaza en F02/F03.
- 2026-10-29 · F01 · La regla JaCoCo es por paquete (`com.hyskad.*.application*`, `*.domain*`); sin paquetes que coincidan no evalúa nada · cumple "excluir mientras no haya clases" sin flags extra.
- 2026-10-29 · F01 · Puerto de MySQL del host configurable (`DB_HOST_PORT`, por defecto 3306) · en esta máquina hay otro MySQL en el 3306.
- 2026-10-29 · F01 · springdoc desactivado en el perfil `prod`.
- 2026-10-29 · F01 · En Windows/Git Bash, `./mvnw` falla por TLS (schannel) contra repo.maven.apache.org; usar `mvnw.cmd` desde PowerShell. La caché de npm por defecto daba ECONNRESET; se usó `npm_config_cache=%TEMP%
pm-cache-hk`.

## Deuda técnica conocida

<!-- Qué quedó pendiente a propósito y por qué -->
- `PingController`, `PingSecurityConfig` y la página `features/ping` son temporales: se eliminan en F02.
- La página de ping no usa tokens del sistema de diseño ni tiene modo oscuro (llegan en F04A).
- Aviso de Mockito por auto-attach del agente en las pruebas del backend (JDK 25); sin impacto por ahora.
