package com.hyskad.auth.application;

/** Se generó un enlace de recuperación; el correo se envía al confirmar la transacción. */
public record RecuperacionSolicitada(String email, String nombre, String idioma, String token, long minutosVigencia) {

    /** Sin email ni token: este evento nunca debe terminar completo en un log. */
    @Override
    public String toString() {
        return "RecuperacionSolicitada[idioma=" + idioma + "]";
    }
}
