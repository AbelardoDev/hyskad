# Prueba de usabilidad (CP-68)

**Objetivo:** comprobar que personas reales del taller completan las tareas habituales de su rol **sin ayuda**.
**Criterio de aceptación (CP-68):** al menos el **80 %** de las tareas completadas sin ayuda.
**Estado:** pendiente de ejecutar con usuarios reales (la tabla de resultados está vacía a propósito).

## Preparación

- Ambiente: el de producción ya desplegado (F13) o uno de pruebas con los datos semilla, con HTTPS si es posible.
- Una cuenta por participante con el rol de la tarea (no compartir la del administrador).
- Datos previos: el cliente *Carlos Andrés Pérez Gómez* con la moto **ABC12D**, una orden asignada al mecánico
  participante, el proveedor *Distribuidora de Repuestos del Caribe S.A.S.* y productos con stock.
- Dispositivos: computador para administrador, almacén y vendedor; **celular** del propio mecánico.
- Materiales: este guion impreso, cronómetro y formato de observación.

## Cómo conducir la sesión

1. Explique que se evalúa el sistema, no a la persona, y que puede pensar en voz alta.
2. Lea la consigna tal cual. **No** dé pistas sobre dónde está cada opción.
3. Empiece a cronometrar cuando termine de leer la consigna y pare cuando la persona diga que terminó (o a los
   **10 minutos**).
4. Si la persona pide ayuda o queda bloqueada más de 2 minutos, puede ayudar: la tarea queda como
   **completada con ayuda**.
5. Al final pregunte: *"Del 1 (muy difícil) al 7 (muy fácil), ¿qué tan fácil fue la tarea?"* y anote sus
   comentarios textuales.

## Tareas (una por rol)

| # | Rol | Consigna que se lee | Se completa cuando… |
|---|---|---|---|
| T1 | Vendedor | "Un cliente compra un filtro de aceite YBR 125 / FZ y una bujía CR7HSA y paga en efectivo con un billete de $100.000. Regístrele la venta y muéstrele el comprobante." | La venta queda registrada como pagada, se indica el cambio y se ve el comprobante. |
| T2 | Mecánico (celular) | "Le asignaron una moto. Ábrala, anote que encontró la cadena estirada y agregue el kit de arrastre que va a cambiar (Kit de arrastre YBR 125)." | La orden queda con el diagnóstico guardado y el repuesto agregado. |
| T3 | Almacén | "Llegó la factura FAC-2210 de Distribuidora de Repuestos del Caribe con 10 bujías CR7HSA y 5 filtros de aire NKD 125. Regístrela y verifique que el stock de la bujía aumentó." | La compra queda registrada y la persona encuentra el nuevo stock de la bujía. |
| T4 | Administrador | "Necesito saber cuánto se vendió en el último mes y quiero el archivo para abrirlo en Excel. Después dígame qué clientes nos deben plata." | Descarga el CSV del reporte de ventas y nombra al menos una cuenta pendiente. |

## Métricas

- **Completada:** *sí* (sin ayuda), *con ayuda* o *no*.
- **Tiempo:** en minutos y segundos.
- **Errores:** acciones que la persona tuvo que deshacer o corregir (pantalla equivocada, dato mal escrito
  que el sistema rechazó, botón equivocado).
- **Facilidad percibida:** de 1 a 7.
- **Comentarios:** textuales, sin interpretar.

## Resultados

| Participante | Rol | Tarea | Completada (sí / con ayuda / no) | Tiempo (min:s) | Errores | Facilidad (1–7) | Comentarios |
|---|---|---|---|---|---|---|---|
| P1 | | | | | | | |
| P2 | | | | | | | |
| P3 | | | | | | | |
| P4 | | | | | | | |
| P5 | | | | | | | |
| P6 | | | | | | | |
| P7 | | | | | | | |
| P8 | | | | | | | |

**Resultado:** tareas completadas sin ayuda = ___ de ___ (___ %). CP-68 se aprueba si es ≥ 80 %.

## Hallazgos y acciones

| # | Hallazgo (qué pasó y en qué tarea) | Gravedad (alta / media / baja) | Acción propuesta | Issue |
|---|---|---|---|---|
| | | | | |
