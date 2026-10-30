# HYSKAD — Contexto para Claude Code

Sistema web para gestionar un **almacén y taller de motocicletas** (pequeña/mediana escala): inventario, ventas y servicios de mantenimiento integrados. Proyecto de aula (PAS) de Ingeniería del Software, Universidad de Córdoba, 2026-2. Lo desarrolla una sola persona usando Claude Code.

Idioma de trabajo: **español** (comentarios, commits, documentación, mensajes al usuario). Nombres de código (clases, métodos, variables, tablas) en **español sin tildes**, salvo términos técnicos estándar (`Controller`, `Service`, `Repository`, `Dto`, `Mapper`, `Config`).

## Documentos de referencia (léelos cuando la tarea los toque, no todos siempre)

| Archivo | Cuándo leerlo |
|---|---|
| `docs/ARCHITECTURE.md` | Antes de crear módulos, entidades, endpoints o pantallas nuevas |
| `docs/BUSINESS-RULES.md` | Antes de tocar inventario, ventas, órdenes, presupuestos, pagos o permisos |
| `docs/DESIGN-SYSTEM.md` | Antes de crear o modificar cualquier componente visual |
| `docs/TEST-PLAN.md` | Al escribir pruebas y al cerrar cada fase |
| `docs/PROGRESS.md` | Al iniciar y al cerrar cada sesión (estado actual del proyecto) |
| `docs/prompts/FXX-*.md` | La fase que se está ejecutando |

La ERS original (IEEE 830) define RF1–RF35 e IU/IH/IS/IC/RNF. Los IDs de requisito se usan en commits, pruebas y PRs para trazabilidad.

## Stack (no cambiar sin pedir permiso)

- **Backend**: Java 25 (LTS) · Spring Boot 4.x (última estable) · Maven · Spring Web MVC · Spring Data JPA (Hibernate) · Spring Security (OAuth2 Resource Server con JWT firmado por el propio backend) · Bean Validation · Flyway · MySQL 8.4 · MapStruct · springdoc-openapi · Bucket4j (rate limiting) · Spring Mail + Thymeleaf (plantillas de correo).
- **Frontend**: Angular 22 (componentes standalone, signals, control flow `@if/@for`, `inject()`) · TypeScript estricto · Tailwind CSS v4 · Angular CDK (overlays, a11y, diálogos) · Transloco (i18n es/en) · lucide-angular (íconos) · Chart.js (gráficas, con un wrapper propio).
- **Pruebas**: JUnit 5 + Mockito + AssertJ · Testcontainers (MySQL real) · ArchUnit · JaCoCo · Vitest (runner por defecto del Angular CLI) · Playwright + @axe-core/playwright (E2E y accesibilidad) · k6 (rendimiento).
- **Infra**: Docker + Docker Compose · Nginx (proxy inverso + estáticos + HTTPS) · Let's Encrypt · GitHub Actions (CI/CD) · Mailpit (correo en desarrollo).

## Estructura del monorepo

```
hyskad/
├── backend/          # Spring Boot (paquete raíz com.hyskad)
├── frontend/         # Angular
├── e2e/              # Playwright
├── infra/            # docker-compose.*.yml, nginx, scripts de backup, k6
├── docs/             # documentación y prompts por fase
└── .github/workflows # CI/CD
```

## Reglas de arquitectura (obligatorias)

**Backend: monolito modular por capas.** Un paquete por módulo de negocio (`clientes`, `inventario`, `taller`…), y dentro de cada uno: `web` (controllers + DTOs), `application` (servicios, casos de uso), `domain` (entidades, enums, eventos, reglas), `persistence` (repositorios). Lo transversal va en `com.hyskad.shared`.

1. Los controllers solo validan entrada, llaman a un servicio y devuelven DTOs. **Nunca** exponen entidades JPA ni acceden a repositorios.
2. Un módulo **no** usa repositorios de otro módulo; usa el servicio público de ese módulo. (ArchUnit lo verifica.)
3. La lógica de negocio vive en servicios y, cuando aplique, en métodos de la entidad (ej. `OrdenTrabajo.cambiarEstado()`).
4. Toda operación que toque stock, órdenes, ventas o pagos es `@Transactional` y bloquea el producto con `PESSIMISTIC_WRITE` antes de modificar existencias.
5. DTOs como `record`. Mapeo con MapStruct. Dinero con `BigDecimal` (`DECIMAL(15,2)`), redondeo `HALF_UP` a 0 decimales al mostrar COP.
6. Errores con `ProblemDetail` (RFC 9457) + propiedad `code` estable (ej. `STOCK_INSUFICIENTE`) para que el frontend la traduzca.
7. Esquema de BD **solo** con migraciones Flyway (`V{n}__descripcion.sql`). `spring.jpa.hibernate.ddl-auto=validate`. Nunca editar una migración ya aplicada; crear una nueva.
8. API bajo `/api/v1`, recursos en plural y kebab-case (`/api/v1/ordenes-trabajo`). Listados paginados (`page`, `size`, `sort`) con respuesta `PageResponse<T>`.
9. Patrones de diseño **solo donde se justifican** (ver `docs/ARCHITECTURE.md` §6). No crear interfaces con una única implementación "por si acaso", ni capas extra, ni abstracciones genéricas sin un segundo caso de uso real.
10. Secretos solo por variables de entorno. Nada de credenciales en el código ni en `application.yml`.

**Frontend:** `core/` (auth, interceptores, guards, layout, tema, i18n, tiempo real), `shared/ui/` (kit de componentes propio), `features/<modulo>/` (páginas + servicio de datos, rutas lazy).

1. Componentes standalone, `ChangeDetectionStrategy.OnPush`, estado local con `signal`/`computed`. Sin NgRx.
2. Formularios reactivos tipados. Validaciones espejo de las del backend.
3. Toda llamada HTTP en un servicio `*-api.service.ts` del feature; los componentes no usan `HttpClient` directamente.
4. Ningún texto visible quemado en plantillas: todo pasa por Transloco (`es.json` y `en.json` siempre actualizados juntos).
5. UI solo con el kit de `shared/ui` y los tokens de `DESIGN-SYSTEM.md`. No usar colores de Tailwind sueltos (`bg-blue-600`): usar tokens semánticos (`bg-primary`, `text-muted`…).
6. Cada vista con estados de **carga** (skeleton), **vacío** y **error**.
7. Accesibilidad: labels asociados, foco visible, navegación por teclado, contraste AA, `aria-*` en componentes interactivos.

## Seguridad (no negociable)

- Contraseñas con BCrypt (cost 12). Política: mínimo 8 caracteres, letras y números.
- Access token JWT de 15 min **en memoria** del frontend (nunca en localStorage). Refresh token opaco de 7 días en cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, guardado **hasheado** en BD y rotado en cada uso.
- Autorización por **permisos** (`@PreAuthorize("hasAuthority('ORDENES_GESTIONAR')")`), no por nombre de rol. El mecánico solo ve/edita órdenes asignadas (verificar en el servicio, no solo en el front).
- Rate limit en `/auth/login`, `/auth/refresh` y `/auth/password/**`.
- Validar toda entrada (Bean Validation + reglas de negocio). Consultas solo con JPA/parámetros, nunca SQL concatenado.
- No devolver datos personales innecesarios (Ley 1581 de 2012). Logs sin contraseñas, tokens ni documentos completos.
- La BD no expone puertos fuera de la red de Docker.

## Flujo de trabajo de cada fase

1. Lee `docs/PROGRESS.md` y el prompt de la fase.
2. Crea la rama `feature/fXX-nombre-corto` desde `main` actualizado.
3. Presenta un plan corto (máx. 15 líneas) y espera aprobación.
4. Implementa en pasos pequeños. Haz commit al completar cada parte coherente (Conventional Commits en español, con IDs de requisito: `feat(taller): registrar diagnóstico de orden [RF14]`).
5. Escribe las pruebas de la fase (ver `TEST-PLAN.md`). **No avances si algo falla.**
6. Ejecuta la verificación completa (ver abajo) y corrige hasta que todo pase.
7. Actualiza `docs/PROGRESS.md` (qué se hizo, decisiones, pendientes) y el estado de los casos de prueba.
8. Push y PR a `main` con `gh pr create` (descripción: RF cubiertos + checklist de aceptación). Espera a que el CI pase antes de hacer merge.

## Comandos

```bash
# Infra de desarrollo (MySQL + Mailpit)
docker compose -f infra/docker-compose.dev.yml up -d

# Backend
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
cd backend && ./mvnw verify            # pruebas + JaCoCo + ArchUnit

# Frontend
cd frontend && npm start               # http://localhost:4200 (proxy /api -> :8080)
cd frontend && npm run lint && npm test && npm run build

# E2E (con backend y frontend levantados)
cd e2e && npx playwright test
```

## Verificación antes de dar una fase por terminada

- `./mvnw verify` en verde (incluye ArchUnit y cobertura ≥ 70 % en `application`).
- `npm run lint`, `npm test` y `npm run build` en verde, sin warnings nuevos.
- Pruebas E2E de la fase en verde (desde F04).
- Revisaste la UI en claro **y** oscuro, en 375 px, 768 px y 1440 px, y en es **y** en.
- Nada de `console.log`, `System.out`, código comentado, `TODO` sin issue, ni secretos.

## Qué NO hacer

- No agregar dependencias fuera del stack sin preguntar.
- No usar `ddl-auto=update/create`, `@Data` de Lombok en entidades, ni `FetchType.EAGER` en colecciones.
- No usar `any` en TypeScript ni desactivar reglas del linter para "salir del paso".
- No borrar ni debilitar pruebas para que pasen.
- No implementar funcionalidades fuera del alcance de la ERS (facturación electrónica DIAN, multi-sucursal, nómina, e-commerce, app nativa).
- No inventar reglas de negocio: si algo no está en `BUSINESS-RULES.md`, pregunta.
