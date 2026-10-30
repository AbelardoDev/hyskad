-- SOLO DESARROLLO (perfil dev): un usuario por rol para probar permisos.
-- Contraseña de todos: Hyskad2026 (hash BCrypt cost 12). Documentada en el README.
-- INSERT IGNORE: no pisa cambios hechos a mano sobre estos usuarios.
INSERT IGNORE INTO usuario (nombre, email, password_hash, rol, activo, idioma, debe_cambiar_password, created_at, updated_at) VALUES
    ('Admin Dev', 'admin@hyskad.local', '$2a$12$L8coA2WhGSPz4duAMIC18./7/CxfQRzV41C7VLolskPp8TNaRGOQu', 'ADMIN', TRUE, 'es', FALSE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Almacén Dev', 'almacen@hyskad.local', '$2a$12$L8coA2WhGSPz4duAMIC18./7/CxfQRzV41C7VLolskPp8TNaRGOQu', 'ALMACEN', TRUE, 'es', FALSE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Vendedor Dev', 'vendedor@hyskad.local', '$2a$12$L8coA2WhGSPz4duAMIC18./7/CxfQRzV41C7VLolskPp8TNaRGOQu', 'VENDEDOR', TRUE, 'es', FALSE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('Mecánico Dev', 'mecanico@hyskad.local', '$2a$12$L8coA2WhGSPz4duAMIC18./7/CxfQRzV41C7VLolskPp8TNaRGOQu', 'MECANICO', TRUE, 'en', FALSE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));
