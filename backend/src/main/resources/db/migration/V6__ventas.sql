-- V6: ventas de mostrador (RN-18 a RN-21). Precios y costos se congelan en el detalle; la venta
-- guarda el IVA aplicado (RN-03), el monto recibido en efectivo (para el cambio) y su anulación.
-- Quien vende es created_by (BaseEntity).

CREATE TABLE venta (
    id                BIGINT        NOT NULL AUTO_INCREMENT,
    numero            VARCHAR(20)   NOT NULL,
    cliente_id        BIGINT        NULL,
    fecha             DATETIME(6)   NOT NULL,
    subtotal          DECIMAL(15,2) NOT NULL,
    descuento         DECIMAL(15,2) NOT NULL,
    iva_porcentaje    DECIMAL(5,2)  NOT NULL,
    impuesto          DECIMAL(15,2) NOT NULL,
    total             DECIMAL(15,2) NOT NULL,
    metodo_pago       VARCHAR(15)   NOT NULL,
    referencia_pago   VARCHAR(60)   NULL,
    monto_recibido    DECIMAL(15,2) NULL,
    estado            VARCHAR(10)   NOT NULL,
    motivo_anulacion  VARCHAR(500)  NULL,
    anulada_por       BIGINT        NULL,
    anulada_en        DATETIME(6)   NULL,
    created_at        DATETIME(6)   NOT NULL,
    updated_at        DATETIME(6)   NOT NULL,
    created_by        BIGINT        NULL,
    updated_by        BIGINT        NULL,
    CONSTRAINT pk_venta PRIMARY KEY (id),
    CONSTRAINT uq_venta_numero UNIQUE (numero),
    CONSTRAINT fk_venta_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id),
    CONSTRAINT ck_venta_metodo CHECK (metodo_pago IN ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO')),
    CONSTRAINT ck_venta_estado CHECK (estado IN ('PAGADA', 'ANULADA')),
    -- RN-05: descuento entre 0 y el subtotal
    CONSTRAINT ck_venta_descuento CHECK (descuento >= 0 AND descuento <= subtotal),
    CONSTRAINT ck_venta_montos CHECK (subtotal >= 0 AND impuesto >= 0 AND total >= 0),
    CONSTRAINT fk_venta_anulada_por FOREIGN KEY (anulada_por) REFERENCES usuario (id),
    CONSTRAINT fk_venta_created_by FOREIGN KEY (created_by) REFERENCES usuario (id),
    CONSTRAINT fk_venta_updated_by FOREIGN KEY (updated_by) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_venta_fecha ON venta (fecha);
CREATE INDEX ix_venta_cliente ON venta (cliente_id);
CREATE INDEX ix_venta_vendedor ON venta (created_by, fecha);

CREATE TABLE venta_detalle (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    venta_id         BIGINT        NOT NULL,
    producto_id      BIGINT        NOT NULL,
    cantidad         DECIMAL(12,2) NOT NULL,
    precio_unitario  DECIMAL(15,2) NOT NULL,
    costo_unitario   DECIMAL(15,2) NOT NULL,
    subtotal         DECIMAL(15,2) NOT NULL,
    CONSTRAINT pk_venta_detalle PRIMARY KEY (id),
    CONSTRAINT uq_venta_detalle_producto UNIQUE (venta_id, producto_id),
    CONSTRAINT fk_venta_detalle_venta FOREIGN KEY (venta_id) REFERENCES venta (id),
    CONSTRAINT fk_venta_detalle_producto FOREIGN KEY (producto_id) REFERENCES producto (id),
    CONSTRAINT ck_venta_detalle_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_venta_detalle_valores CHECK (precio_unitario >= 0 AND costo_unitario >= 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_venta_detalle_producto ON venta_detalle (producto_id);
