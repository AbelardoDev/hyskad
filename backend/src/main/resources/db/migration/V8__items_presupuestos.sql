-- V8: ítems de la orden (RF15, RF19), totales (RF24) y presupuestos (RF22, RF23; RN-28 a RN-34).
-- Los precios se congelan al agregar el ítem; el costo del repuesto, al finalizar la orden.

ALTER TABLE orden_trabajo
    ADD COLUMN subtotal            DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER kilometraje_inspeccion,
    ADD COLUMN descuento           DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER subtotal,
    ADD COLUMN iva_porcentaje      DECIMAL(5,2)  NOT NULL DEFAULT 0 AFTER descuento,
    ADD COLUMN impuesto            DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER iva_porcentaje,
    ADD COLUMN total               DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER impuesto,
    ADD COLUMN fecha_finalizacion  DATETIME(6)   NULL AFTER total,
    ADD CONSTRAINT ck_orden_trabajo_descuento CHECK (descuento >= 0 AND descuento <= subtotal),
    ADD CONSTRAINT ck_orden_trabajo_montos CHECK (subtotal >= 0 AND impuesto >= 0 AND total >= 0);

-- Servicio del catálogo (precio editable) o mano de obra libre (sin servicio_id). Cantidad 1.
CREATE TABLE orden_servicio (
    id           BIGINT        NOT NULL AUTO_INCREMENT,
    orden_id     BIGINT        NOT NULL,
    servicio_id  BIGINT        NULL,
    descripcion  VARCHAR(200)  NOT NULL,
    precio       DECIMAL(15,2) NOT NULL,
    tiempo_min   INT           NULL,
    mecanico_id  BIGINT        NULL,
    agregado_por BIGINT        NULL,
    agregado_en  DATETIME(6)   NOT NULL,
    CONSTRAINT pk_orden_servicio PRIMARY KEY (id),
    CONSTRAINT fk_orden_servicio_orden FOREIGN KEY (orden_id) REFERENCES orden_trabajo (id),
    CONSTRAINT fk_orden_servicio_servicio FOREIGN KEY (servicio_id) REFERENCES servicio (id),
    CONSTRAINT fk_orden_servicio_mecanico FOREIGN KEY (mecanico_id) REFERENCES usuario (id),
    CONSTRAINT fk_orden_servicio_agregado_por FOREIGN KEY (agregado_por) REFERENCES usuario (id),
    CONSTRAINT ck_orden_servicio_precio CHECK (precio > 0),
    CONSTRAINT ck_orden_servicio_tiempo CHECK (tiempo_min IS NULL OR tiempo_min > 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_orden_servicio_orden ON orden_servicio (orden_id);

-- Repuesto reservado (RN-29). Un producto aparece una sola vez por orden: agregarlo otra vez suma.
CREATE TABLE orden_repuesto (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    orden_id         BIGINT        NOT NULL,
    producto_id      BIGINT        NOT NULL,
    cantidad         DECIMAL(12,2) NOT NULL,
    precio_unitario  DECIMAL(15,2) NOT NULL,
    costo_unitario   DECIMAL(15,2) NULL,
    agregado_por     BIGINT        NULL,
    agregado_en      DATETIME(6)   NOT NULL,
    CONSTRAINT pk_orden_repuesto PRIMARY KEY (id),
    CONSTRAINT uq_orden_repuesto_producto UNIQUE (orden_id, producto_id),
    CONSTRAINT fk_orden_repuesto_orden FOREIGN KEY (orden_id) REFERENCES orden_trabajo (id),
    CONSTRAINT fk_orden_repuesto_producto FOREIGN KEY (producto_id) REFERENCES producto (id),
    CONSTRAINT fk_orden_repuesto_agregado_por FOREIGN KEY (agregado_por) REFERENCES usuario (id),
    CONSTRAINT ck_orden_repuesto_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_orden_repuesto_valores CHECK (precio_unitario >= 0 AND (costo_unitario IS NULL OR costo_unitario >= 0))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_orden_repuesto_producto ON orden_repuesto (producto_id);

-- RN-31: copia congelada de ítems y totales; versión 1, 2, 3… dentro de la orden.
CREATE TABLE presupuesto (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    orden_id        BIGINT        NOT NULL,
    numero          VARCHAR(20)   NOT NULL,
    version         INT           NOT NULL,
    subtotal        DECIMAL(15,2) NOT NULL,
    descuento       DECIMAL(15,2) NOT NULL,
    iva_porcentaje  DECIMAL(5,2)  NOT NULL,
    impuesto        DECIMAL(15,2) NOT NULL,
    total           DECIMAL(15,2) NOT NULL,
    estado          VARCHAR(12)   NOT NULL,
    observaciones   VARCHAR(1000) NULL,
    fecha_envio     DATETIME(6)   NOT NULL,
    enviado_por     BIGINT        NULL,
    fecha_decision  DATETIME(6)   NULL,
    decidido_por    BIGINT        NULL,
    observaciones_decision VARCHAR(1000) NULL,
    CONSTRAINT pk_presupuesto PRIMARY KEY (id),
    CONSTRAINT uq_presupuesto_numero UNIQUE (numero),
    CONSTRAINT uq_presupuesto_version UNIQUE (orden_id, version),
    CONSTRAINT fk_presupuesto_orden FOREIGN KEY (orden_id) REFERENCES orden_trabajo (id),
    CONSTRAINT fk_presupuesto_enviado_por FOREIGN KEY (enviado_por) REFERENCES usuario (id),
    CONSTRAINT fk_presupuesto_decidido_por FOREIGN KEY (decidido_por) REFERENCES usuario (id),
    CONSTRAINT ck_presupuesto_estado CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMPLAZADO')),
    CONSTRAINT ck_presupuesto_descuento CHECK (descuento >= 0 AND descuento <= subtotal),
    CONSTRAINT ck_presupuesto_montos CHECK (subtotal >= 0 AND impuesto >= 0 AND total >= 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_presupuesto_orden ON presupuesto (orden_id, estado);

CREATE TABLE presupuesto_item (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    presupuesto_id   BIGINT        NOT NULL,
    tipo             VARCHAR(10)   NOT NULL,
    descripcion      VARCHAR(200)  NOT NULL,
    cantidad         DECIMAL(12,2) NOT NULL,
    precio_unitario  DECIMAL(15,2) NOT NULL,
    subtotal         DECIMAL(15,2) NOT NULL,
    CONSTRAINT pk_presupuesto_item PRIMARY KEY (id),
    CONSTRAINT fk_presupuesto_item_presupuesto FOREIGN KEY (presupuesto_id) REFERENCES presupuesto (id),
    CONSTRAINT ck_presupuesto_item_tipo CHECK (tipo IN ('SERVICIO', 'REPUESTO')),
    CONSTRAINT ck_presupuesto_item_cantidad CHECK (cantidad > 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
