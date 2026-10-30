package com.hyskad.auth.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.hyskad.auth.web.LimitadorIntentos.Regla;
import com.hyskad.shared.error.DemasiadasSolicitudesException;

class LimitadorIntentosTest {

    private final LimitadorIntentos limitador = new LimitadorIntentos();

    @Test
    void permiteHastaElLimiteYLuegoPideEsperar() {
        for (int i = 0; i < 5; i++) {
            limitador.consumir(Regla.LOGIN, "1.1.1.1|a@b.co");
        }

        assertThatThrownBy(() -> limitador.consumir(Regla.LOGIN, "1.1.1.1|a@b.co"))
                .isInstanceOfSatisfying(DemasiadasSolicitudesException.class,
                        e -> assertThat(e.getSegundosParaReintentar()).isBetween(1L, 61L));
    }

    @Test
    void cadaClaveYCadaReglaTienenSuPropioCupo() {
        for (int i = 0; i < 3; i++) {
            limitador.consumir(Regla.OLVIDE_PASSWORD, "1.1.1.1|a@b.co");
        }

        limitador.consumir(Regla.OLVIDE_PASSWORD, "1.1.1.1|otro@b.co");
        limitador.consumir(Regla.LOGIN, "1.1.1.1|a@b.co");
        assertThatThrownBy(() -> limitador.consumir(Regla.OLVIDE_PASSWORD, "1.1.1.1|a@b.co"))
                .isInstanceOf(DemasiadasSolicitudesException.class);
    }

    @Test
    void deshabilitadoNuncaLimita() {
        LimitadorIntentos sinLimite = new LimitadorIntentos(false);

        assertThatCode(() -> {
            for (int i = 0; i < 20; i++) {
                sinLimite.consumir(Regla.LOGIN, "1.1.1.1|a@b.co");
            }
        }).doesNotThrowAnyException();
    }
}
