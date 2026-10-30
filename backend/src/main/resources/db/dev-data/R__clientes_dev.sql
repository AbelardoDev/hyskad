-- SOLO DESARROLLO (perfil dev/e2e): 10 clientes ficticios (uno con NIT) y 15 motos de las tres
-- clases de placa. INSERT IGNORE: no pisa cambios hechos a mano (documento y placa son únicos).
INSERT IGNORE INTO cliente (tipo_documento, numero_documento, nombres, apellidos, razon_social, telefono, email,
                            direccion, ciudad, acepta_tratamiento_datos, fecha_aceptacion_datos, activo,
                            created_at, updated_at) VALUES
    ('CC', '1067845123', 'Carlos Andrés', 'Pérez Gómez', NULL, '3004567812', 'carlos.perez@correo.test', 'Calle 27 # 5-40', 'Montería', TRUE, UTC_TIMESTAMP(6), TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('CC', '1003456789', 'María José', 'Rodríguez Díaz', NULL, '3112345678', 'mariajo@correo.test', 'Carrera 9 # 30-12', 'Montería', TRUE, UTC_TIMESTAMP(6), TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('CC', '78123456', 'Luis Fernando', 'Martínez Ruiz', NULL, '3205551234', NULL, NULL, 'Cereté', FALSE, NULL, TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('TI', '1067998877', 'Santiago', 'López Herrera', NULL, '3016667788', NULL, 'Barrio La Granja', 'Montería', TRUE, UTC_TIMESTAMP(6), TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('CE', 'E4589123', 'Andrea', 'Silva Mendoza', NULL, '3159876543', 'andrea.silva@correo.test', NULL, 'Montería', TRUE, UTC_TIMESTAMP(6), TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('PA', 'AB1234567', 'John', 'Smith Walker', NULL, '3021112233', 'john.smith@correo.test', NULL, 'Lorica', FALSE, NULL, TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('PPT', '4567890', 'José Gregorio', 'Hernández Rivas', NULL, '3134445566', NULL, 'Calle 41 # 2-15', 'Montería', TRUE, UTC_TIMESTAMP(6), TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('NIT', '900123456-8', NULL, NULL, 'Mensajería Rápida del Sinú S.A.S.', '6047891234', 'flota@mensajeriasinu.test', 'Avenida Circunvalar # 38-20', 'Montería', TRUE, UTC_TIMESTAMP(6), TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('CC', '50987654', 'Diana Marcela', 'Castro Peña', NULL, '3007778899', 'diana.castro@correo.test', NULL, 'Sahagún', TRUE, UTC_TIMESTAMP(6), TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('CC', '1065432198', 'Jorge Eliécer', 'Vargas Ortiz', NULL, '3183332211', NULL, NULL, 'Montería', FALSE, NULL, FALSE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));

INSERT IGNORE INTO motocicleta (cliente_id, placa, marca, modelo, anio, vin, cilindrada_cc, color, activo, created_at, updated_at)
SELECT c.id, m.placa, m.marca, m.modelo, m.anio, m.vin, m.cilindrada_cc, m.color, m.activo, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
FROM (
    SELECT 'CC' AS tipo, '1067845123' AS documento, 'ABC12D' AS placa, 'Yamaha' AS marca, 'FZ 2.0' AS modelo, 2021 AS anio, '9C6KE1220M0012345' AS vin, 149 AS cilindrada_cc, 'Azul' AS color, TRUE AS activo
    UNION ALL SELECT 'CC', '1067845123', 'XYZ45E', 'Honda', 'CB 190R', 2023, NULL, 184, 'Rojo', TRUE
    UNION ALL SELECT 'CC', '1003456789', 'KLM78F', 'Suzuki', 'Gixxer 150', 2022, NULL, 155, 'Negro', TRUE
    UNION ALL SELECT 'CC', '78123456', 'BCD34G', 'Bajaj', 'Pulsar NS 200', 2020, '9FLA36FZ4LBA12345', 199, 'Blanco', TRUE
    UNION ALL SELECT 'CC', '78123456', 'QWE12', 'Yamaha', 'DT 125', 1998, NULL, 123, 'Rojo', TRUE
    UNION ALL SELECT 'TI', '1067998877', 'HJK56L', 'AKT', 'NKD 125', 2022, NULL, 125, 'Gris', TRUE
    UNION ALL SELECT 'CE', 'E4589123', 'MNP90R', 'Honda', 'XRE 300', 2024, NULL, 291, 'Blanco', TRUE
    UNION ALL SELECT 'PA', 'AB1234567', 'RST23U', 'KTM', 'Duke 390', 2023, NULL, 373, 'Naranja', TRUE
    UNION ALL SELECT 'PPT', '4567890', 'TUV67W', 'Victory', 'Advance R 125', 2021, NULL, 125, 'Negro', TRUE
    UNION ALL SELECT 'NIT', '900123456-8', 'FGH11A', 'Honda', 'CB 125F', 2024, NULL, 124, 'Rojo', TRUE
    UNION ALL SELECT 'NIT', '900123456-8', 'FGH12B', 'Honda', 'CB 125F', 2024, NULL, 124, 'Rojo', TRUE
    UNION ALL SELECT 'NIT', '900123456-8', 'FGH13C', 'Honda', 'CB 125F', 2024, NULL, 124, 'Rojo', FALSE
    UNION ALL SELECT 'NIT', '900123456-8', '123ABC', 'Bajaj', 'RE Motocarro', 2019, NULL, 236, 'Verde', TRUE
    UNION ALL SELECT 'CC', '50987654', 'DEF45', 'Suzuki', 'AX 100', 2005, NULL, 98, 'Azul', TRUE
    UNION ALL SELECT 'CC', '1065432198', 'GHI89J', 'TVS', 'Apache RTR 160', 2020, NULL, 159, 'Negro', FALSE
) m
JOIN cliente c ON c.tipo_documento = m.tipo AND c.numero_documento = m.documento;
