package com.hyskad.shared.error;

/** Se superó un límite de intentos (rate limiting). Se responde 429 con {@code Retry-After}. */
public class DemasiadasSolicitudesException extends BusinessException {

    private final long segundosParaReintentar;

    public DemasiadasSolicitudesException(long segundosParaReintentar) {
        super(ErrorCode.DEMASIADAS_SOLICITUDES, "Demasiados intentos. Espere antes de volver a intentar");
        this.segundosParaReintentar = Math.max(1, segundosParaReintentar);
    }

    public long getSegundosParaReintentar() {
        return segundosParaReintentar;
    }
}
