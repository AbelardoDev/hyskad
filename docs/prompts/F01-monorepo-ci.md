# F01 — Monorepo, infraestructura local y CI

**Rama:** `main` (commit inicial) y luego `feature/f01-monorepo-ci`
**Requisitos:** RNF Despliegue, Portabilidad, Calidad · IS1, IS2
**Lee antes:** `CLAUDE.md`, `docs/ARCHITECTURE.md` §1, §9

## Prompt

Ejecuta la fase F01 de HYSKAD. Lee `CLAUDE.md` y `docs/ARCHITECTURE.md` (secciones 1 y 9). Primero muéstrame un plan corto y espera mi OK.

### 1. Repositorio
- `git init` en la raíz (la carpeta ya contiene `CLAUDE.md`, `COMO-EMPEZAR.md`, `brand/`, `docs/` y `.claude/`). Rama principal `main`.
- `.gitignore` combinado (Java/Maven, Node/Angular, IDEs, `.env`, `*.log`, `coverage/`, `playwright-report/`, `test-results/`), `.editorconfig` (UTF-8, LF, 2 espacios; 4 en Java), `.gitattributes` (`* text=auto eol=lf`, scripts `.sh` con LF, `mvnw.cmd` con CRLF).
- `README.md`: qué es HYSKAD, stack, requisitos previos, cómo levantar todo en local en 4 comandos, estructura de carpetas y enlace a `docs/`.
- Commit inicial `chore: estructura inicial del repositorio`. Crea el repositorio en GitHub con `gh repo create hyskad --public --source=. --push` (si prefiero privado te lo diré) y luego crea la rama `feature/f01-monorepo-ci`.

### 2. Backend (`backend/`)
- Genéralo desde start.spring.io (descarga con `curl` el `starter.zip`): Maven, Java 25, la **última versión estable de Spring Boot 4.x** (ni SNAPSHOT ni M ni RC), group `com.hyskad`, artifact `hyskad-backend`, paquete `com.hyskad`. Dependencias: Spring Web, Spring Data JPA, Spring Security, OAuth2 Resource Server, Validation, Flyway Migration, MySQL Driver, Java Mail Sender, Thymeleaf, Actuator, Lombok, Configuration Processor, Testcontainers, Docker Compose Support **no** (usamos nuestro compose).
- Agrega con versiones compatibles con esa versión de Boot (verifícalo, no adivines): MapStruct (+ `lombok-mapstruct-binding`), springdoc-openapi (línea compatible con Boot 4), Bucket4j, ArchUnit (JUnit 5), Testcontainers MySQL, y el plugin JaCoCo (umbral 70 % en `com.hyskad.**.application` y `**.domain`; el build debe fallar si baja, pero excluye esa regla mientras no haya clases en esos paquetes).
- `application.yml` + `application-dev.yml` + `application-test.yml` + `application-prod.yml` con lo mínimo: `ddl-auto: validate`, `open-in-view: false`, zona horaria JDBC UTC, valores sensibles por variables de entorno con valores por defecto **solo** en `dev`.
- Una prueba `HyskadApplicationTests` que levante el contexto con Testcontainers (MySQL 8.4) usando `@ServiceConnection`.

### 3. Frontend (`frontend/`)
- Créalo con el Angular CLI **22** (`npx @angular/cli@22 new frontend`): estilos CSS, routing, sin SSR, `strict`, prefijo `hk`. Usa los valores por defecto del CLI para zoneless y para el runner de pruebas (Vitest).
- Instala y configura Tailwind CSS v4 siguiendo la guía oficial para Angular (PostCSS). Deja `styles.css` con `@import "tailwindcss";` y un `@custom-variant dark` como indica `docs/DESIGN-SYSTEM.md` §1.4 (los tokens completos llegan en F04A).
- ESLint con `@angular-eslint` y Prettier (+ `prettier-plugin-tailwindcss`). Scripts `lint`, `format`, `test` (sin watch en CI) y `build`.
- `proxy.conf.json` que mande `/api` a `http://localhost:8080` (con soporte para SSE: sin buffering) y úsalo en `npm start`.
- **Marca:** mueve el contenido de la carpeta `brand/` de la raíz a `frontend/public/brand/` (excepto `brand/_fuente/`, que va a `docs/brand/` junto con `brand/README.md`) y elimina `brand/` de la raíz. En `index.html`: `<link rel="icon" href="brand/favicon.svg" type="image/svg+xml">`, `<link rel="icon" href="brand/favicon.ico" sizes="any">`, `<link rel="apple-touch-icon" href="brand/apple-touch-icon.png">`, `<link rel="manifest" href="brand/site.webmanifest">`, `<meta name="theme-color" content="#1B3570">`, y título `HYSKAD`. Borra el `favicon.ico` que genera el CLI.
- Una página temporal que muestre `brand/logo.svg` y diga "HYSKAD" con un botón que llame a `GET /api/v1/ping` y muestre la respuesta, para probar la conexión de punta a punta. Crea ese `PingController` en el backend (público, se eliminará en F02).

### 4. E2E (`e2e/`)
- Proyecto Playwright en TypeScript (Chromium, Firefox y WebKit), `baseURL` configurable por variable de entorno (por defecto `http://localhost:4200`). Una prueba que abra la app y verifique el ping.

### 5. Infraestructura local (`infra/`)
- `docker-compose.dev.yml`: `mysql:8.4` (BD `hyskad`, usuario `hyskad`, volumen con nombre, puerto publicado **solo** en `127.0.0.1:3306`, healthcheck, charset utf8mb4) y `axllent/mailpit` (SMTP `127.0.0.1:1025`, UI `127.0.0.1:8025`).
- `.env.example` en la raíz con todas las variables de `ARCHITECTURE.md` §9 documentadas. `.env` ignorado por git.

### 6. CI (`.github/workflows/ci.yml`)
- Se ejecuta en `push` a `main` y en `pull_request`.
- Job `backend`: Temurin 25 con caché de Maven, `./mvnw -B verify` (Testcontainers funciona en `ubuntu-latest`), sube el reporte de JaCoCo como artefacto.
- Job `frontend`: Node 24 con caché de npm, `npm ci`, `npm run lint`, `npm test`, `npm run build`.
- `.github/dependabot.yml` semanal para Maven, npm (frontend y e2e) y GitHub Actions.
- Plantilla `.github/pull_request_template.md` con: requisitos cubiertos, casos de prueba, checklist de aceptación, capturas (claro/oscuro).

### 7. Verificación
- Levanta el compose, el backend en perfil `dev` y el frontend; comprueba el ping de punta a punta y ejecuta la prueba E2E.
- `./mvnw verify`, `npm run lint`, `npm test`, `npm run build` en verde.
- Actualiza `docs/PROGRESS.md`, haz push y abre el PR con `gh pr create`. Espera a que el CI pase (`gh pr checks --watch`) y, si pasa, haz merge con squash (`gh pr merge --squash --delete-branch`).

## Criterios de aceptación
- [ ] Repo en GitHub con `main` protegida por el CI (si el repo es público, configura con `gh api` que `main` exija el check del CI antes de mergear).
- [ ] Ping de punta a punta funcionando (Angular → proxy → Spring Boot).
- [ ] CI en verde en el PR.
- [ ] Ningún secreto en el repo.
