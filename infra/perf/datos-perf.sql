-- =====================================================================================
-- HYSKAD · Datos masivos para el perfil `perf` (F12, CP-59 y CP-60). SOLO para la BD de
-- rendimiento (infra/docker-compose.perf.yml); nunca en dev, e2e ni producción.
--
-- Parte de los datos semilla de dev (usuarios, categorías, servicios, 40 productos y 10
-- clientes) y agrega 12 meses de historia:
--   · 460 productos   → 500 en total
--   · 1.490 clientes  → 1.500 en total, cada uno con una moto
--   · 3.000 órdenes   (entregadas, algunas canceladas, 40 finalizadas sin cobrar y 60 activas)
--   · 8.000 ventas    (1 % anuladas) con su detalle y su movimiento de inventario
-- Las fechas se reparten entre hace 364 días y hoy, en horario del taller (8 a 17 h Bogotá).
-- Se inserta directo con SQL: es un volumen de prueba, no pasa por las reglas de la API.
--
-- Uso (ver infra/k6/README.md):
--   docker exec -i hyskad-perf-mysql-1 mysql -uhyskad -physkad_perf hyskad_perf < infra/perf/datos-perf.sql
-- =====================================================================================

SET SESSION cte_max_recursion_depth = 10000;
SET @ahora := UTC_TIMESTAMP(6);
SET @admin := (SELECT id FROM usuario WHERE email = 'admin@hyskad.local');
SET @vendedor := (SELECT id FROM usuario WHERE email = 'vendedor@hyskad.local');
SET @mecanico := (SELECT id FROM usuario WHERE email = 'mecanico@hyskad.local');
SET @iva := 19;

-- Idempotencia: si ya se cargó, no hace nada
SET @ya := (SELECT COUNT(*) FROM producto WHERE codigo LIKE 'PERF-%');
SELECT IF(@ya > 0, 'Los datos de rendimiento ya estaban cargados', 'Cargando datos de rendimiento') AS estado;

DROP TEMPORARY TABLE IF EXISTS seq;
CREATE TEMPORARY TABLE seq (n INT PRIMARY KEY);
INSERT INTO seq (n)
WITH RECURSIVE s (n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM s WHERE n < 8000)
SELECT n FROM s WHERE @ya = 0;

-- ---------------------------------------------------------------- Productos (460)
DROP TEMPORARY TABLE IF EXISTS cats;
CREATE TEMPORARY TABLE cats AS
SELECT id, ROW_NUMBER() OVER (ORDER BY id) - 1 AS i FROM categoria WHERE activo;
SET @ncat := (SELECT COUNT(*) FROM categoria WHERE activo);

INSERT INTO producto (codigo, nombre, descripcion, marca, categoria_id, unidad, precio_venta, costo_promedio,
                      stock_actual, stock_reservado, stock_minimo, activo, version, created_at, updated_at,
                      created_by, updated_by)
SELECT CONCAT('PERF-', LPAD(s.n, 4, '0')),
       CONCAT('Repuesto de carga ', s.n),
       NULL,
       ELT(1 + s.n % 5, 'Honda', 'Yamaha', 'Suzuki', 'Bajaj', 'Genérica'),
       c.id,
       ELT(1 + s.n % 4, 'UNIDAD', 'UNIDAD', 'LITRO', 'KIT'),
       5000 + (s.n * 7919 % 296) * 1000,
       ROUND((5000 + (s.n * 7919 % 296) * 1000) * 0.6),
       5000, 0, 5, TRUE, 0, @ahora, @ahora, @admin, @admin
FROM seq s JOIN cats c ON c.i = s.n % @ncat
WHERE s.n <= 460;

DROP TEMPORARY TABLE IF EXISTS pp;
CREATE TEMPORARY TABLE pp (n INT PRIMARY KEY, id BIGINT, precio DECIMAL(15, 2), costo DECIMAL(15, 2));
INSERT INTO pp
SELECT CAST(SUBSTRING(codigo, 6) AS UNSIGNED), id, precio_venta, costo_promedio
FROM producto WHERE codigo LIKE 'PERF-%';

-- ---------------------------------------------------------------- Clientes y motos (1.490)
INSERT INTO cliente (tipo_documento, numero_documento, nombres, apellidos, razon_social, telefono, email, direccion,
                     ciudad, acepta_tratamiento_datos, fecha_aceptacion_datos, activo, created_at, updated_at,
                     created_by, updated_by)
SELECT 'CC', CONCAT('8', LPAD(s.n, 9, '0')), 'Cliente', CONCAT('Carga ', s.n), NULL,
       CONCAT('300', LPAD(s.n, 7, '0')), NULL, NULL, 'Montería', TRUE, @ahora, TRUE, @ahora, @ahora,
       @vendedor, @vendedor
FROM seq s WHERE s.n <= 1490;

-- Placas XY?000–XY?999 (no chocan con las de dev): letra según los miles y tres dígitos
INSERT INTO motocicleta (cliente_id, placa, marca, modelo, anio, vin, cilindrada_cc, color, activo, created_at,
                         updated_at, created_by, updated_by)
SELECT c.id,
       CONCAT('XY', CHAR(65 + CAST(SUBSTRING(c.numero_documento, 2) AS UNSIGNED) DIV 1000 USING utf8mb4),
              LPAD(CAST(SUBSTRING(c.numero_documento, 2) AS UNSIGNED) % 1000, 3, '0')),
       ELT(1 + c.id % 5, 'Honda', 'Yamaha', 'Suzuki', 'Bajaj', 'AKT'),
       ELT(1 + c.id % 4, 'CB 190R', 'FZ 2.0', 'Gixxer 150', 'NS 200'),
       2015 + c.id % 10, NULL, 150, 'Negro', TRUE, @ahora, @ahora, @vendedor, @vendedor
FROM cliente c
WHERE c.apellidos LIKE 'Carga %' AND @ya = 0;

DROP TEMPORARY TABLE IF EXISTS pm;
CREATE TEMPORARY TABLE pm (n INT PRIMARY KEY, cliente_id BIGINT, moto_id BIGINT);
INSERT INTO pm
SELECT CAST(SUBSTRING(c.numero_documento, 2) AS UNSIGNED), c.id, m.id
FROM cliente c JOIN motocicleta m ON m.cliente_id = c.id
WHERE c.apellidos LIKE 'Carga %';

DROP TEMPORARY TABLE IF EXISTS ps;
CREATE TEMPORARY TABLE ps AS
SELECT id, nombre, precio_base, tiempo_estimado_min, ROW_NUMBER() OVER (ORDER BY id) - 1 AS i
FROM servicio WHERE activo;
SET @nserv := (SELECT COUNT(*) FROM servicio WHERE activo);

-- ---------------------------------------------------------------- Órdenes (3.000)
SET @ot := (SELECT siguiente FROM consecutivo WHERE tipo = 'OT');

DROP TEMPORARY TABLE IF EXISTS po;
CREATE TEMPORARY TABLE po (
    n INT PRIMARY KEY, estado VARCHAR(25), ingreso DATETIME(6), finalizacion DATETIME(6), entrega DATETIME(6),
    cliente_id BIGINT, moto_id BIGINT, servicio_id BIGINT, servicio VARCHAR(120), precio_servicio DECIMAL(15, 2),
    tiempo INT, producto_id BIGINT, precio_repuesto DECIMAL(15, 2), costo_repuesto DECIMAL(15, 2),
    subtotal DECIMAL(15, 2), impuesto DECIMAL(15, 2), total DECIMAL(15, 2));

INSERT INTO po
SELECT x.n, x.estado, x.ingreso,
       IF(x.estado IN ('FINALIZADA', 'ENTREGADA'), DATE_ADD(x.ingreso, INTERVAL 26 HOUR), NULL),
       IF(x.estado = 'ENTREGADA', DATE_ADD(x.ingreso, INTERVAL 50 HOUR), NULL),
       x.cliente_id, x.moto_id, x.servicio_id, x.servicio, x.precio_servicio, x.tiempo, x.producto_id,
       x.precio_repuesto, x.costo_repuesto, x.subtotal, ROUND(x.subtotal * @iva / 100), ROUND(x.subtotal * (1 + @iva / 100))
FROM (
    SELECT s.n,
           CASE WHEN s.n > 2940 THEN ELT(1 + s.n % 3, 'RECIBIDA', 'EN_DIAGNOSTICO', 'EN_REPARACION')
                WHEN s.n > 2900 THEN 'FINALIZADA'
                WHEN s.n % 50 = 0 THEN 'CANCELADA'
                ELSE 'ENTREGADA' END AS estado,
           TIMESTAMP(DATE(DATE_SUB(@ahora, INTERVAL FLOOR((3000 - s.n) * 364 / 3000) DAY)),
                     MAKETIME(13 + s.n % 9, s.n % 60, 0)) AS ingreso,
           m.cliente_id, m.moto_id, v.id AS servicio_id, v.nombre AS servicio, v.precio_base AS precio_servicio,
           v.tiempo_estimado_min AS tiempo, p.id AS producto_id, p.precio AS precio_repuesto, p.costo AS costo_repuesto,
           CASE WHEN s.n > 2940 AND s.n % 3 = 1 THEN 0                         -- recibida: sin ítems
                WHEN s.n > 2940 OR s.n % 50 = 0 THEN v.precio_base             -- activas y canceladas: solo servicio
                ELSE v.precio_base + p.precio END AS subtotal                  -- finalizadas y entregadas
    FROM seq s
    JOIN pm m ON m.n = 1 + (s.n - 1) % 1490
    JOIN ps v ON v.i = s.n % @nserv
    JOIN pp p ON p.n = 1 + s.n % 460
    WHERE s.n <= 3000
) x;
-- La última orden de cada moto activa queda entre las 100 últimas (motos distintas): RN-24 se cumple.

INSERT INTO orden_trabajo (numero, cliente_id, motocicleta_id, fecha_ingreso, kilometraje_ingreso, motivo_ingreso,
                           descripcion_problema, observaciones, estado, diagnostico, observaciones_diagnostico,
                           kilometraje_inspeccion, subtotal, descuento, iva_porcentaje, impuesto, total,
                           fecha_finalizacion, fecha_entrega, entregada_por, observaciones_entrega, version,
                           created_at, updated_at, created_by, updated_by)
SELECT CONCAT('OT-', LPAD(@ot + o.n - 1, 6, '0')), o.cliente_id, o.moto_id, o.ingreso, 1000 + o.n * 10,
       'Mantenimiento', 'Carga de rendimiento', NULL, o.estado,
       IF(o.estado = 'RECIBIDA', NULL, 'Revisión general'), NULL, NULL,
       o.subtotal, 0, @iva, o.impuesto, o.total, o.finalizacion, o.entrega,
       IF(o.estado = 'ENTREGADA', @vendedor, NULL), NULL, 0,
       o.ingreso, COALESCE(o.entrega, o.finalizacion, o.ingreso), @vendedor, @vendedor
FROM po o;

DROP TEMPORARY TABLE IF EXISTS po_id;
CREATE TEMPORARY TABLE po_id (n INT PRIMARY KEY, id BIGINT);
INSERT INTO po_id
SELECT CAST(SUBSTRING(numero, 4) AS UNSIGNED) - @ot + 1, id
FROM orden_trabajo
WHERE CAST(SUBSTRING(numero, 4) AS UNSIGNED) BETWEEN @ot AND @ot + 2999;

INSERT INTO orden_mecanico (orden_id, mecanico_id, actividad, asignado_en)
SELECT i.id, @mecanico, NULL, o.ingreso FROM po o JOIN po_id i ON i.n = o.n;

INSERT INTO orden_servicio (orden_id, servicio_id, descripcion, precio, tiempo_min, mecanico_id, agregado_por,
                            agregado_en)
SELECT i.id, o.servicio_id, o.servicio, o.precio_servicio, o.tiempo, @mecanico, @mecanico,
       DATE_ADD(o.ingreso, INTERVAL 2 HOUR)
FROM po o JOIN po_id i ON i.n = o.n
WHERE o.estado <> 'RECIBIDA';

INSERT INTO orden_repuesto (orden_id, producto_id, cantidad, precio_unitario, costo_unitario, agregado_por,
                            agregado_en)
SELECT i.id, o.producto_id, 1, o.precio_repuesto, o.costo_repuesto, @mecanico, DATE_ADD(o.ingreso, INTERVAL 2 HOUR)
FROM po o JOIN po_id i ON i.n = o.n
WHERE o.estado IN ('FINALIZADA', 'ENTREGADA');

INSERT INTO movimiento_inventario (producto_id, tipo, cantidad, costo_unitario, stock_resultante, referencia_tipo,
                                   referencia_id, referencia_numero, motivo, usuario_id, fecha)
SELECT o.producto_id, 'SALIDA_ORDEN', 1, o.costo_repuesto, 5000, 'ORDEN_TRABAJO', i.id,
       CONCAT('OT-', LPAD(@ot + o.n - 1, 6, '0')), NULL, @mecanico, o.finalizacion
FROM po o JOIN po_id i ON i.n = o.n
WHERE o.estado IN ('FINALIZADA', 'ENTREGADA');

INSERT INTO pago (orden_id, monto, metodo, referencia, monto_recibido, fecha, usuario_id)
SELECT i.id, o.total, ELT(1 + o.n % 3, 'EFECTIVO', 'TRANSFERENCIA', 'TARJETA'),
       IF(o.n % 3 = 0, NULL, CONCAT('REF-', o.n)), IF(o.n % 3 = 0, o.total, NULL),
       DATE_SUB(o.entrega, INTERVAL 10 MINUTE), @vendedor
FROM po o JOIN po_id i ON i.n = o.n
WHERE o.estado = 'ENTREGADA';

INSERT INTO orden_estado_historial (orden_id, estado_anterior, estado_nuevo, nota, usuario_id, fecha)
SELECT i.id, NULL, 'RECIBIDA', NULL, @vendedor, o.ingreso FROM po o JOIN po_id i ON i.n = o.n;
INSERT INTO orden_estado_historial (orden_id, estado_anterior, estado_nuevo, nota, usuario_id, fecha)
SELECT i.id, 'RECIBIDA', o.estado, IF(o.estado = 'CANCELADA', 'El cliente no volvió', NULL), @vendedor,
       COALESCE(o.entrega, o.finalizacion, DATE_ADD(o.ingreso, INTERVAL 1 HOUR))
FROM po o JOIN po_id i ON i.n = o.n
WHERE o.estado <> 'RECIBIDA';

UPDATE consecutivo SET siguiente = siguiente + 3000, updated_at = @ahora WHERE tipo = 'OT' AND @ya = 0;

-- ---------------------------------------------------------------- Ventas (8.000)
SET @v := (SELECT siguiente FROM consecutivo WHERE tipo = 'VENTA');

DROP TEMPORARY TABLE IF EXISTS pv;
CREATE TEMPORARY TABLE pv (
    n INT PRIMARY KEY, fecha DATETIME(6), producto_id BIGINT, cantidad INT, precio DECIMAL(15, 2),
    costo DECIMAL(15, 2), subtotal DECIMAL(15, 2), cliente_id BIGINT, metodo VARCHAR(15));
INSERT INTO pv
SELECT s.n,
       TIMESTAMP(DATE(DATE_SUB(@ahora, INTERVAL FLOOR((8000 - s.n) * 364 / 8000) DAY)),
                 MAKETIME(13 + s.n % 10, (s.n * 7) % 60, 0)),
       p.id, 1 + s.n % 3, p.precio, p.costo, p.precio * (1 + s.n % 3),
       IF(s.n % 3 = 0, m.cliente_id, NULL),
       ELT(1 + s.n % 4, 'EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'EFECTIVO')
FROM seq s
JOIN pp p ON p.n = 1 + (s.n * 13) % 460
JOIN pm m ON m.n = 1 + s.n % 1490
WHERE s.n <= 8000;

INSERT INTO venta (numero, cliente_id, fecha, subtotal, descuento, iva_porcentaje, impuesto, total, metodo_pago,
                   referencia_pago, monto_recibido, estado, motivo_anulacion, anulada_por, anulada_en, created_at,
                   updated_at, created_by, updated_by)
SELECT CONCAT('V-', LPAD(@v + v.n - 1, 6, '0')), v.cliente_id, v.fecha, v.subtotal, 0, @iva,
       ROUND(v.subtotal * @iva / 100), ROUND(v.subtotal * (1 + @iva / 100)), v.metodo,
       IF(v.metodo = 'EFECTIVO', NULL, CONCAT('REF-V', v.n)),
       IF(v.metodo = 'EFECTIVO', ROUND(v.subtotal * (1 + @iva / 100)), NULL),
       IF(v.n % 100 = 0, 'ANULADA', 'PAGADA'), IF(v.n % 100 = 0, 'Error de digitación', NULL),
       IF(v.n % 100 = 0, @admin, NULL), IF(v.n % 100 = 0, DATE_ADD(v.fecha, INTERVAL 1 HOUR), NULL),
       v.fecha, v.fecha, @vendedor, @vendedor
FROM pv v;

DROP TEMPORARY TABLE IF EXISTS pv_id;
CREATE TEMPORARY TABLE pv_id (n INT PRIMARY KEY, id BIGINT);
INSERT INTO pv_id
SELECT CAST(SUBSTRING(numero, 3) AS UNSIGNED) - @v + 1, id
FROM venta
WHERE CAST(SUBSTRING(numero, 3) AS UNSIGNED) BETWEEN @v AND @v + 7999;

INSERT INTO venta_detalle (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal)
SELECT i.id, v.producto_id, v.cantidad, v.precio, v.costo, v.subtotal FROM pv v JOIN pv_id i ON i.n = v.n;

INSERT INTO movimiento_inventario (producto_id, tipo, cantidad, costo_unitario, stock_resultante, referencia_tipo,
                                   referencia_id, referencia_numero, motivo, usuario_id, fecha)
SELECT v.producto_id, 'SALIDA_VENTA', v.cantidad, v.costo, 5000, 'VENTA', i.id,
       CONCAT('V-', LPAD(@v + v.n - 1, 6, '0')), NULL, @vendedor, v.fecha
FROM pv v JOIN pv_id i ON i.n = v.n;

UPDATE consecutivo SET siguiente = siguiente + 8000, updated_at = @ahora WHERE tipo = 'VENTA' AND @ya = 0;

-- ---------------------------------------------------------------- Resumen
SELECT (SELECT COUNT(*) FROM producto) AS productos, (SELECT COUNT(*) FROM cliente) AS clientes,
       (SELECT COUNT(*) FROM motocicleta) AS motos, (SELECT COUNT(*) FROM orden_trabajo) AS ordenes,
       (SELECT COUNT(*) FROM venta) AS ventas, (SELECT COUNT(*) FROM movimiento_inventario) AS movimientos;
