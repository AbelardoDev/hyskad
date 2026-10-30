package com.hyskad.taller.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.ZoneId;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.hyskad.support.Identificadores;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.taller.domain.EstadoOrden;
import com.hyskad.taller.domain.EstadoOrdenCambiado;
import com.hyskad.taller.domain.MecanicoAsignado;
import com.hyskad.taller.domain.OrdenCreada;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Órdenes de trabajo de punta a punta con MySQL real (RF10–RF14, RN-22 a RN-27). */
@IntegrationTest
@RecordApplicationEvents
class OrdenTrabajoControllerIT {

    private static final String BASE = "/api/v1/ordenes-trabajo";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private ApplicationEvents eventos;

    private String admin;
    private String vendedor;
    private UsuariosDePrueba.Creado mecanico;
    private String mecanicoBearer;

    @BeforeEach
    void iniciar() {
        admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        vendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
        mecanico = usuarios.crear(Rol.MECANICO);
        mecanicoBearer = usuarios.bearer(mecanico.id());
    }

    @Test
    void recibeUnaMotoNumeradaConHistorialAuditoriaYEventos() throws Exception {
        Moto moto = moto();
        String respuesta = mvc.perform(con(post(BASE), vendedor).content("""
                {"clienteId":%d,"motocicletaId":%d,"kilometrajeIngreso":15200,"motivoIngreso":"  Mantenimiento  ",
                 "descripcionProblema":"Ruido en la cadena","observaciones":" ",
                 "mecanicos":[{"mecanicoId":%d,"actividad":" Kit de arrastre "}]}"""
                .formatted(moto.clienteId(), moto.id(), mecanico.id())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.numero").value(matchesPattern("OT-\\d{6}")))
                .andExpect(jsonPath("$.estado").value("RECIBIDA"))
                .andExpect(jsonPath("$.motivoIngreso").value("Mantenimiento"))
                .andExpect(jsonPath("$.observaciones").doesNotExist())
                .andExpect(jsonPath("$.kilometrajeIngreso").value(15200))
                .andExpect(jsonPath("$.cliente.id").value(moto.clienteId()))
                .andExpect(jsonPath("$.motocicleta.placa").value(moto.placa()))
                .andExpect(jsonPath("$.mecanicos[0].id").value(mecanico.id()))
                .andExpect(jsonPath("$.mecanicos[0].nombre").value("Prueba MECANICO"))
                .andExpect(jsonPath("$.mecanicos[0].actividad").value("Kit de arrastre"))
                .andExpect(jsonPath("$.historial.length()").value(1))
                .andExpect(jsonPath("$.historial[0].estadoAnterior").doesNotExist())
                .andExpect(jsonPath("$.historial[0].estadoNuevo").value("RECIBIDA"))
                .andExpect(jsonPath("$.historial[0].usuario.nombre").value("Prueba VENDEDOR"))
                .andExpect(jsonPath("$.creadaPor.nombre").value("Prueba VENDEDOR"))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(respuesta).get("id").asLong();

        assertThat(jdbc.queryForObject("select detalle->>'$.motocicletaId' from auditoria where accion = "
                + "'ORDEN_CREADA' and entidad_id = ?", String.class, id)).isEqualTo(String.valueOf(moto.id()));
        assertThat(eventos.stream(OrdenCreada.class)).singleElement()
                .satisfies(e -> assertThat(e.motocicletaId()).isEqualTo(moto.id()));
        assertThat(eventos.stream(MecanicoAsignado.class)).singleElement()
                .satisfies(e -> assertThat(e.mecanicoId()).isEqualTo(mecanico.id()));
    }

    @Test
    void cp35NoSeRecibeUnaMotoDeOtroCliente() throws Exception {
        Moto moto = moto();
        long otroCliente = cliente();
        mvc.perform(con(post(BASE), vendedor).content(crear(otroCliente, moto.id(), 1000)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MOTO_NO_PERTENECE_CLIENTE"));
    }

    @Test
    void noSeRecibeUnaMotoInactiva() throws Exception {
        Moto moto = moto();
        mvc.perform(con(patch("/api/v1/motocicletas/" + moto.id() + "/estado"), admin).content("{\"activo\":false}"))
                .andExpect(status().isOk());
        mvc.perform(con(post(BASE), vendedor).content(crear(moto.clienteId(), moto.id(), 1000)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MOTO_INACTIVA"));
    }

    @Test
    void cp36UnaMotoSoloTieneUnaOrdenActiva() throws Exception {
        Moto moto = moto();
        JsonNode primera = crearOrden(moto, 1000);
        mvc.perform(con(post(BASE), vendedor).content(crear(moto.clienteId(), moto.id(), 1000)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MOTO_CON_ORDEN_ACTIVA"))
                .andExpect(jsonPath("$.numero").value(primera.get("numero").asString()));

        transicion(primera, "CANCELADA", "El cliente no dejó la moto", vendedor).andExpect(status().isOk());
        mvc.perform(con(post(BASE), vendedor).content(crear(moto.clienteId(), moto.id(), 1000)))
                .andExpect(status().isCreated());
    }

    @Test
    void cp37ElKilometrajeNoBajaDelUltimoRegistradoNiDelDeInspeccion() throws Exception {
        Moto moto = moto();
        JsonNode orden = asignar(crearOrden(moto, 10000), mecanico.id());
        orden = ok(transicion(orden, "EN_DIAGNOSTICO", null, mecanicoBearer));
        mvc.perform(con(put(BASE + "/" + id(orden) + "/diagnostico"), mecanicoBearer).content("""
                {"version":%d,"diagnostico":"Cadena estirada","kilometrajeInspeccion":9999}""".formatted(version(orden))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].campo").value("kilometrajeInspeccion"))
                .andExpect(jsonPath("$.errors[0].code").value("KILOMETRAJE_MENOR"));
        orden = diagnosticar(orden, 12000);
        transicion(orden, "CANCELADA", "Cliente retira la moto", vendedor).andExpect(status().isOk());

        mvc.perform(con(get(BASE + "/recepcion").param("motocicletaId", String.valueOf(moto.id())), vendedor))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ultimoKilometraje").value(12000))
                .andExpect(jsonPath("$.ordenActiva").doesNotExist());
        mvc.perform(con(post(BASE), vendedor).content(crear(moto.clienteId(), moto.id(), 11999)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDACION"))
                .andExpect(jsonPath("$.errors[0].campo").value("kilometrajeIngreso"))
                .andExpect(jsonPath("$.errors[0].code").value("KILOMETRAJE_MENOR"));
        JsonNode nueva = crearOrden(moto, 12000);

        mvc.perform(con(get(BASE + "/recepcion").param("motocicletaId", String.valueOf(moto.id())), vendedor))
                .andExpect(jsonPath("$.ordenActiva.id").value(id(nueva)))
                .andExpect(jsonPath("$.ordenActiva.estado").value("RECIBIDA"));
    }

    @Test
    void cp39UnMecanicoNoAsignadoNoVeNiOperaLaOrden() throws Exception {
        JsonNode suya = asignar(crearOrden(moto(), 500), mecanico.id());
        UsuariosDePrueba.Creado otro = usuarios.crear(Rol.MECANICO);
        JsonNode ajena = asignar(crearOrden(moto(), 500), otro.id());
        long ajenaId = id(ajena);

        mvc.perform(con(get(BASE + "/" + ajenaId), mecanicoBearer))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECURSO_NO_ENCONTRADO"));
        mvc.perform(con(post(BASE + "/" + ajenaId + "/transiciones"), mecanicoBearer).content("""
                {"version":%d,"estado":"EN_DIAGNOSTICO"}""".formatted(version(ajena))))
                .andExpect(status().isNotFound());
        mvc.perform(con(put(BASE + "/" + ajenaId + "/diagnostico"), mecanicoBearer).content("""
                {"version":%d,"diagnostico":"x"}""".formatted(version(ajena))))
                .andExpect(status().isNotFound());
        mvc.perform(con(get(BASE + "/999999999"), mecanicoBearer)).andExpect(status().isNotFound());

        mvc.perform(con(get(BASE), mecanicoBearer))
                .andExpect(jsonPath("$.content[*].id").value(contains((int) id(suya))));
        mvc.perform(con(get(BASE + "/mias"), mecanicoBearer))
                .andExpect(jsonPath("$.content[*].id").value(contains((int) id(suya))))
                .andExpect(jsonPath("$.content[0].mecanicos[0].nombre").value("Prueba MECANICO"));
        mvc.perform(con(get(BASE + "/resumen-estados"), mecanicoBearer))
                .andExpect(jsonPath("$.RECIBIDA").value(1))
                .andExpect(jsonPath("$.CANCELADA").value(0));
        mvc.perform(con(get(BASE + "/" + id(suya)), mecanicoBearer)).andExpect(status().isOk());
    }

    @Test
    void cadaTransicionQuedaEnElHistorialConUsuarioYNotaYPublicaElEvento() throws Exception {
        JsonNode orden = asignar(crearOrden(moto(), 100), mecanico.id());
        orden = ok(transicion(orden, "EN_DIAGNOSTICO", "  Empiezo  ", mecanicoBearer));
        orden = ok(transicion(orden, "CANCELADA", "Cliente no aprueba", vendedor));

        JsonNode historial = orden.get("historial");
        assertThat(historial).hasSize(3);
        assertThat(historial.get(1).get("estadoAnterior").asString()).isEqualTo("RECIBIDA");
        assertThat(historial.get(1).get("estadoNuevo").asString()).isEqualTo("EN_DIAGNOSTICO");
        assertThat(historial.get(1).get("nota").asString()).isEqualTo("Empiezo");
        assertThat(historial.get(1).get("usuario").get("id").asLong()).isEqualTo(mecanico.id());
        assertThat(historial.get(2).get("estadoNuevo").asString()).isEqualTo("CANCELADA");
        assertThat(historial.get(2).get("nota").asString()).isEqualTo("Cliente no aprueba");
        assertThat(historial.get(2).get("usuario").get("nombre").asString()).isEqualTo("Prueba VENDEDOR");

        assertThat(eventos.stream(EstadoOrdenCambiado.class)).extracting(EstadoOrdenCambiado::nuevo)
                .containsExactly(EstadoOrden.EN_DIAGNOSTICO, EstadoOrden.CANCELADA);
        assertThat(jdbc.queryForList("select detalle->>'$.hasta' from auditoria where accion = 'ORDEN_TRANSICION' "
                + "and entidad_id = ? order by id", String.class, id(orden)))
                .containsExactly("EN_DIAGNOSTICO", "CANCELADA");
        assertThat(jdbc.queryForObject("select count(*) from orden_estado_historial where orden_id = ?",
                Integer.class, id(orden))).isEqualTo(3);
    }

    @Test
    void lasTransicionesExigenSuCondicionSuPermisoYSuNota() throws Exception {
        JsonNode orden = crearOrden(moto(), 100);
        transicion(orden, "EN_DIAGNOSTICO", null, vendedor)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TRANSICION_INVALIDA"))
                .andExpect(jsonPath("$.motivo").value("SIN_MECANICOS"));
        transicion(orden, "FINALIZADA", null, admin)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TRANSICION_INVALIDA"))
                .andExpect(jsonPath("$.desde").value("RECIBIDA"))
                .andExpect(jsonPath("$.hasta").value("FINALIZADA"));
        transicion(orden, "CANCELADA", "   ", vendedor)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].campo").value("nota"))
                .andExpect(jsonPath("$.errors[0].code").value("NOTA_REQUERIDA"));

        orden = asignar(orden, mecanico.id());
        transicion(orden, "CANCELADA", "No puedo", mecanicoBearer).andExpect(status().isForbidden());
        orden = ok(transicion(orden, "EN_DIAGNOSTICO", null, mecanicoBearer));
        // Pasar a PENDIENTE_APROBACION es enviar un presupuesto: exige diagnóstico y al menos un ítem
        presupuesto(orden)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.motivo").value("SIN_DIAGNOSTICO"));
        orden = diagnosticar(orden, null);
        presupuesto(orden)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.motivo").value("SIN_ITEMS"));
        transicion(orden, "PENDIENTE_APROBACION", null, vendedor)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.motivo").value("PRESUPUESTO_REQUERIDO"));
        transicion(orden, "RECIBIDA", null, admin)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TRANSICION_INVALIDA"));
    }

    @Test
    void accionesPermitidasSegunRolEstadoYAsignacion() throws Exception {
        JsonNode orden = asignar(crearOrden(moto(), 100), mecanico.id());
        String almacen = usuarios.bearer(usuarios.crear(Rol.ALMACEN).id());
        String otroMecanico = usuarios.bearer(usuarios.crear(Rol.MECANICO).id());

        for (String gestor : new String[] { admin, vendedor }) {
            acciones(orden, gestor)
                    .andExpect(jsonPath("$.accionesPermitidas.editar").value(true))
                    .andExpect(jsonPath("$.accionesPermitidas.asignarMecanicos").value(true))
                    .andExpect(jsonPath("$.accionesPermitidas.registrarDiagnostico").value(false))
                    .andExpect(jsonPath("$.accionesPermitidas.transiciones[*].estado")
                            .value(contains("EN_DIAGNOSTICO", "CANCELADA")))
                    .andExpect(jsonPath("$.accionesPermitidas.transiciones[0].bloqueo").doesNotExist())
                    .andExpect(jsonPath("$.accionesPermitidas.transiciones[1].requiereNota").value(true));
        }
        acciones(orden, mecanicoBearer)
                .andExpect(jsonPath("$.accionesPermitidas.editar").value(false))
                .andExpect(jsonPath("$.accionesPermitidas.asignarMecanicos").value(false))
                .andExpect(jsonPath("$.accionesPermitidas.transiciones[*].estado").value(contains("EN_DIAGNOSTICO")));
        acciones(orden, almacen)
                .andExpect(jsonPath("$.accionesPermitidas.editar").value(false))
                .andExpect(jsonPath("$.accionesPermitidas.asignarMecanicos").value(false))
                .andExpect(jsonPath("$.accionesPermitidas.registrarDiagnostico").value(false))
                .andExpect(jsonPath("$.accionesPermitidas.transiciones").value(empty()));
        mvc.perform(con(get(BASE + "/" + id(orden)), otroMecanico)).andExpect(status().isNotFound());

        orden = ok(transicion(orden, "EN_DIAGNOSTICO", null, mecanicoBearer));
        acciones(orden, mecanicoBearer)
                .andExpect(jsonPath("$.accionesPermitidas.registrarDiagnostico").value(true))
                .andExpect(jsonPath("$.accionesPermitidas.transiciones").value(empty()));
        acciones(orden, vendedor)
                .andExpect(jsonPath("$.accionesPermitidas.registrarDiagnostico").value(true))
                .andExpect(jsonPath("$.accionesPermitidas.transiciones[*].estado")
                        .value(contains("PENDIENTE_APROBACION", "CANCELADA")))
                .andExpect(jsonPath("$.accionesPermitidas.transiciones[0].bloqueo").value("SIN_DIAGNOSTICO"));

        orden = ok(transicion(orden, "CANCELADA", "Cancelada", admin));
        acciones(orden, admin)
                .andExpect(jsonPath("$.accionesPermitidas.editar").value(false))
                .andExpect(jsonPath("$.accionesPermitidas.asignarMecanicos").value(false))
                .andExpect(jsonPath("$.accionesPermitidas.transiciones").value(empty()));
    }

    @Test
    void dosEdicionesSobreLaMismaVersionNoPasanAmbas() throws Exception {
        JsonNode orden = crearOrden(moto(), 100);
        long leida = version(orden);
        String edicion = """
                {"version":%d,"motivoIngreso":"Revisión general","descripcionProblema":"Pierde fuerza",
                 "observaciones":"Trae casco"}""".formatted(leida);

        mvc.perform(con(put(BASE + "/" + id(orden)), vendedor).content(edicion))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(greaterThan((int) leida)))
                .andExpect(jsonPath("$.observaciones").value("Trae casco"));
        mvc.perform(con(put(BASE + "/" + id(orden)), admin).content(edicion))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICTO_CONCURRENCIA"));
        // Asignar mecánicos también sube la versión aunque la orden no cambie de columnas
        mvc.perform(con(put(BASE + "/" + id(orden) + "/mecanicos"), vendedor).content("""
                {"version":%d,"mecanicos":[{"mecanicoId":%d}]}""".formatted(leida, mecanico.id())))
                .andExpect(status().isConflict());

        assertThat(jdbc.queryForObject("select detalle->>'$.campos' from auditoria where accion = "
                + "'ORDEN_ACTUALIZADA' and entidad_id = ?", String.class, id(orden)))
                .isEqualTo("[\"motivoIngreso\", \"descripcionProblema\", \"observaciones\"]");
    }

    @Test
    void soloSeAsignanMecanicosActivosSinRepetirYSePuedenQuitar() throws Exception {
        JsonNode orden = crearOrden(moto(), 100);
        UsuariosDePrueba.Creado inactivo = usuarios.crear(Rol.MECANICO, false, "es");
        UsuariosDePrueba.Creado noMecanico = usuarios.crear(Rol.VENDEDOR);

        mvc.perform(con(put(BASE + "/" + id(orden) + "/mecanicos"), vendedor).content("""
                {"version":%d,"mecanicos":[{"mecanicoId":%d},{"mecanicoId":%d},{"mecanicoId":%d},{"mecanicoId":%d}]}"""
                .formatted(version(orden), mecanico.id(), inactivo.id(), noMecanico.id(), mecanico.id())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].campo").value(contains("mecanicos[1].mecanicoId",
                        "mecanicos[2].mecanicoId", "mecanicos[3].mecanicoId")))
                .andExpect(jsonPath("$.errors[*].code").value(contains("MECANICO_INVALIDO", "MECANICO_INVALIDO",
                        "MECANICO_REPETIDO")));

        orden = asignar(orden, mecanico.id());
        mvc.perform(con(put(BASE + "/" + id(orden) + "/mecanicos"), mecanicoBearer).content("""
                {"version":%d,"mecanicos":[]}""".formatted(version(orden))))
                .andExpect(status().isForbidden());
        orden = ok(mvc.perform(con(put(BASE + "/" + id(orden) + "/mecanicos"), vendedor).content("""
                {"version":%d,"mecanicos":[]}""".formatted(version(orden)))));
        assertThat(orden.get("mecanicos")).isEmpty();
        assertThat(jdbc.queryForObject("select detalle->>'$.quitados' from auditoria where accion = "
                + "'ORDEN_MECANICOS_ASIGNADOS' and entidad_id = ? order by id desc limit 1", String.class, id(orden)))
                .isEqualTo("[" + mecanico.id() + "]");
    }

    @Test
    void laListaDeMecanicosLaVeQuienAsignaPeroNoElMecanico() throws Exception {
        mvc.perform(con(get("/api/v1/usuarios/mecanicos"), vendedor))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id").value(hasItem(mecanico.id().intValue())))
                .andExpect(jsonPath("$[0].email").doesNotExist());
        mvc.perform(con(get("/api/v1/usuarios/mecanicos"), mecanicoBearer)).andExpect(status().isForbidden());
    }

    @Test
    void elDiagnosticoSeRegistraEnDiagnosticoYSeCorrigeEnReparacionNoAntes() throws Exception {
        JsonNode orden = asignar(crearOrden(moto(), 100), mecanico.id());
        mvc.perform(con(put(BASE + "/" + id(orden) + "/diagnostico"), mecanicoBearer).content("""
                {"version":%d,"diagnostico":"Antes de tiempo"}""".formatted(version(orden))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORDEN_ESTADO_INVALIDO"));

        orden = ok(transicion(orden, "EN_DIAGNOSTICO", null, mecanicoBearer));
        orden = diagnosticar(orden, 150);
        assertThat(orden.get("diagnostico").asString()).isEqualTo("Pastillas delanteras gastadas");
        assertThat(orden.get("kilometrajeInspeccion").asInt()).isEqualTo(150);
        assertThat(jdbc.queryForList("select accion from auditoria where entidad = 'orden_trabajo' and entidad_id = ? "
                + "and accion like 'ORDEN_DIAGNOSTICO%'", String.class, id(orden)))
                .containsExactly("ORDEN_DIAGNOSTICO_REGISTRADO");
    }

    @Test
    void unaOrdenCerradaNoSeEdita() throws Exception {
        JsonNode orden = ok(transicion(crearOrden(moto(), 100), "CANCELADA", "Duplicada", vendedor));
        mvc.perform(con(put(BASE + "/" + id(orden)), vendedor).content("""
                {"version":%d,"motivoIngreso":"x","descripcionProblema":"y"}""".formatted(version(orden))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORDEN_ESTADO_INVALIDO"));
    }

    @Test
    void filtraPorTextoEstadosMecanicoYFechas() throws Exception {
        Moto moto = moto();
        JsonNode cancelada = ok(transicion(crearOrden(moto, 100), "CANCELADA", "x", vendedor));
        JsonNode activa = asignar(crearOrden(moto, 100), mecanico.id());
        String hoy = LocalDate.now(ZoneId.of("America/Bogota")).toString();

        mvc.perform(con(get(BASE).param("q", moto.placa().substring(0, 3) + "-" + moto.placa().substring(3)), admin))
                .andExpect(jsonPath("$.content[*].id").value(containsInAnyOrder((int) id(cancelada), (int) id(activa))))
                .andExpect(jsonPath("$.content[0].placa").value(moto.placa()));
        mvc.perform(con(get(BASE).param("q", moto.placa()).param("estado", "RECIBIDA", "EN_DIAGNOSTICO"), admin))
                .andExpect(jsonPath("$.content[*].id").value(contains((int) id(activa))));
        mvc.perform(con(get(BASE).param("q", activa.get("numero").asString()), admin))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(con(get(BASE).param("mecanicoId", String.valueOf(mecanico.id())), admin))
                .andExpect(jsonPath("$.content[*].id").value(contains((int) id(activa))));
        mvc.perform(con(get(BASE).param("q", moto.placa()).param("desde", hoy).param("hasta", hoy), admin))
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(con(get(BASE).param("q", moto.placa()).param("hasta", "2020-01-01"), admin))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(con(get(BASE + "/resumen-estados"), admin))
                .andExpect(jsonPath("$.RECIBIDA").value(greaterThan(0)))
                .andExpect(jsonPath("$.ENTREGADA").isNumber());
    }

    @Test
    void permisosDeLosEndpoints() throws Exception {
        Moto moto = moto();
        String almacen = usuarios.bearer(usuarios.crear(Rol.ALMACEN).id());
        mvc.perform(con(post(BASE), almacen).content(crear(moto.clienteId(), moto.id(), 1)))
                .andExpect(status().isForbidden());
        mvc.perform(con(post(BASE), mecanicoBearer).content(crear(moto.clienteId(), moto.id(), 1)))
                .andExpect(status().isForbidden());
        mvc.perform(con(get(BASE), almacen)).andExpect(status().isOk());
        mvc.perform(con(get(BASE + "/mias"), vendedor)).andExpect(status().isForbidden());
        mvc.perform(con(get(BASE + "/recepcion").param("motocicletaId", String.valueOf(moto.id())), mecanicoBearer))
                .andExpect(status().isForbidden());
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
    }

    private record Moto(long id, long clienteId, String placa) {
    }

    private Moto moto() throws Exception {
        long cliente = cliente();
        String placa = Identificadores.placa();
        long id = idCreado("/api/v1/motocicletas", """
                {"clienteId":%d,"placa":"%s","marca":"Yamaha","modelo":"FZ 150"}""".formatted(cliente, placa));
        return new Moto(id, cliente, placa);
    }

    private long cliente() throws Exception {
        return idCreado("/api/v1/clientes", """
                {"tipoDocumento":"CC","numeroDocumento":"%s","nombres":"Carlos","apellidos":"Pérez",
                 "telefono":"3001234567","aceptaTratamientoDatos":true}""".formatted(Identificadores.cedula()));
    }

    private long idCreado(String ruta, String cuerpo) throws Exception {
        String respuesta = mvc.perform(con(post(ruta), admin).content(cuerpo))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(respuesta).get("id").asLong();
    }

    private static String crear(long clienteId, long motoId, int kilometraje) {
        return """
                {"clienteId":%d,"motocicletaId":%d,"kilometrajeIngreso":%d,"motivoIngreso":"Revisión",
                 "descripcionProblema":"Ruido al frenar"}""".formatted(clienteId, motoId, kilometraje);
    }

    private JsonNode crearOrden(Moto moto, int kilometraje) throws Exception {
        return json.readTree(mvc.perform(con(post(BASE), vendedor).content(crear(moto.clienteId(), moto.id(),
                kilometraje))).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode asignar(JsonNode orden, long mecanicoId) throws Exception {
        return ok(mvc.perform(con(put(BASE + "/" + id(orden) + "/mecanicos"), vendedor).content("""
                {"version":%d,"mecanicos":[{"mecanicoId":%d}]}""".formatted(version(orden), mecanicoId))));
    }

    private JsonNode diagnosticar(JsonNode orden, Integer kilometraje) throws Exception {
        return ok(mvc.perform(con(put(BASE + "/" + id(orden) + "/diagnostico"), mecanicoBearer).content("""
                {"version":%d,"diagnostico":"Pastillas delanteras gastadas","kilometrajeInspeccion":%s}"""
                .formatted(version(orden), kilometraje))));
    }

    private ResultActions transicion(JsonNode orden, String estado, String nota, String bearer) throws Exception {
        String cuerpo = nota == null ? """
                {"version":%d,"estado":"%s"}""".formatted(version(orden), estado) : """
                {"version":%d,"estado":"%s","nota":"%s"}""".formatted(version(orden), estado, nota);
        return mvc.perform(con(post(BASE + "/" + id(orden) + "/transiciones"), bearer).content(cuerpo));
    }

    private ResultActions presupuesto(JsonNode orden) throws Exception {
        return mvc.perform(con(post(BASE + "/" + id(orden) + "/presupuestos"), vendedor).content("""
                {"version":%d,"descuento":0}""".formatted(version(orden))));
    }

    private ResultActions acciones(JsonNode orden, String bearer) throws Exception {
        return mvc.perform(con(get(BASE + "/" + id(orden)), bearer)).andExpect(status().isOk());
    }

    private JsonNode ok(ResultActions resultado) throws Exception {
        return json.readTree(resultado.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private static long id(JsonNode orden) {
        return orden.get("id").asLong();
    }

    private static long version(JsonNode orden) {
        return orden.get("version").asLong();
    }

    private static MockHttpServletRequestBuilder con(MockHttpServletRequestBuilder peticion, String bearer) {
        return peticion.header(HttpHeaders.AUTHORIZATION, bearer).contentType(MediaType.APPLICATION_JSON);
    }
}
