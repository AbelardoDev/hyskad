-- V5: proveedores y compras (RF20, RF21, RN-16, RN-17, RN-40).
-- La compra guarda el IVA aplicado (porcentaje y valor, RN-03) y los datos de su anulación.
-- Quien la registra es created_by (BaseEntity).

CREATE TABLE proveedor (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    tipo_documento    VARCHAR(5)   NOT NULL,
    numero_documento  VARCHAR(20)  NOT NULL,
    razon_social      VARCHAR(150) NOT NULL,
    contacto          VARCHAR(120) NULL,
    telefono          VARCHAR(10)  NULL,
    email             VARCHAR(254) NULL,
    direccion         VARCHAR(200) NULL,
    activo            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        DATETIME(6)  NOT NULL,
    updated_at        DATETIME(6)  NOT NULL,
    created_by        BIGINT       NULL,
    updated_by        BIGINT       NULL,
    CONSTRAINT pk_proveedor PRIMARY KEY (id),
    CONSTRAINT uq_proveedor_documento UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT ck_proveedor_tipo_documento CHECK (tipo_documento IN ('CC', 'TI', 'CE', 'PA', 'PPT', 'NIT')),
    CONSTRAINT fk_proveedor_created_by FOREIGN KEY (created_by) REFERENCES usuario (id),
    CONSTRAINT fk_proveedor_updated_by FOREIGN KEY (updated_by) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_proveedor_razon_social ON proveedor (razon_social);

CREATE TABLE compra (
    id                        BIGINT        NOT NULL AUTO_INCREMENT,
    numero                    VARCHAR(20)   NOT NULL,
    proveedor_id              BIGINT        NOT NULL,
    numero_factura_proveedor  VARCHAR(40)   NOT NULL,
    fecha                     DATE          NOT NULL,
    subtotal                  DECIMAL(15,2) NOT NULL,
    iva_porcentaje            DECIMAL(5,2)  NOT NULL,
    impuesto                  DECIMAL(15,2) NOT NULL,
    total                     DECIMAL(15,2) NOT NULL,
    estado                    VARCHAR(12)   NOT NULL,
    motivo_anulacion          VARCHAR(500)  NULL,
    anulada_por               BIGINT        NULL,
    anulada_en                DATETIME(6)   NULL,
    created_at                DATETIME(6)   NOT NULL,
    updated_at                DATETIME(6)   NOT NULL,
    created_by                BIGINT        NULL,
    updated_by                BIGINT        NULL,
    CONSTRAINT pk_compra PRIMARY KEY (id),
    CONSTRAINT uq_compra_numero UNIQUE (numero),
    CONSTRAINT fk_compra_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedor (id),
    CONSTRAINT ck_compra_estado CHECK (estado IN ('REGISTRADA', 'ANULADA')),
    CONSTRAINT ck_compra_montos CHECK (subtotal >= 0 AND impuesto >= 0 AND total >= 0),
    CONSTRAINT fk_compra_anulada_por FOREIGN KEY (anulada_por) REFERENCES usuario (id),
    CONSTRAINT fk_compra_created_by FOREIGN KEY (created_by) REFERENCES usuario (id),
    CONSTRAINT fk_compra_updated_by FOREIGN KEY (updated_by) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_compra_proveedor_factura ON compra (proveedor_id, numero_factura_proveedor);
CREATE INDEX ix_compra_fecha ON compra (fecha);

CREATE TABLE compra_detalle (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    compra_id       BIGINT        NOT NULL,
    producto_id     BIGINT        NOT NULL,
    cantidad        DECIMAL(12,2) NOT NULL,
    costo_unitario  DECIMAL(15,2) NOT NULL,
    subtotal        DECIMAL(15,2) NOT NULL,
    CONSTRAINT pk_compra_detalle PRIMARY KEY (id),
    CONSTRAINT uq_compra_detalle_producto UNIQUE (compra_id, producto_id),
    CONSTRAINT fk_compra_detalle_compra FOREIGN KEY (compra_id) REFERENCES compra (id),
    CONSTRAINT fk_compra_detalle_producto FOREIGN KEY (producto_id) REFERENCES producto (id),
    CONSTRAINT ck_compra_detalle_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_compra_detalle_costo CHECK (costo_unitario >= 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_compra_detalle_producto ON compra_detalle (producto_id);
