package com.hyskad.taller.domain;

import static com.hyskad.taller.domain.EstadoOrden.CANCELADA;
import static com.hyskad.taller.domain.EstadoOrden.EN_DIAGNOSTICO;
import static com.hyskad.taller.domain.EstadoOrden.EN_REPARACION;
import static com.hyskad.taller.domain.EstadoOrden.ENTREGADA;
import static com.hyskad.taller.domain.EstadoOrden.FINALIZADA;
import static com.hyskad.taller.domain.EstadoOrden.PENDIENTE_APROBACION;
import static com.hyskad.taller.domain.EstadoOrden.RECIBIDA;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.usuarios.domain.Permiso;

/** CP-38 (RF13, RN-22, RN-23): todas las combinaciones origen/destino del diagrama de estados. */
class EstadoOrdenTest {

    private static final Instant AHORA = Instant.parse("2026-10-30T15:00:00Z");
    private static final Long USUARIO = 7L;

    /** El diagrama de BUSINESS-RULES §6.1, escrito aparte del enum para no probarlo contra sí mismo. */
    private static final Map<EstadoOrden, Set<EstadoOrden>> DIAGRAMA = Map.of(
            RECIBIDA, Set.of(EN_DIAGNOSTICO, CANCELADA),
            EN_DIAGNOSTICO, Set.of(PENDIENTE_APROBACION, CANCELADA),
            PENDIENTE_APROBACION, Set.of(EN_REPARACION, EN_DIAGNOSTICO, CANCELADA),
            EN_REPARACION, Set.of(EN_DIAGNOSTICO, FINALIZADA, CANCELADA),
            FINALIZADA, Set.of(ENTREGADA),
            ENTREGADA, Set.of(),
            CANCELADA, Set.of());

    static Stream<Arguments> combinaciones() {
        return Stream.of(EstadoOrden.values()).flatMap(desde -> Stream.of(EstadoOrden.values())
                .map(hasta -> Arguments.of(desde, hasta, DIAGRAMA.get(desde).contains(hasta))));
    }

    @ParameterizedTest(name = "{0} → {1}: {2}")
    @MethodSource("combinaciones")
    void cp38TransicionesDelDiagrama(EstadoOrden desde, EstadoOrden hasta, boolean valida) {
        OrdenTrabajo orden = ordenEn(desde);
        assertThat(desde.puedeTransicionarA(hasta)).isEqualTo(valida);

        if (valida) {
            orden.transicionarA(hasta, USUARIO, "nota", AHORA);
            assertThat(orden.getEstado()).isEqualTo(hasta);
            OrdenEstadoHistorial ultimo = orden.getHistorial().getLast();
            assertThat(ultimo.getEstadoAnterior()).isEqualTo(desde);
            assertThat(ultimo.getEstadoNuevo()).isEqualTo(hasta);
            assertThat(ultimo.getUsuarioId()).isEqualTo(USUARIO);
            assertThat(ultimo.getNota()).isEqualTo("nota");
        } else {
            int antes = orden.getHistorial().size();
            assertThatThrownBy(() -> orden.transicionarA(hasta, USUARIO, null, AHORA))
                    .isInstanceOfSatisfying(ConflictException.class, e -> {
                        assertThat(e.getCode()).isEqualTo(ErrorCode.TRANSICION_INVALIDA);
                        assertThat(e.getParametros()).containsEntry("desde", desde.name())
                                .containsEntry("hasta", hasta.name());
                    });
            assertThat(orden.getEstado()).isEqualTo(desde);
            assertThat(orden.getHistorial()).hasSize(antes);
        }
    }

    @Test
    void entregadaYCanceladaSonFinalesYElRestoActivos() {
        assertThat(EstadoOrden.finales()).containsExactlyInAnyOrder(ENTREGADA, CANCELADA);
        assertThat(EstadoOrden.activos()).containsExactlyInAnyOrder(RECIBIDA, EN_DIAGNOSTICO, PENDIENTE_APROBACION,
                EN_REPARACION, FINALIZADA);
        assertThat(Stream.of(EstadoOrden.values()).filter(EstadoOrden::esFinal))
                .containsExactlyInAnyOrder(ENTREGADA, CANCELADA);
    }

    @Test
    void cadaTransicionTieneElPermisoDeLaTablaYLaNotaCuandoLaExige() {
        assertThat(regla(RECIBIDA, EN_DIAGNOSTICO)).isEqualTo(new EstadoOrden.Regla(Permiso.ORDENES_TRABAJAR, false));
        assertThat(regla(EN_DIAGNOSTICO, PENDIENTE_APROBACION))
                .isEqualTo(new EstadoOrden.Regla(Permiso.PRESUPUESTOS_GESTIONAR, false));
        assertThat(regla(PENDIENTE_APROBACION, EN_REPARACION).esAutomatica()).isTrue();
        assertThat(regla(PENDIENTE_APROBACION, EN_DIAGNOSTICO))
                .isEqualTo(new EstadoOrden.Regla(Permiso.PRESUPUESTOS_GESTIONAR, false));
        assertThat(regla(EN_REPARACION, EN_DIAGNOSTICO)).isEqualTo(new EstadoOrden.Regla(Permiso.ORDENES_TRABAJAR, true));
        assertThat(regla(EN_REPARACION, FINALIZADA)).isEqualTo(new EstadoOrden.Regla(Permiso.ORDENES_TRABAJAR, false));
        assertThat(regla(FINALIZADA, ENTREGADA)).isEqualTo(new EstadoOrden.Regla(Permiso.ENTREGAS_REGISTRAR, false));
        for (EstadoOrden activa : List.of(RECIBIDA, EN_DIAGNOSTICO, PENDIENTE_APROBACION, EN_REPARACION)) {
            assertThat(regla(activa, CANCELADA)).isEqualTo(new EstadoOrden.Regla(Permiso.ORDENES_CREAR, true));
        }
    }

    @Test
    void laCreacionQuedaEnElHistorialSinEstadoAnterior() {
        OrdenTrabajo orden = nueva();
        assertThat(orden.getEstado()).isEqualTo(RECIBIDA);
        assertThat(orden.getHistorial()).singleElement().satisfies(h -> {
            assertThat(h.getEstadoAnterior()).isNull();
            assertThat(h.getEstadoNuevo()).isEqualTo(RECIBIDA);
            assertThat(h.getUsuarioId()).isEqualTo(USUARIO);
        });
    }

    @Test
    void unaOrdenCerradaNoSeEditaNiCambiaDeMecanicos() {
        OrdenTrabajo orden = ordenEn(CANCELADA);
        assertThatThrownBy(() -> orden.actualizarRecepcion(new DatosRecepcion("Otro", "Otro", null)))
                .isInstanceOfSatisfying(ConflictException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.ORDEN_ESTADO_INVALIDO));
        assertThatThrownBy(() -> orden.asignarMecanicos(List.of(new Asignacion(1L, null)), AHORA))
                .isInstanceOfSatisfying(ConflictException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.ORDEN_ESTADO_INVALIDO));
    }

    @Test
    void elDiagnosticoSoloSeRegistraEnDiagnosticoOEnReparacion() {
        DatosDiagnostico datos = new DatosDiagnostico("Pastillas gastadas", null, 12000);
        for (EstadoOrden estado : EstadoOrden.values()) {
            OrdenTrabajo orden = ordenEn(estado);
            if (estado == EN_DIAGNOSTICO || estado == EN_REPARACION) {
                orden.registrarDiagnostico(datos);
                assertThat(orden.tieneDiagnostico()).isTrue();
            } else {
                assertThatThrownBy(() -> orden.registrarDiagnostico(datos))
                        .isInstanceOfSatisfying(ConflictException.class,
                                e -> assertThat(e.getCode()).isEqualTo(ErrorCode.ORDEN_ESTADO_INVALIDO));
            }
        }
    }

    @Test
    void reasignarConservaLaFechaDeLosQueSiguenEInformaLosCambios() {
        OrdenTrabajo orden = nueva();
        orden.asignarMecanicos(List.of(new Asignacion(1L, "Frenos"), new Asignacion(2L, null)), AHORA);
        Instant despues = AHORA.plusSeconds(3600);

        var cambio = orden.asignarMecanicos(List.of(new Asignacion(2L, "Motor"), new Asignacion(3L, null)), despues);

        assertThat(cambio.agregados()).containsExactly(3L);
        assertThat(cambio.quitados()).containsExactly(1L);
        assertThat(orden.estaAsignado(1L)).isFalse();
        assertThat(orden.getMecanicos()).extracting(OrdenMecanico::getMecanicoId).containsExactly(2L, 3L);
        OrdenMecanico segundo = orden.getMecanicos().getFirst();
        assertThat(segundo.getAsignadoEn()).isEqualTo(AHORA);
        assertThat(segundo.getActividad()).isEqualTo("Motor");
    }

    private static EstadoOrden.Regla regla(EstadoOrden desde, EstadoOrden hasta) {
        return desde.regla(hasta).orElseThrow();
    }

    private static OrdenTrabajo nueva() {
        return new OrdenTrabajo("OT-000001", null, null, 10000, new DatosRecepcion("Revisión", "Ruido al frenar", null),
                USUARIO, AHORA);
    }

    /** Lleva una orden nueva hasta {@code estado} por el camino más corto del diagrama. */
    private static OrdenTrabajo ordenEn(EstadoOrden estado) {
        OrdenTrabajo orden = nueva();
        for (EstadoOrden paso : camino(estado)) {
            orden.transicionarA(paso, USUARIO, null, AHORA);
        }
        return orden;
    }

    private static List<EstadoOrden> camino(EstadoOrden destino) {
        Map<EstadoOrden, EstadoOrden> previo = new EnumMap<>(EstadoOrden.class);
        Deque<EstadoOrden> pendientes = new ArrayDeque<>(List.of(RECIBIDA));
        previo.put(RECIBIDA, RECIBIDA);
        while (!pendientes.isEmpty()) {
            EstadoOrden actual = pendientes.poll();
            for (EstadoOrden siguiente : DIAGRAMA.get(actual)) {
                if (previo.putIfAbsent(siguiente, actual) == null) {
                    pendientes.add(siguiente);
                }
            }
        }
        List<EstadoOrden> pasos = new ArrayList<>();
        for (EstadoOrden e = destino; e != RECIBIDA; e = previo.get(e)) {
            pasos.addFirst(e);
        }
        return pasos;
    }
}
