package com.hyskad.notificaciones.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.hyskad.notificaciones.domain.TipoNotificacion;
import com.hyskad.usuarios.domain.AccesoUsuarioModificado;

class StreamNotificacionesTest {

    /** Reloj que la prueba adelanta a mano. */
    private static final class RelojMovible extends Clock {
        private Instant ahora = Instant.parse("2026-11-12T15:00:00Z");

        void adelantar(Duration d) {
            ahora = ahora.plus(d);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zona) {
            return this;
        }

        @Override
        public Instant instant() {
            return ahora;
        }
    }

    private final RelojMovible reloj = new RelojMovible();
    private final StreamNotificaciones stream = new StreamNotificaciones(reloj);

    @Test
    void elTicketSirveUnaSolaVez() {
        String ticket = stream.emitirTicket(7L);
        assertThat(stream.canjear(ticket)).contains(7L);
        assertThat(stream.canjear(ticket)).isEmpty();
    }

    @Test
    void elTicketVenceALos30Segundos() {
        String vigente = stream.emitirTicket(7L);
        String vencido = stream.emitirTicket(8L);
        reloj.adelantar(Duration.ofSeconds(29));
        assertThat(stream.canjear(vigente)).contains(7L);
        reloj.adelantar(Duration.ofSeconds(1));
        assertThat(stream.canjear(vencido)).isEmpty();
        assertThat(stream.canjear(null)).isEmpty();
    }

    @Test
    void cadaTicketEsDistintoYLargo() {
        String a = stream.emitirTicket(1L);
        String b = stream.emitirTicket(1L);
        assertThat(a).isNotEqualTo(b).hasSizeGreaterThanOrEqualTo(43);
    }

    @Test
    void variasPestanasPorUsuarioYCambiarElAccesoLasCierra() {
        stream.abrir(5L);
        stream.abrir(5L);
        stream.abrir(6L);
        assertThat(stream.conexiones(5L)).isEqualTo(2);
        stream.enviar(5L, new AvisoTiempoReal(1L, TipoNotificacion.STOCK_BAJO, "t", "m", Map.of(), null, false,
                reloj.instant()));
        stream.alModificarAcceso(new AccesoUsuarioModificado(5L));
        assertThat(stream.conexiones(5L)).isZero();
        assertThat(stream.conexiones(6L)).isOne();
    }
}
