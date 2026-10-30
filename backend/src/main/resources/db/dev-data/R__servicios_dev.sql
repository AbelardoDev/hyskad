-- SOLO DESARROLLO (perfil dev/e2e): servicios típicos de un taller de motos con precios de referencia.
-- INSERT IGNORE: no pisa cambios hechos a mano (el nombre es único).
INSERT IGNORE INTO servicio (nombre, descripcion, precio_base, tiempo_estimado_min, activo, created_at, updated_at) VALUES
    ('Cambio de aceite', 'Drenaje, cambio de aceite y revisión del filtro', 25000, 30, TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Sincronización', 'Limpieza de carburador o inyectores, bujía y ajuste de ralentí', 80000, 120, TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Mantenimiento de frenos', 'Revisión y cambio de pastillas o bandas, purga del líquido', 45000, 60, TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Cambio de kit de arrastre', 'Cadena, piñón y corona con lubricación y tensión', 40000, 60, TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Revisión eléctrica', 'Diagnóstico de batería, regulador, luces y cableado', 50000, 90, TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Mantenimiento general', 'Revisión de 30 puntos, ajustes y lubricación general', 120000, 180, TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Cambio de llanta', 'Desmontaje, montaje y balanceo de una llanta', 20000, 30, TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Ajuste de embrague', 'Ajuste de guaya y revisión de discos', 30000, 45, TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Mantenimiento de suspensión', 'Cambio de aceite y retenedores de las barras delanteras', 90000, 150, TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Lavado de motor', 'Lavado y desengrase del motor y la transmisión', 15000, 30, TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Revisión técnico-mecánica', 'Inspección previa a la revisión técnico-mecánica', 35000, 45, TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Reparación de motor', 'Desarme, rectificación y armado del motor (mano de obra)', 350000, 960, FALSE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));
