# Pruebas de rendimiento (k6)

Escenarios de F12 para **CP-59** (operaciones habituales) y **CP-60** (reportes con 12 meses de datos).
Los resultados de cada corrida quedan en `docs/test-reports/k6/*.json` y el análisis en
`docs/test-reports/INFORME-PRUEBAS.md`.

| Script | Caso | Carga | Umbrales |
|---|---|---|---|
| `operaciones.js` | CP-59 | 8 usuarios virtuales durante 5 min: login, listar y buscar órdenes, ver detalle, crear venta, agregar repuesto | p95 ≤ 2 s, 0 % de errores |
| `reportes.js` | CP-60 | 4 usuarios virtuales durante 2 min: reportes de servicios, inventario y ventas (12 meses, también en CSV), cuentas pendientes y dashboard | p95 ≤ 5 s, 0 % de errores |

## Pasos (desde la raíz del repositorio)

1. **Base de datos de rendimiento** (MySQL 8.4 con volumen propio, puerto 3308):

   ```bash
   docker compose -f infra/docker-compose.perf.yml up -d --wait
   ```

2. **Backend con el perfil `perf`** como jar, igual que en producción (puerto 8082; Flyway crea el esquema y los
   datos semilla de dev):

   ```bash
   cd backend && ./mvnw -B -DskipTests package
   java -jar target/hyskad-backend-*.jar --spring.profiles.active=perf --server.port=8082
   ```

3. **Datos masivos** (una sola vez; el script es idempotente): 500 productos, 1.500 clientes con moto,
   3.000 órdenes y 8.000 ventas repartidas en los últimos 12 meses.

   ```bash
   docker exec -i hyskad-perf-mysql-1 mysql -uhyskad -physkad_perf hyskad_perf < infra/perf/datos-perf.sql
   ```

4. **Escenarios** con la imagen oficial de k6 (no hay que instalar nada):

   ```bash
   docker run --rm -v "$PWD/infra/k6:/scripts" -v "$PWD/docs/test-reports/k6:/salida" \
     -e BASE_URL=http://host.docker.internal:8082 grafana/k6:1.0.0 \
     run --summary-export=/salida/operaciones.json /scripts/operaciones.js

   docker run --rm -v "$PWD/infra/k6:/scripts" -v "$PWD/docs/test-reports/k6:/salida" \
     -e BASE_URL=http://host.docker.internal:8082 grafana/k6:1.0.0 \
     run --summary-export=/salida/reportes.json /scripts/reportes.js
   ```

   Variables opcionales: `DURACION` (p. ej. `30s` para un ensayo corto), `VUS` (solo reportes) y `PASSWORD`.

## Buscar N+1

Con el backend arrancado con `--logging.level.org.hibernate.SQL=debug` y su salida en un archivo,
`contar-consultas.ps1` hace una petición por operación (cada una con su `X-Request-Id`) y cuenta las sentencias
SQL de cada una:

```powershell
pwsh infra/k6/contar-consultas.ps1 -Log backend-perf.log
```

Los reportes y el dashboard usan SQL nativo de solo lectura (`JdbcTemplate`), que ese logger no registra: son
consultas agregadas, sin N+1 posible.

## Notas

- La BD de rendimiento conserva lo que crean las corridas (cada ejecución de `operaciones.js` registra unas 1.400
  ventas y agrega repuestos a 8 órdenes en diagnóstico). Para volver al punto de partida:
  `docker compose -f infra/docker-compose.perf.yml down -v` y repetir los pasos 1 a 3.
- El login es la operación más lenta a propósito: BCrypt con costo 12.
