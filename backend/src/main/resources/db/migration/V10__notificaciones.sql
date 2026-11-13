-- V10: notificaciones internas (RF30). Guardan claves de i18n y parámetros, no texto, para que
-- cada usuario las lea en su idioma.

CREATE TABLE notificacion (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    usuario_id    BIGINT       NOT NULL,
    tipo          VARCHAR(40)  NOT NULL,
    titulo_clave  VARCHAR(120) NOT NULL,
    mensaje_clave VARCHAR(120) NOT NULL,
    parametros    JSON         NULL,
    enlace        VARCHAR(200) NULL,
    leida         BOOLEAN      NOT NULL DEFAULT FALSE,
    fecha         DATETIME(6)  NOT NULL,
    CONSTRAINT pk_notificacion PRIMARY KEY (id),
    CONSTRAINT fk_notificacion_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id)
);

CREATE INDEX ix_notificacion_usuario_leida_fecha ON notificacion (usuario_id, leida, fecha);
