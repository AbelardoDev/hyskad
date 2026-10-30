# Reglas de negocio de HYSKAD

Estas reglas completan la ERS donde dejaba huecos. Si una tarea necesita una regla que no está aquí, **pregunta antes de inventarla**. Cada regla tiene un ID (`RN-xx`) para referenciarla en código, pruebas y commits.

## 1. Dinero e impuestos

- **RN-01** Moneda única: peso colombiano (COP). Se guarda como `DECIMAL(15,2)` y se muestra sin decimales con separador de miles (`$ 1.250.000`).
- **RN-02** Los precios de productos y servicios se registran **sin IVA**. El IVA se calcula al final sobre `(subtotal − descuento)`.
- **RN-03** El porcentaje de IVA es configurable (`iva.porcentaje`, por defecto **19**). Se guarda en cada documento el valor del impuesto aplicado, para que un cambio futuro no altere documentos viejos.
- **RN-04** Fórmula común (ventas, presupuestos, órdenes):
  `subtotal = Σ(cantidad × precio_unitario)` · `base = subtotal − descuento` · `impuesto = round(base × iva%/100)` · `total = base + impuesto`. Redondeo `HALF_UP` a pesos enteros.
- **RN-05** El descuento es un valor en pesos, ≥ 0 y ≤ subtotal.
- **RN-06** Los comprobantes son **internos** y deben decir visiblemente: *"Documento interno. No es factura electrónica."*

## 2. Costo de los productos (costo promedio ponderado)

El *costo* es lo que le cuesta al negocio cada unidad (no el precio de venta). Como se compra el mismo repuesto a distintos precios, se usa el **promedio ponderado**:

- **RN-07** Al registrar una entrada por compra: `nuevo_costo = (stock_actual × costo_promedio + cantidad × costo_compra) / (stock_actual + cantidad)`.
- **RN-08** Las salidas (venta, orden, ajuste) no cambian el costo promedio; registran el costo promedio vigente en el movimiento y en el detalle de la venta/orden (para calcular utilidad en reportes).
- **RN-09** La devolución por anulación de venta entra al `costo_unitario` registrado en esa venta y recalcula el promedio con la fórmula de RN-07.

## 3. Inventario

- **RN-10** `stock_disponible = stock_actual − stock_reservado`. Nunca se permite `stock_actual < 0` ni `stock_reservado > stock_actual`.
- **RN-11** Todo cambio de existencias genera un `movimiento_inventario` inmutable con: tipo, cantidad, costo, stock resultante, referencia (venta/orden/compra/ajuste), usuario y fecha. Tipos: `ENTRADA_COMPRA`, `SALIDA_VENTA`, `SALIDA_ORDEN`, `ENTRADA_AJUSTE`, `SALIDA_AJUSTE`, `DEVOLUCION_ANULACION_VENTA`, `SALIDA_ANULACION_COMPRA`.
- **RN-12** Toda modificación de stock bloquea la fila del producto (`PESSIMISTIC_WRITE`) dentro de la transacción, para que dos ventas simultáneas no vendan la misma unidad.
- **RN-13** Ajustes manuales: requieren permiso `INVENTARIO_AJUSTAR` y motivo obligatorio (mín. 10 caracteres). Una salida por ajuste no puede dejar `stock_actual < stock_reservado`.
- **RN-14** Alerta de stock bajo: cuando tras un movimiento `stock_disponible ≤ stock_minimo` **y antes no lo estaba**, se publica `StockBajoDetectado` (notifica a ALMACEN y ADMIN). No se repite mientras siga bajo.
- **RN-15** Los productos nunca se borran, solo se desactivan. No se puede desactivar un producto con `stock_reservado > 0`. Un producto inactivo no se puede vender, comprar, ajustar ni agregar a órdenes.

## 4. Compras

- **RN-16** Una compra tiene proveedor activo, al menos un ítem, cantidades > 0 y costos ≥ 0. Al registrarla entra el stock (RN-07) y queda en estado `REGISTRADA`.
- **RN-17** Anular una compra (solo ADMIN o ALMACEN, con motivo) genera `SALIDA_ANULACION_COMPRA` por cada ítem al costo promedio vigente, **sin** recalcular el promedio. Solo se permite si cada producto tiene `stock_disponible ≥ cantidad` comprada.

## 5. Ventas de mostrador

- **RN-18** El cliente es opcional (si no se indica, es *consumidor final*). Si se indica, debe estar activo.
- **RN-19** Cada ítem requiere `stock_disponible ≥ cantidad`. Se descuenta el stock al confirmar la venta (`SALIDA_VENTA`).
- **RN-20** **Sin pagos parciales ni crédito**: la venta se registra ya pagada (`PAGADA`) con método `EFECTIVO`, `TRANSFERENCIA`, `TARJETA` u `OTRO`. Referencia obligatoria salvo en efectivo. En efectivo se puede registrar el monto recibido para mostrar el cambio.
- **RN-21** Anulación: requiere `VENTAS_ANULAR` y motivo. Devuelve el stock de todos los ítems (`DEVOLUCION_ANULACION_VENTA`) y la venta pasa a `ANULADA`. Una venta anulada no se modifica ni se vuelve a anular.

## 6. Órdenes de trabajo

### 6.1 Estados (máquina de estados)

```
RECIBIDA ──► EN_DIAGNOSTICO ──► PENDIENTE_APROBACION ──► EN_REPARACION ──► FINALIZADA ──► ENTREGADA
                  ▲                    │      │                  │
                  └────────────────────┘      │ (rechazo)        │ (requiere ajuste)
                  └───────────────────────────┼──────────────────┘
                                              ▼
 (RECIBIDA | EN_DIAGNOSTICO | PENDIENTE_APROBACION | EN_REPARACION) ──► CANCELADA
```

| Transición | Quién | Condición / efecto |
|---|---|---|
| RECIBIDA → EN_DIAGNOSTICO | `ORDENES_TRABAJAR` | Debe haber al menos un mecánico asignado |
| EN_DIAGNOSTICO → PENDIENTE_APROBACION | `PRESUPUESTOS_GESTIONAR` | Requiere diagnóstico registrado y ≥ 1 ítem. Se genera presupuesto (RN-30) |
| PENDIENTE_APROBACION → EN_REPARACION | automática | Al registrar presupuesto **APROBADO** |
| PENDIENTE_APROBACION → CANCELADA | automática | Al registrar presupuesto **RECHAZADO**. Libera reservas |
| PENDIENTE_APROBACION → EN_DIAGNOSTICO | `PRESUPUESTOS_GESTIONAR` | Retirar presupuesto para ajustarlo; el presupuesto pasa a `REEMPLAZADO` |
| EN_REPARACION → EN_DIAGNOSTICO | `ORDENES_TRABAJAR` | "Requiere ajuste" (aparecieron nuevos trabajos). Nota obligatoria. Exige un nuevo presupuesto |
| EN_REPARACION → FINALIZADA | `ORDENES_TRABAJAR` | Descuenta del inventario los repuestos reservados (`SALIDA_ORDEN`) |
| FINALIZADA → ENTREGADA | `ENTREGAS_REGISTRAR` | Requiere pago registrado (RN-35) |
| (activa) → CANCELADA | `ORDENES_CREAR` o ADMIN | Motivo obligatorio. Libera todas las reservas |

- **RN-22** Cualquier otra transición se rechaza con `code = TRANSICION_INVALIDA`. ENTREGADA y CANCELADA son estados finales.
- **RN-23** Cada transición se guarda en `orden_estado_historial` con usuario, fecha y nota, y publica `EstadoOrdenCambiado`.
- **RN-24** Una motocicleta solo puede tener **una orden activa** (no ENTREGADA ni CANCELADA) a la vez.

### 6.2 Creación, asignación y diagnóstico

- **RN-25** Al crear la orden: cliente activo, moto activa **de ese cliente**, kilometraje ≥ al último registrado para esa moto, motivo de ingreso y descripción del problema obligatorios. Estado inicial `RECIBIDA`. Número consecutivo `OT-000001`.
- **RN-26** Se pueden asignar uno o varios mecánicos (usuarios activos con rol MECANICO). La asignación se puede cambiar mientras la orden esté activa.
- **RN-27** El mecánico solo ve y trabaja **las órdenes que tiene asignadas**. Esto se valida en el backend en cada operación.

### 6.3 Ítems de la orden (servicios y repuestos)

- **RN-28** Los ítems solo se agregan, editan o quitan en estado `EN_DIAGNOSTICO`. Los pueden manejar el mecánico asignado, el vendedor y el admin.
- **RN-29** Al agregar un repuesto se **reserva** (`stock_reservado += cantidad`), validando `stock_disponible ≥ cantidad`. Al quitarlo o cancelar la orden se libera. El descuento real del stock ocurre **al finalizar** la orden. El precio unitario se toma del `precio_venta` del producto en ese momento y queda congelado.
- **RN-30** Servicios: del catálogo (precio base editable en la orden) o mano de obra libre (descripción + precio). El mecánico **sí ve precios** y puede agregar repuestos y servicios.

### 6.4 Presupuestos

- **RN-31** Un presupuesto es una **copia congelada** de los ítems y totales de la orden en el momento de enviarlo. Se numera `P-000001` y lleva `version` (1, 2, 3…) dentro de la orden. Solo puede haber un presupuesto `PENDIENTE` por orden; al generar uno nuevo, los anteriores pendientes pasan a `REEMPLAZADO`.
- **RN-32** El descuento se define al generar el presupuesto (solo `PRESUPUESTOS_GESTIONAR`).
- **RN-33** La decisión del cliente (aprobado/rechazado) la registra el vendedor o admin con fecha y observaciones. Aprobado → orden a `EN_REPARACION`. Rechazado → orden a `CANCELADA` y se liberan reservas.
- **RN-34** El total final de la orden es el del último presupuesto **aprobado**. Como los ítems solo cambian en `EN_DIAGNOSTICO`, siempre coinciden.

### 6.5 Pago y entrega

- **RN-35** El pago es **total y único** (sin abonos), se registra solo en estado `FINALIZADA`, y el monto debe ser exactamente el total de la orden. Métodos y referencia como en RN-20.
- **RN-36** La entrega exige pago registrado. Se guarda fecha, usuario que entrega y observaciones. La orden pasa a `ENTREGADA`.
- **RN-37** Cuentas pendientes (RF26) = órdenes `FINALIZADA` sin pago, con días transcurridos desde la finalización.

## 7. Clientes, motocicletas y documentos

- **RN-38** Tipos de documento: `CC` (cédula de ciudadanía, 5–10 dígitos), `TI` (tarjeta de identidad, 10–11 dígitos), `CE` (cédula de extranjería, 3–12 alfanuméricos), `PA` (pasaporte, 5–15 alfanuméricos), `PPT` (permiso por protección temporal, 6–10 dígitos), `NIT` (9 dígitos + dígito de verificación).
- **RN-39** El NIT se valida con el **dígito de verificación DIAN** (módulo 11, pesos 3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71 de derecha a izquierda; si el residuo es 0 o 1 el DV es el residuo, si no, 11 − residuo). Se guarda como `900123456-7`. Con NIT se pide `razon_social` en lugar de nombres y apellidos.
- **RN-40** `(tipo_documento, numero_documento)` es único entre clientes, y entre proveedores.
- **RN-41** **Placa colombiana** de moto: se normaliza a mayúsculas sin espacios ni guiones y debe cumplir uno de estos formatos:
  - `^[A-Z]{3}[0-9]{2}[A-Z]$` → formato actual de motos (ej. `ABC12D`)
  - `^[A-Z]{3}[0-9]{2}$` → formato antiguo de motos (ej. `ABC12`)
  - `^[0-9]{3}[A-Z]{3}$` → motocarros (ej. `123ABC`)

  Los patrones viven en **una sola clase** (`PlacaColombianaValidator`) y su espejo en el front, para poder ajustarlos fácil si el taller pide otro formato. La placa es única.
- **RN-42** VIN opcional; si se ingresa: 17 caracteres alfanuméricos sin I, O ni Q, único.
- **RN-43** Una moto puede cambiar de dueño (se reasigna a otro cliente); su historial de servicios se conserva con la moto.
- **RN-44** No se puede desactivar un cliente o moto con órdenes activas.
- **RN-45** **Ley 1581 de 2012**: al registrar un cliente se pregunta si autoriza el tratamiento de sus datos (casilla con el texto de autorización, configurable). Se guarda la decisión y la fecha. **Sin autorización no se le envían correos.**

## 8. Usuarios y acceso

- **RN-46** Solo el administrador crea usuarios (no hay autorregistro). Email único. El primer admin se crea al arrancar si no existe ninguno, con `ADMIN_EMAIL`/`ADMIN_PASSWORD`, y debe cambiar la contraseña en su primer ingreso.
- **RN-47** Debe existir siempre **al menos un administrador activo**. Un usuario no puede desactivarse ni quitarse permisos a sí mismo.
- **RN-48** Al desactivar un usuario o cambiar sus permisos se revocan sus refresh tokens (cierra sesión en ≤ 15 min).
- **RN-49** Login fallido → mensaje genérico ("Credenciales inválidas"), sin revelar si el correo existe. Límite: 5 intentos por minuto por IP + correo.
- **RN-50** Recuperación de contraseña: la respuesta es siempre la misma exista o no el correo. Enlace de un solo uso, 30 min de vigencia; pedir uno nuevo invalida los anteriores; al restablecer se revocan todas las sesiones.

## 9. Notificaciones (RF30)

| Evento | In-app (tiempo real) | Correo |
|---|---|---|
| Orden creada | Vendedores, admin | Cliente: "Recibimos tu moto" |
| Mecánico asignado | Mecánico asignado | — |
| Cambio de estado | Creador de la orden + mecánicos asignados | — |
| Presupuesto enviado | Vendedores | Cliente: detalle del presupuesto |
| Presupuesto aprobado/rechazado | Mecánicos asignados | — |
| Orden finalizada | Vendedores, admin | Cliente: "Tu moto está lista" |
| Orden entregada | Admin | Cliente: resumen y total pagado |
| Stock bajo | Almacén, admin | — |
| Venta anulada | Admin | — |
| Recuperación de contraseña | — | Usuario |

Los correos a clientes solo se envían si tienen email y autorizaron el tratamiento de datos (RN-45). Un fallo de correo nunca revierte la operación de negocio.

## 10. Auditoría y numeración

- **RN-51** Se auditan: creación, edición, activación/desactivación de entidades de negocio; transiciones de orden; ventas y anulaciones; pagos; cambios de permisos; inicios de sesión exitosos y fallidos; cambios de configuración. Se guarda usuario, acción, entidad, id, detalle (JSON con valores relevantes, **nunca** contraseñas ni tokens), IP y fecha. Retención mínima 12 meses.
- **RN-52** Consecutivos sin huecos por tipo: `OT-000001`, `V-000001`, `C-000001`, `P-000001`, obtenidos de la tabla `consecutivo` con bloqueo dentro de la misma transacción del documento.
- **RN-53** Fechas en UTC en la BD; los reportes por día usan la zona `America/Bogota`.
