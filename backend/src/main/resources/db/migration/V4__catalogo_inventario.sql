-- V4: catálogo (categorías y productos) e inventario (movimientos), RF17, RF18, RN-07 a RN-15.
-- Dinero DECIMAL(15,2); cantidades DECIMAL(12,2) (hay unidades fraccionables: litro, galón, metro).
-- El stock solo cambia por movimientos; `version` sirve de bloqueo optimista además del
-- PESSIMISTIC_WRITE que toma cada movimiento (RN-12).

CREATE TABLE categoria (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    nombre       VARCHAR(80)  NOT NULL,
    descripcion  VARCHAR(255) NULL,
    activo       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   DATETIME(6)  NOT NULL,
    updated_at   DATETIME(6)  NOT NULL,
    created_by   BIGINT       NULL,
    updated_by   BIGINT       NULL,
    CONSTRAINT pk_categoria PRIMARY KEY (id),
    CONSTRAINT uq_categoria_nombre UNIQUE (nombre),
    CONSTRAINT fk_categoria_created_by FOREIGN KEY (created_by) REFERENCES usuario (id),
    CONSTRAINT fk_categoria_updated_by FOREIGN KEY (updated_by) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE producto (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    codigo           VARCHAR(40)   NOT NULL,
    nombre           VARCHAR(150)  NOT NULL,
    descripcion      VARCHAR(500)  NULL,
    marca            VARCHAR(80)   NULL,
    categoria_id     BIGINT        NOT NULL,
    unidad           VARCHAR(10)   NOT NULL,
    precio_venta     DECIMAL(15,2) NOT NULL,
    costo_promedio   DECIMAL(15,2) NOT NULL DEFAULT 0,
    stock_actual     DECIMAL(12,2) NOT NULL DEFAULT 0,
    stock_reservado  DECIMAL(12,2) NOT NULL DEFAULT 0,
    stock_minimo     DECIMAL(12,2) NOT NULL DEFAULT 0,
    activo           BOOLEAN       NOT NULL DEFAULT TRUE,
    version          BIGINT        NOT NULL DEFAULT 0,
    created_at       DATETIME(6)   NOT NULL,
    updated_at       DATETIME(6)   NOT NULL,
    created_by       BIGINT        NULL,
    updated_by       BIGINT        NULL,
    CONSTRAINT pk_producto PRIMARY KEY (id),
    CONSTRAINT uq_producto_codigo UNIQUE (codigo),
    CONSTRAINT fk_producto_categoria FOREIGN KEY (categoria_id) REFERENCES categoria (id),
    CONSTRAINT ck_producto_unidad CHECK (unidad IN ('UNIDAD', 'LITRO', 'GALON', 'KIT', 'PAR', 'METRO')),
    CONSTRAINT ck_producto_precio CHECK (precio_venta > 0),
    CONSTRAINT ck_producto_costo CHECK (costo_promedio >= 0),
    -- RN-10: nunca stock negativo ni más reservado que existente
    CONSTRAINT ck_producto_stock CHECK (stock_actual >= 0),
    CONSTRAINT ck_producto_reservado CHECK (stock_reservado >= 0 AND stock_reservado <= stock_actual),
    CONSTRAINT ck_producto_minimo CHECK (stock_minimo >= 0),
    CONSTRAINT fk_producto_created_by FOREIGN KEY (created_by) REFERENCES usuario (id),
    CONSTRAINT fk_producto_updated_by FOREIGN KEY (updated_by) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_producto_nombre ON producto (nombre);
CREATE INDEX ix_producto_marca ON producto (marca);
CREATE INDEX ix_producto_categoria ON producto (categoria_id);

-- RN-11: inmutable (solo INSERT). La referencia (venta, compra, orden, ajuste) no es FK para no
-- acoplar el inventario a los demás módulos.
CREATE TABLE movimiento_inventario (
    id                 BIGINT        NOT NULL AUTO_INCREMENT,
    producto_id        BIGINT        NOT NULL,
    tipo               VARCHAR(30)   NOT NULL,
    cantidad           DECIMAL(12,2) NOT NULL,
    costo_unitario     DECIMAL(15,2) NOT NULL,
    stock_resultante   DECIMAL(12,2) NOT NULL,
    referencia_tipo    VARCHAR(20)   NULL,
    referencia_id      BIGINT        NULL,
    referencia_numero  VARCHAR(30)   NULL,
    motivo             VARCHAR(500)  NULL,
    usuario_id         BIGINT        NULL,
    fecha              DATETIME(6)   NOT NULL,
    CONSTRAINT pk_movimiento_inventario PRIMARY KEY (id),
    CONSTRAINT fk_movimiento_producto FOREIGN KEY (producto_id) REFERENCES producto (id),
    CONSTRAINT fk_movimiento_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id),
    CONSTRAINT ck_movimiento_tipo CHECK (tipo IN ('ENTRADA_COMPRA', 'SALIDA_VENTA', 'SALIDA_ORDEN', 'ENTRADA_AJUSTE',
        'SALIDA_AJUSTE', 'DEVOLUCION_ANULACION_VENTA', 'SALIDA_ANULACION_COMPRA')),
    CONSTRAINT ck_movimiento_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_movimiento_costo CHECK (costo_unitario >= 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_movimiento_producto_fecha ON movimiento_inventario (producto_id, fecha);
CREATE INDEX ix_movimiento_fecha ON movimiento_inventario (fecha);
CREATE INDEX ix_movimiento_usuario ON movimiento_inventario (usuario_id);
