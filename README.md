# HYSKAD

Sistema web para gestionar un **almacén y taller de motocicletas** de pequeña y mediana escala: inventario, ventas y servicios de mantenimiento integrados.

Proyecto de aula (PAS) de Ingeniería del Software — Universidad de Córdoba, 2026-2.

## Stack

| Capa | Tecnologías |
|---|---|
| Backend | Java 25 · Spring Boot 4 · Spring Security (JWT) · Spring Data JPA · Flyway · MySQL 8.4 · MapStruct · springdoc-openapi |
| Frontend | Angular 22 (standalone, signals) · TypeScript estricto · Tailwind CSS v4 · Angular CDK · Transloco (es/en) |
| Pruebas | JUnit 5 · Mockito · Testcontainers · ArchUnit · JaCoCo · Vitest · Playwright · k6 |
| Infra | Docker Compose · Nginx · Let's Encrypt · GitHub Actions · Mailpit |

## Requisitos previos

- Java 25 (Temurin) con `JAVA_HOME` configurado
- Node.js 24 + npm
- Docker con Docker Compose v2
- Git

## Levantar en local

```bash
cp .env.example .env                                          # 1. variables de entorno (ajusta si hace falta)
docker compose -f infra/docker-compose.dev.yml up -d          # 2. MySQL + Mailpit
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev   # 3. API en http://localhost:8080
cd frontend && npm install && npm start                       # 4. app en http://localhost:4200
```

Mailpit (correos de desarrollo): <http://localhost:8025>.

## Pruebas

```bash
cd backend && ./mvnw verify                                   # unitarias, integración, ArchUnit, JaCoCo
cd frontend && npm run lint && npm test && npm run build
cd e2e && npm install && npx playwright install && npx playwright test   # con backend y frontend levantados
```

## Estructura

```
hyskad/
├── backend/           # Spring Boot (paquete raíz com.hyskad)
├── frontend/          # Angular
├── e2e/               # Playwright
├── infra/             # docker-compose, nginx, backups, k6
├── docs/              # documentación y prompts por fase
└── .github/workflows/ # CI/CD
```

## Documentación

Toda la documentación está en [`docs/`](docs/): arquitectura, reglas de negocio, sistema de diseño, plan de pruebas y progreso del proyecto.
