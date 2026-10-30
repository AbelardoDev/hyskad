-- V1: tablas de sistema (usuarios, tokens, auditoría, configuración y consecutivos).
-- Fechas en UTC (RN-53). Charset utf8mb4 / collation utf8mb4_0900_ai_ci.

CREATE TABLE usuario (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    nombre         VARCHAR(120) NOT NULL,
    email          VARCHAR(254) NOT NULL,
    telefono       VARCHAR(20)  NULL,
    password_hash  VARCHAR(100) NOT NULL,
    rol            VARCHAR(20)  NOT NULL,
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    idioma         VARCHAR(5)   NOT NULL DEFAULT 'es',
    ultimo_acceso  DATETIME(6)  NULL,
    created_at     DATETIME(6)  NOT NULL,
    updated_at     DATETIME(6)  NOT NULL,
    created_by     BIGINT       NULL,
    updated_by     BIGINT       NULL,
    CONSTRAINT pk_usuario PRIMARY KEY (id),
    CONSTRAINT uq_usuario_email UNIQUE (email),
    CONSTRAINT ck_usuario_rol CHECK (rol IN ('ADMIN', 'ALMACEN', 'VENDEDOR', 'MECANICO')),
    CONSTRAINT ck_usuario_idioma CHECK (idioma IN ('es', 'en')),
    CONSTRAINT fk_usuario_created_by FOREIGN KEY (created_by) REFERENCES usuario (id),
    CONSTRAINT fk_usuario_updated_by FOREIGN KEY (updated_by) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE usuario_permiso (
    usuario_id  BIGINT      NOT NULL,
    permiso     VARCHAR(60) NOT NULL,
    concedido   BOOLEAN     NOT NULL,
    created_at  DATETIME(6) NOT NULL,
    CONSTRAINT pk_usuario_permiso PRIMARY KEY (usuario_id, permiso),
    CONSTRAINT fk_usuario_permiso_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE refresh_token (
    id               BIGINT      NOT NULL AUTO_INCREMENT,
    usuario_id       BIGINT      NOT NULL,
    token_hash       CHAR(64)    NOT NULL,
    expira_en        DATETIME(6) NOT NULL,
    revocado_en      DATETIME(6) NULL,
    reemplazado_por  BIGINT      NULL,
    created_at       DATETIME(6) NOT NULL,
    CONSTRAINT pk_refresh_token PRIMARY KEY (id),
    CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_token_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id),
    CONSTRAINT fk_refresh_token_reemplazo FOREIGN KEY (reemplazado_por) REFERENCES refresh_token (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_refresh_token_usuario ON refresh_token (usuario_id);

CREATE TABLE token_recuperacion (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    usuario_id  BIGINT      NOT NULL,
    token_hash  CHAR(64)    NOT NULL,
    expira_en   DATETIME(6) NOT NULL,
    usado_en    DATETIME(6) NULL,
    created_at  DATETIME(6) NOT NULL,
    CONSTRAINT pk_token_recuperacion PRIMARY KEY (id),
    CONSTRAINT uq_token_recuperacion_hash UNIQUE (token_hash),
    CONSTRAINT fk_token_recuperacion_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_token_recuperacion_usuario ON token_recuperacion (usuario_id);

CREATE TABLE auditoria (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    usuario_id  BIGINT      NULL,
    accion      VARCHAR(60) NOT NULL,
    entidad     VARCHAR(60) NOT NULL,
    entidad_id  BIGINT      NULL,
    detalle     JSON        NULL,
    ip          VARCHAR(45) NULL,
    fecha       DATETIME(6) NOT NULL,
    CONSTRAINT pk_auditoria PRIMARY KEY (id),
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX ix_auditoria_entidad ON auditoria (entidad, entidad_id);
CREATE INDEX ix_auditoria_fecha ON auditoria (fecha);
CREATE INDEX ix_auditoria_usuario ON auditoria (usuario_id);

CREATE TABLE configuracion (
    id           BIGINT        NOT NULL AUTO_INCREMENT,
    clave        VARCHAR(100)  NOT NULL,
    valor        VARCHAR(1000) NOT NULL,
    descripcion  VARCHAR(255)  NULL,
    created_at   DATETIME(6)   NOT NULL,
    updated_at   DATETIME(6)   NOT NULL,
    created_by   BIGINT        NULL,
    updated_by   BIGINT        NULL,
    CONSTRAINT pk_configuracion PRIMARY KEY (id),
    CONSTRAINT uq_configuracion_clave UNIQUE (clave),
    CONSTRAINT fk_configuracion_created_by FOREIGN KEY (created_by) REFERENCES usuario (id),
    CONSTRAINT fk_configuracion_updated_by FOREIGN KEY (updated_by) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE consecutivo (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    tipo        VARCHAR(20) NOT NULL,
    siguiente   BIGINT      NOT NULL DEFAULT 1,
    created_at  DATETIME(6) NOT NULL,
    updated_at  DATETIME(6) NOT NULL,
    created_by  BIGINT      NULL,
    updated_by  BIGINT      NULL,
    CONSTRAINT pk_consecutivo PRIMARY KEY (id),
    CONSTRAINT uq_consecutivo_tipo UNIQUE (tipo),
    CONSTRAINT ck_consecutivo_siguiente CHECK (siguiente >= 1),
    CONSTRAINT fk_consecutivo_created_by FOREIGN KEY (created_by) REFERENCES usuario (id),
    CONSTRAINT fk_consecutivo_updated_by FOREIGN KEY (updated_by) REFERENCES usuario (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Valores iniciales (RN-03). Los datos del taller son de ejemplo: el administrador los cambia en F11.
INSERT INTO configuracion (clave, valor, descripcion, created_at, updated_at) VALUES
    ('iva.porcentaje', '19', 'Porcentaje de IVA aplicado a ventas y órdenes', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('taller.nombre', 'Taller HYSKAD', 'Nombre comercial del taller', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('taller.nit', '900123456-8', 'NIT del taller con dígito de verificación', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('taller.direccion', 'Calle 41 # 10-25, Montería, Córdoba', 'Dirección del taller', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('taller.telefono', '6047891234', 'Teléfono de contacto del taller', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('stock.alerta.habilitada', 'true', 'Enviar alertas cuando un producto llega al stock mínimo', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));

INSERT INTO consecutivo (tipo, siguiente, created_at, updated_at) VALUES
    ('OT', 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('VENTA', 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('COMPRA', 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    ('PRESUPUESTO', 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));
