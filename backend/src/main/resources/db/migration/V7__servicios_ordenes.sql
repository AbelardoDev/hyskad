-- V7: catálogo de servicios del taller (RF16) y núcleo de las órdenes de trabajo (RF10–RF14,
-- RN-22 a RN-27). Los ítems, presupuestos, pago y entrega llegan en F09B/F09C con sus columnas.

CREATE TABLE servicio (
    id                   BIGINT        NOT NULL AUTO_INCREMENT,
    nombre               VARCHAR(120)  NOT NULL,
    descripcion          VARCHAR(500)  NULL,
    precio_base          DECIMAL(15,2) NOT NULL,
    tiempo_estimado_min  INT           NOT NULL,
    activo               BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at           DATETIME(6)   NOT NULL,
    updated_at           DATETIME(6)   NOT NULL,
    created_by           BIGINT        NULL,
    updated_by           BIGINT        NULL,
    CONSTRAINT pk_servicio PRIMARY KEY (id),
    CONSTRAINT uq_servicio_nombre UNIQUE (nombre),
    CONSTRAINT ck_servicio_precio CHECK (precio_base > 0),
    CONSTRAINT ck_servicio_tiempo CHECK (tiempo_estimado_min > 0),
    CONSTRAINT fk_servicio_created_by FOREIGN KEY (created_by) REFERENCES usuario (id),
    CONSTRAINT fk_servicio_updated_by FOREIGN KEY (updated_by) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE orden_trabajo (
    id                         BIGINT        NOT NULL AUTO_INCREMENT,
    numero                     VARCHAR(20)   NOT NULL,
    cliente_id                 BIGINT        NOT NULL,
    motocicleta_id             BIGINT        NOT NULL,
    fecha_ingreso              DATETIME(6)   NOT NULL,
    kilometraje_ingreso        INT           NOT NULL,
    motivo_ingreso             VARCHAR(200)  NOT NULL,
    descripcion_problema       VARCHAR(2000) NOT NULL,
    observaciones              VARCHAR(2000) NULL,
    estado                     VARCHAR(25)   NOT NULL,
    diagnostico                VARCHAR(4000) NULL,
    observaciones_diagnostico  VARCHAR(2000) NULL,
    kilometraje_inspeccion     INT           NULL,
    version                    BIGINT        NOT NULL DEFAULT 0,
    -- RN-24: la moto solo aparece aquí mientras la orden está activa; el índice único impide dos
    -- órdenes activas de la misma moto aunque se creen a la vez.
    motocicleta_activa_id      BIGINT        GENERATED ALWAYS AS (
        CASE WHEN estado IN ('ENTREGADA', 'CANCELADA') THEN NULL ELSE motocicleta_id END) STORED,
    created_at                 DATETIME(6)   NOT NULL,
    updated_at                 DATETIME(6)   NOT NULL,
    created_by                 BIGINT        NULL,
    updated_by                 BIGINT        NULL,
    CONSTRAINT pk_orden_trabajo PRIMARY KEY (id),
    CONSTRAINT uq_orden_trabajo_numero UNIQUE (numero),
    CONSTRAINT uq_orden_trabajo_moto_activa UNIQUE (motocicleta_activa_id),
    CONSTRAINT fk_orden_trabajo_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id),
    CONSTRAINT fk_orden_trabajo_motocicleta FOREIGN KEY (motocicleta_id) REFERENCES motocicleta (id),
    CONSTRAINT ck_orden_trabajo_estado CHECK (estado IN ('RECIBIDA', 'EN_DIAGNOSTICO', 'PENDIENTE_APROBACION',
        'EN_REPARACION', 'FINALIZADA', 'ENTREGADA', 'CANCELADA')),
    CONSTRAINT ck_orden_trabajo_km CHECK (kilometraje_ingreso >= 0),
    CONSTRAINT ck_orden_trabajo_km_inspeccion CHECK (
        kilometraje_inspeccion IS NULL OR kilometraje_inspeccion >= kilometraje_ingreso),
    CONSTRAINT fk_orden_trabajo_created_by FOREIGN KEY (created_by) REFERENCES usuario (id),
    CONSTRAINT fk_orden_trabajo_updated_by FOREIGN KEY (updated_by) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_orden_trabajo_estado ON orden_trabajo (estado);
CREATE INDEX ix_orden_trabajo_fecha_ingreso ON orden_trabajo (fecha_ingreso);
CREATE INDEX ix_orden_trabajo_cliente ON orden_trabajo (cliente_id);
CREATE INDEX ix_orden_trabajo_motocicleta ON orden_trabajo (motocicleta_id, fecha_ingreso);

CREATE TABLE orden_mecanico (
    orden_id     BIGINT       NOT NULL,
    mecanico_id  BIGINT       NOT NULL,
    actividad    VARCHAR(200) NULL,
    asignado_en  DATETIME(6)  NOT NULL,
    CONSTRAINT pk_orden_mecanico PRIMARY KEY (orden_id, mecanico_id),
    CONSTRAINT fk_orden_mecanico_orden FOREIGN KEY (orden_id) REFERENCES orden_trabajo (id),
    CONSTRAINT fk_orden_mecanico_mecanico FOREIGN KEY (mecanico_id) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- "Mis órdenes" y el filtro por mecánico buscan por mecánico
CREATE INDEX ix_orden_mecanico_mecanico ON orden_mecanico (mecanico_id);

-- RN-23: una fila por transición (y la de creación, con estado_anterior NULL)
CREATE TABLE orden_estado_historial (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    orden_id         BIGINT       NOT NULL,
    estado_anterior  VARCHAR(25)  NULL,
    estado_nuevo     VARCHAR(25)  NOT NULL,
    nota             VARCHAR(500) NULL,
    usuario_id       BIGINT       NULL,
    fecha            DATETIME(6)  NOT NULL,
    CONSTRAINT pk_orden_estado_historial PRIMARY KEY (id),
    CONSTRAINT fk_orden_estado_historial_orden FOREIGN KEY (orden_id) REFERENCES orden_trabajo (id),
    CONSTRAINT fk_orden_estado_historial_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_orden_estado_historial_orden ON orden_estado_historial (orden_id, fecha);
