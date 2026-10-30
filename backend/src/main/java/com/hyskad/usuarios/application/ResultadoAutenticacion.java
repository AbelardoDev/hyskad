package com.hyskad.usuarios.application;

/** Resultado de verificar credenciales. El motivo del fallo es solo para auditoría, nunca para el cliente. */
public sealed interface ResultadoAutenticacion {

    record Exitosa(UsuarioSesion sesion) implements ResultadoAutenticacion {
    }

    /** {@code usuarioId} es nulo si el email no corresponde a ningún usuario. */
    record Fallida(Long usuarioId, MotivoFallo motivo) implements ResultadoAutenticacion {
    }

    enum MotivoFallo {
        USUARIO_DESCONOCIDO,
        PASSWORD_INCORRECTA,
        USUARIO_INACTIVO
    }
}
