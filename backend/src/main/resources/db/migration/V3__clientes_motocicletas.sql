-- V3: clientes y motocicletas (RF5–RF9, RN-38 a RN-45).
-- Documento y placa se guardan normalizados (el NIT como 900123456-7). Bajas lógicas con `activo`.

CREATE TABLE cliente (
    id                        BIGINT       NOT NULL AUTO_INCREMENT,
    tipo_documento            VARCHAR(5)   NOT NULL,
    numero_documento          VARCHAR(20)  NOT NULL,
    nombres                   VARCHAR(80)  NULL,
    apellidos                 VARCHAR(80)  NULL,
    razon_social              VARCHAR(150) NULL,
    telefono                  VARCHAR(10)  NOT NULL,
    email                     VARCHAR(254) NULL,
    direccion                 VARCHAR(200) NULL,
    ciudad                    VARCHAR(80)  NULL,
    acepta_tratamiento_datos  BOOLEAN      NOT NULL,
    fecha_aceptacion_datos    DATETIME(6)  NULL,
    activo                    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at                DATETIME(6)  NOT NULL,
    updated_at                DATETIME(6)  NOT NULL,
    created_by                BIGINT       NULL,
    updated_by                BIGINT       NULL,
    CONSTRAINT pk_cliente PRIMARY KEY (id),
    CONSTRAINT uq_cliente_documento UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT ck_cliente_tipo_documento CHECK (tipo_documento IN ('CC', 'TI', 'CE', 'PA', 'PPT', 'NIT')),
    -- RN-39: con NIT se pide razón social; con los demás, nombres y apellidos
    CONSTRAINT ck_cliente_nombre CHECK (
        (tipo_documento = 'NIT' AND razon_social IS NOT NULL)
        OR (tipo_documento <> 'NIT' AND nombres IS NOT NULL AND apellidos IS NOT NULL)),
    CONSTRAINT fk_cliente_created_by FOREIGN KEY (created_by) REFERENCES usuario (id),
    CONSTRAINT fk_cliente_updated_by FOREIGN KEY (updated_by) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_cliente_nombre ON cliente (nombres, apellidos);
CREATE INDEX ix_cliente_razon_social ON cliente (razon_social);
CREATE INDEX ix_cliente_telefono ON cliente (telefono);

CREATE TABLE motocicleta (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    cliente_id     BIGINT      NOT NULL,
    placa          VARCHAR(6)  NOT NULL,
    marca          VARCHAR(60) NOT NULL,
    modelo         VARCHAR(60) NOT NULL,
    anio           SMALLINT    NULL,
    vin            CHAR(17)    NULL,
    cilindrada_cc  INT         NULL,
    color          VARCHAR(40) NULL,
    activo         BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at     DATETIME(6) NOT NULL,
    updated_at     DATETIME(6) NOT NULL,
    created_by     BIGINT      NULL,
    updated_by     BIGINT      NULL,
    CONSTRAINT pk_motocicleta PRIMARY KEY (id),
    CONSTRAINT uq_motocicleta_placa UNIQUE (placa),
    -- Único pero opcional: MySQL admite varios NULL en un índice único (RN-42)
    CONSTRAINT uq_motocicleta_vin UNIQUE (vin),
    CONSTRAINT fk_motocicleta_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id),
    CONSTRAINT fk_motocicleta_created_by FOREIGN KEY (created_by) REFERENCES usuario (id),
    CONSTRAINT fk_motocicleta_updated_by FOREIGN KEY (updated_by) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_motocicleta_cliente ON motocicleta (cliente_id);
CREATE INDEX ix_motocicleta_marca_modelo ON motocicleta (marca, modelo);
