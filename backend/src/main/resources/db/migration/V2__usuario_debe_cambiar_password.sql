-- V2: marca para obligar el cambio de contraseña en el primer ingreso (RN-46).
ALTER TABLE usuario
    ADD COLUMN debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE AFTER ultimo_acceso;
