-- F12: V11 creó ix_movimiento_inventario_fecha sobre (fecha), igual a ix_movimiento_fecha de V4.
-- MySQL lo acepta con un aviso de obsolescencia (código 1831) y lo rechazará en una versión futura.
DROP INDEX ix_movimiento_inventario_fecha ON movimiento_inventario;
