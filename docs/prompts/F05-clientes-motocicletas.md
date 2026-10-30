# F05 — Clientes y motocicletas

**Rama:** `feature/f05-clientes-motos`
**Requisitos:** RF5, RF6, RF7, RF8, RF9 (estructura), RF29 · IU3, IU5 · RNF Privacidad (Ley 1581), Integridad · RN-38 a RN-45
**Lee antes:** `CLAUDE.md`, `docs/BUSINESS-RULES.md` §7, `docs/ARCHITECTURE.md` §3 (clientes y motocicletas), §6 (Specification)

## Prompt

Ejecuta la fase F05 de HYSKAD: módulos `clientes` y `motocicletas`, backend y frontend. Muéstrame un plan corto y espera mi OK. Esta fase fija el **patrón de módulo CRUD** que repetirán los siguientes, así que cuida que quede limpio y consistente.

### Backend
- Migración con tablas `cliente` y `motocicleta` (índices: documento único, placa única, VIN único nullable, búsqueda por nombre y teléfono).
- `ClienteService` / `MotocicletaService` con las reglas RN-38 a RN-45. Normalización de placa y documento antes de validar y guardar.
- Búsqueda y filtros con `Specification` (RF29): texto libre (nombre, apellidos, razón social, documento, teléfono, email), estado; motos por placa (parcial), marca, modelo, cliente.
- Endpoints (`ARCHITECTURE.md` §4): CRUD de clientes con `PATCH /clientes/{id}/estado`; `GET /clientes/{id}/motocicletas`; CRUD de motos con `PATCH /motocicletas/{id}/estado` y `PATCH /motocicletas/{id}/propietario` (RN-43); `GET /motocicletas/{id}/historial` (por ahora devuelve lista vacía con la estructura final; se llena en F09C).
- RN-44 (no desactivar con órdenes activas): `taller` aún no existe y además `taller` dependerá de `clientes`, así que para no crear una dependencia circular define en `motocicletas` una interfaz pequeña `ConsultaOrdenesActivas` (`boolean tieneOrdenActiva(Long motoId)`, `boolean clienteTieneOrdenesActivas(Long clienteId)`). Por ahora una implementación por defecto devuelve `false`; en F09A el módulo `taller` la implementa y reemplaza la de defecto. Anótalo en `PROGRESS.md` (Deuda técnica) y en `ARCHITECTURE.md` §6 como uso justificado de inversión de dependencias.
- Permisos: `CLIENTES_VER`/`CLIENTES_GESTIONAR`, `MOTOS_VER`/`MOTOS_GESTIONAR`.
- Respuestas sin datos innecesarios: en listados no enviar dirección completa ni autorización de datos.
- Auditoría en crear, editar, cambiar estado y cambiar propietario.
- Datos de desarrollo: 10 clientes (incluido uno con NIT) y 15 motos.

### Frontend (`features/clientes`, `features/motocicletas`)
- **Lista de clientes**: `hk-filter-bar`, tabla con nombre/razón social, documento (tipo + número), teléfono, cantidad de motos, estado; en móvil, tarjetas.
- **Formulario de cliente** en página o drawer: campos que cambian según el tipo de documento (NIT → razón social y DV calculado en vivo), validadores espejo del backend (documento, email, teléfono colombiano de 10 dígitos), casilla de autorización de tratamiento de datos con el texto en un modal "Ver política".
- **Detalle del cliente**: datos, sus motos como tarjetas con la **placa estilizada** (§7 del sistema de diseño) y acción "Agregar moto" preseleccionando el cliente.
- **Lista y detalle de motos**: búsqueda por placa con normalización mientras se escribe, ficha técnica, propietario (con acción de cambio de propietario y confirmación), y pestaña "Historial" con su estado vacío.
- Validador de placa en `core/utils/validators` (mismo patrón que el backend) con mensaje que muestre formatos válidos.
- Todo traducido es/en.

### Pruebas obligatorias
CP-14, CP-15, CP-16, CP-17 (ambos lados), CP-18, CP-20, y además:
- Integración: permisos de cada endpoint (vendedor gestiona; mecánico solo ve; almacén no ve), cambio de propietario, búsqueda por placa parcial.
- Unitarias del front: validadores de documento (incluido DV del NIT) y de placa, formulario de cliente según tipo.
- E2E: crear cliente con NIT → agregarle una moto → buscarla por placa escrita con minúsculas y guion.

### Criterios de aceptación
- [ ] Patrón de módulo documentado brevemente en `docs/ARCHITECTURE.md` (sección nueva "Plantilla de módulo CRUD") para copiarlo en las siguientes fases.
- [ ] Capturas de lista, formulario y detalle en claro/oscuro y móvil.
- [ ] Todo en verde. `PROGRESS.md` y `TEST-PLAN.md` actualizados. PR, CI verde, merge.
