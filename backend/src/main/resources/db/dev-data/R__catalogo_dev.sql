-- SOLO DESARROLLO (perfil dev/e2e): 6 categorías y 40 productos de un taller de motos. El stock
-- inicial entra como ENTRADA_AJUSTE (con su costo) para que el kárdex cuadre con el producto.
-- INSERT IGNORE / NOT EXISTS: no pisa cambios hechos a mano. Precios en COP sin IVA.
INSERT IGNORE INTO categoria (nombre, descripcion, activo, created_at, updated_at) VALUES
    ('Lubricantes', 'Aceites de motor, caja y refrigerantes', TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Filtros', 'Filtros de aceite, aire y combustible', TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Frenos', 'Pastillas, bandas, discos y líquido de frenos', TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Transmisión', 'Kits de arrastre, cadenas, piñones y guayas', TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Llantas', 'Llantas y neumáticos para moto', TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Eléctricos', 'Bujías, bombillos, baterías y fusibles', TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));

INSERT IGNORE INTO producto (codigo, nombre, marca, categoria_id, unidad, precio_venta, costo_promedio, stock_actual, stock_reservado, stock_minimo, activo, version, created_at, updated_at)
SELECT p.codigo, p.nombre, p.marca, c.id, p.unidad, p.precio, p.costo, p.stock, 0, p.minimo, TRUE, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
FROM (
    SELECT 'LUB-MOT4-20W50' AS codigo, 'Aceite 4T 20W-50 1 L' AS nombre, 'Motul' AS marca, 'Lubricantes' AS categoria, 'UNIDAD' AS unidad, 38000 AS precio, 12 AS minimo, 40 AS stock, 27500 AS costo
    UNION ALL SELECT 'LUB-MOT4-10W40', 'Aceite 4T 10W-40 semisintético 1 L', 'Motul', 'Lubricantes', 'UNIDAD', 46000, 10, 25, 33800
    UNION ALL SELECT 'LUB-MOB-20W50', 'Aceite Super Moto 4T 20W-50 1 L', 'Mobil', 'Lubricantes', 'UNIDAD', 32000, 12, 8, 23000
    UNION ALL SELECT 'LUB-CAS-2T', 'Aceite 2T Actevo 1 L', 'Castrol', 'Lubricantes', 'UNIDAD', 29000, 6, 14, 20500
    UNION ALL SELECT 'LUB-GRASA', 'Grasa de litio multipropósito 500 g', 'Shell', 'Lubricantes', 'UNIDAD', 18000, 4, 9, 12000
    UNION ALL SELECT 'LUB-REF-GAL', 'Refrigerante para moto', 'Prestone', 'Lubricantes', 'GALON', 52000, 2, 6, 38000
    UNION ALL SELECT 'LUB-GRANEL-20W50', 'Aceite 4T 20W-50 a granel', 'Terpel', 'Lubricantes', 'LITRO', 26000, 20, 60, 17500
    UNION ALL SELECT 'FIL-ACE-YBR', 'Filtro de aceite YBR 125 / FZ', 'Yamaha', 'Filtros', 'UNIDAD', 16000, 8, 22, 9800
    UNION ALL SELECT 'FIL-ACE-PUL', 'Filtro de aceite Pulsar 180/200', 'Bajaj', 'Filtros', 'UNIDAD', 14000, 8, 5, 8500
    UNION ALL SELECT 'FIL-ACE-CB', 'Filtro de aceite CB 190R / XRE 300', 'Honda', 'Filtros', 'UNIDAD', 21000, 6, 12, 13500
    UNION ALL SELECT 'FIL-AIR-NKD', 'Filtro de aire NKD 125', 'AKT', 'Filtros', 'UNIDAD', 19000, 4, 7, 11500
    UNION ALL SELECT 'FIL-AIR-BOX', 'Filtro de aire Boxer CT 100', 'Bajaj', 'Filtros', 'UNIDAD', 17000, 4, 3, 10200
    UNION ALL SELECT 'FIL-GAS-UNI', 'Filtro de gasolina universal', 'Genérico', 'Filtros', 'UNIDAD', 6000, 10, 30, 3200
    UNION ALL SELECT 'FRE-PAS-YBR', 'Pastillas de freno delanteras YBR 125', 'Vesrah', 'Frenos', 'PAR', 32000, 6, 16, 21000
    UNION ALL SELECT 'FRE-PAS-PUL', 'Pastillas de freno delanteras Pulsar NS', 'Brembo', 'Frenos', 'PAR', 54000, 4, 10, 38000
    UNION ALL SELECT 'FRE-PAS-CB', 'Pastillas de freno CB 190R', 'Honda', 'Frenos', 'PAR', 48000, 4, 2, 33000
    UNION ALL SELECT 'FRE-BAN-BOX', 'Bandas de freno traseras Boxer', 'Bajaj', 'Frenos', 'PAR', 22000, 6, 18, 13800
    UNION ALL SELECT 'FRE-LIQ-DOT4', 'Líquido de frenos DOT 4 250 ml', 'Motul', 'Frenos', 'UNIDAD', 21000, 6, 11, 14500
    UNION ALL SELECT 'FRE-DIS-FZ', 'Disco de freno delantero FZ 2.0', 'Yamaha', 'Frenos', 'UNIDAD', 145000, 1, 2, 104000
    UNION ALL SELECT 'TRA-KIT-YBR', 'Kit de arrastre YBR 125 (428H)', 'DID', 'Transmisión', 'KIT', 165000, 3, 6, 118000
    UNION ALL SELECT 'TRA-KIT-PUL', 'Kit de arrastre Pulsar 180 (428)', 'Riffel', 'Transmisión', 'KIT', 148000, 3, 4, 105000
    UNION ALL SELECT 'TRA-KIT-NKD', 'Kit de arrastre NKD 125', 'Choho', 'Transmisión', 'KIT', 98000, 3, 1, 69000
    UNION ALL SELECT 'TRA-CAD-428', 'Cadena 428H x 120 eslabones', 'DID', 'Transmisión', 'UNIDAD', 78000, 3, 7, 54000
    UNION ALL SELECT 'TRA-GUA-CLU', 'Guaya de clutch universal', 'Genérico', 'Transmisión', 'UNIDAD', 12000, 8, 20, 6500
    UNION ALL SELECT 'TRA-GUA-ACE', 'Guaya de acelerador universal', 'Genérico', 'Transmisión', 'UNIDAD', 11000, 8, 6, 5800
    UNION ALL SELECT 'TRA-GUA-ROL', 'Guaya en rollo para frenos y clutch', 'Genérico', 'Transmisión', 'METRO', 4500, 10, 45, 2300
    UNION ALL SELECT 'LLA-90-90-18', 'Llanta 90/90-18 trasera', 'Michelin', 'Llantas', 'UNIDAD', 235000, 2, 5, 172000
    UNION ALL SELECT 'LLA-275-18', 'Llanta 2.75-18 delantera', 'Pirelli', 'Llantas', 'UNIDAD', 168000, 2, 4, 121000
    UNION ALL SELECT 'LLA-100-80-17', 'Llanta 100/80-17 delantera', 'Metzeler', 'Llantas', 'UNIDAD', 265000, 2, 1, 195000
    UNION ALL SELECT 'LLA-130-70-17', 'Llanta 130/70-17 trasera', 'Michelin', 'Llantas', 'UNIDAD', 345000, 2, 3, 255000
    UNION ALL SELECT 'LLA-NEU-18', 'Neumático rin 18', 'Kenda', 'Llantas', 'UNIDAD', 26000, 6, 15, 16500
    UNION ALL SELECT 'ELE-BUJ-CR7', 'Bujía CR7HSA', 'NGK', 'Eléctricos', 'UNIDAD', 13000, 15, 48, 7800
    UNION ALL SELECT 'ELE-BUJ-DR8', 'Bujía DR8EA', 'NGK', 'Eléctricos', 'UNIDAD', 15000, 10, 9, 9200
    UNION ALL SELECT 'ELE-BUJ-IRI', 'Bujía de iridio CR8EIX', 'NGK', 'Eléctricos', 'UNIDAD', 58000, 3, 6, 41000
    UNION ALL SELECT 'ELE-BOM-H4', 'Bombillo H4 12 V 35/35 W', 'Osram', 'Eléctricos', 'UNIDAD', 14000, 10, 25, 8200
    UNION ALL SELECT 'ELE-BOM-STOP', 'Bombillo de stop 12 V 21/5 W', 'Philips', 'Eléctricos', 'UNIDAD', 4000, 15, 12, 2100
    UNION ALL SELECT 'ELE-BOM-LED', 'Bombillo LED H4 para moto', 'Osram', 'Eléctricos', 'UNIDAD', 62000, 2, 5, 44000
    UNION ALL SELECT 'ELE-BAT-5L', 'Batería 12N5L-BS', 'Yuasa', 'Eléctricos', 'UNIDAD', 128000, 2, 4, 92000
    UNION ALL SELECT 'ELE-BAT-7A', 'Batería YTX7A-BS de gel', 'MAC', 'Eléctricos', 'UNIDAD', 165000, 2, 0, 0
    UNION ALL SELECT 'ELE-FUS-10A', 'Fusible de cuchilla 10 A', 'Genérico', 'Eléctricos', 'UNIDAD', 1000, 20, 80, 400
) p
JOIN categoria c ON c.nombre = p.categoria;

INSERT INTO movimiento_inventario (producto_id, tipo, cantidad, costo_unitario, stock_resultante, motivo, fecha)
SELECT p.id, 'ENTRADA_AJUSTE', p.stock_actual, p.costo_promedio, p.stock_actual,
       'Inventario inicial (datos de desarrollo)', UTC_TIMESTAMP(6)
FROM producto p
WHERE p.stock_actual > 0
  AND NOT EXISTS (SELECT 1 FROM movimiento_inventario m WHERE m.producto_id = p.id);
