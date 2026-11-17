-- V11: configuración editable del taller (F11) e índices de reportes. Agrega el email del taller y
-- el texto de autorización de tratamiento de datos (RN-45), que pasa de los textos de la interfaz
-- a la BD (párrafos separados por una línea en blanco).

ALTER TABLE configuracion MODIFY valor VARCHAR(4000) NOT NULL;

INSERT INTO configuracion (clave, valor, descripcion, created_at, updated_at) VALUES
    ('taller.email', 'contacto@hyskad.local', 'Correo de contacto del taller', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('privacidad.texto_autorizacion', CONCAT(
        'En cumplimiento de la Ley 1581 de 2012 y sus decretos reglamentarios, el cliente autoriza al taller para recolectar, almacenar, usar y actualizar sus datos personales (identificación, contacto y datos de sus vehículos).',
        CHAR(10), CHAR(10),
        'Los datos se usan solo para prestar los servicios de venta y mantenimiento, registrar el historial de cada moto, avisarle del estado de sus órdenes y enviarle comprobantes y presupuestos.',
        CHAR(10), CHAR(10),
        'El titular puede conocer, actualizar, rectificar y pedir la supresión de sus datos, y revocar esta autorización en cualquier momento, solicitándolo en el taller.',
        CHAR(10), CHAR(10),
        'Si el cliente no autoriza, se le seguirá atendiendo, pero no recibirá correos del sistema.'),
        'Texto de autorización de tratamiento de datos que se muestra al registrar un cliente (RN-45)',
        UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));

-- Reportes y dashboard (F11): ingresos por fecha de entrega y movimientos por rango de fechas.
CREATE INDEX ix_orden_trabajo_estado_entrega ON orden_trabajo (estado, fecha_entrega);
CREATE INDEX ix_movimiento_inventario_fecha ON movimiento_inventario (fecha);
