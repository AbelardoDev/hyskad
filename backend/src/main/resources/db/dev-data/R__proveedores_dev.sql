-- SOLO DESARROLLO (perfil dev/e2e): proveedores ficticios de repuestos con NIT válido (DV DIAN).
-- INSERT IGNORE: no pisa cambios hechos a mano (el documento es único por tipo).
INSERT IGNORE INTO proveedor (tipo_documento, numero_documento, razon_social, contacto, telefono, email, direccion,
                              activo, created_at, updated_at) VALUES
    ('NIT', '890904996-1', 'Distribuidora de Repuestos del Caribe S.A.S.', 'Marta Ríos', '6047853210',
     'pedidos@repuestoscaribe.test', 'Calle 30 # 12-45, Barranquilla', TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('NIT', '800231967-1', 'Lubricantes y Filtros de Colombia S.A.', 'Andrés Gil', '3157778899',
     'ventas@lubrifiltros.test', 'Carrera 50 # 8-20, Medellín', TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('NIT', '901345678-2', 'Llantas Sinú S.A.S.', 'Paola Díaz', '3004441122',
     NULL, 'Avenida Primera # 25-10, Montería', TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('NIT', '830512345-4', 'Importadora Eléctrica Moto Partes Ltda.', NULL, '6013210987',
     'comercial@motopartes.test', NULL, FALSE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));
