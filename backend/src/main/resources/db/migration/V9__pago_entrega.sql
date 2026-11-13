-- V9: pago (RF25, RN-35) y entrega (RF28, RN-36) de la orden de trabajo.

-- Pago total y único por orden: el índice único sobre orden_id impide un segundo pago.
CREATE TABLE pago (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    orden_id        BIGINT        NOT NULL,
    monto           DECIMAL(15,2) NOT NULL,
    metodo          VARCHAR(15)   NOT NULL,
    referencia      VARCHAR(60)   NULL,
    monto_recibido  DECIMAL(15,2) NULL,
    fecha           DATETIME(6)   NOT NULL,
    usuario_id      BIGINT        NULL,
    CONSTRAINT pk_pago PRIMARY KEY (id),
    CONSTRAINT uq_pago_orden UNIQUE (orden_id),
    CONSTRAINT fk_pago_orden FOREIGN KEY (orden_id) REFERENCES orden_trabajo (id),
    CONSTRAINT fk_pago_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id),
    CONSTRAINT ck_pago_metodo CHECK (metodo IN ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO')),
    CONSTRAINT ck_pago_monto CHECK (monto >= 0),
    CONSTRAINT ck_pago_recibido CHECK (monto_recibido IS NULL OR monto_recibido >= monto)
);

ALTER TABLE orden_trabajo
    ADD COLUMN fecha_entrega         DATETIME(6)   NULL AFTER fecha_finalizacion,
    ADD COLUMN entregada_por         BIGINT        NULL AFTER fecha_entrega,
    ADD COLUMN observaciones_entrega VARCHAR(1000) NULL AFTER entregada_por,
    ADD CONSTRAINT fk_orden_trabajo_entregada_por FOREIGN KEY (entregada_por) REFERENCES usuario (id);

-- Cuentas pendientes (RN-37): órdenes finalizadas ordenadas por fecha de finalización.
CREATE INDEX ix_orden_trabajo_estado_finalizacion ON orden_trabajo (estado, fecha_finalizacion);
