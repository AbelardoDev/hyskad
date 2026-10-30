package com.hyskad.clientes.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.hyskad.shared.validation.TipoDocumento;

/** RN-39 (nombre según el documento) y RN-45 (autorización de datos y fecha). */
class ClienteTest {

    private static final Instant AYER = Instant.parse("2026-10-29T12:00:00Z");
    private static final Instant HOY = Instant.parse("2026-10-30T12:00:00Z");

    @Test
    void conNitSoloGuardaRazonSocial() {
        Cliente cliente = new Cliente(datos(TipoDocumento.NIT, true, "x@correo.test"), HOY);

        assertThat(cliente.getRazonSocial()).isEqualTo("Motos S.A.S.");
        assertThat(cliente.getNombres()).isNull();
        assertThat(cliente.getApellidos()).isNull();
        assertThat(cliente.getNombreCompleto()).isEqualTo("Motos S.A.S.");
        assertThat(cliente.isActivo()).isTrue();
    }

    @Test
    void conCedulaSoloGuardaNombresYApellidos() {
        Cliente cliente = new Cliente(datos(TipoDocumento.CC, true, null), HOY);

        assertThat(cliente.getRazonSocial()).isNull();
        assertThat(cliente.getNombreCompleto()).isEqualTo("Ana Pérez");
    }

    @Test
    void laFechaDeAutorizacionSeConservaHastaQueSeRetira() {
        Cliente cliente = new Cliente(datos(TipoDocumento.CC, true, null), AYER);
        assertThat(cliente.getFechaAceptacionDatos()).isEqualTo(AYER);

        cliente.actualizar(datos(TipoDocumento.CC, true, null), HOY);
        assertThat(cliente.getFechaAceptacionDatos()).isEqualTo(AYER);

        cliente.actualizar(datos(TipoDocumento.CC, false, null), HOY);
        assertThat(cliente.isAceptaTratamientoDatos()).isFalse();
        assertThat(cliente.getFechaAceptacionDatos()).isNull();

        cliente.actualizar(datos(TipoDocumento.CC, true, null), HOY);
        assertThat(cliente.getFechaAceptacionDatos()).isEqualTo(HOY);
    }

    @Test
    void sinAutorizacionOSinEmailNoRecibeCorreos() {
        assertThat(new Cliente(datos(TipoDocumento.CC, true, "a@correo.test"), HOY).puedeRecibirCorreos()).isTrue();
        assertThat(new Cliente(datos(TipoDocumento.CC, false, "a@correo.test"), HOY).puedeRecibirCorreos()).isFalse();
        assertThat(new Cliente(datos(TipoDocumento.CC, true, null), HOY).puedeRecibirCorreos()).isFalse();
    }

    @Test
    void cambiaDeEstado() {
        Cliente cliente = new Cliente(datos(TipoDocumento.CC, true, null), HOY);
        cliente.cambiarEstado(false);
        assertThat(cliente.isActivo()).isFalse();
    }

    private static DatosCliente datos(TipoDocumento tipo, boolean autoriza, String email) {
        return new DatosCliente(tipo, "123456789", "Ana", "Pérez", "Motos S.A.S.", "3001234567", email, null, null,
                autoriza);
    }
}
