package com.hyskad.motocicletas.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Locale;
import java.util.stream.Stream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import com.hyskad.support.Identificadores;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.ObjectMapper;

@IntegrationTest
class MotocicletaControllerIT {

    private static final String BASE = "/api/v1/motocicletas";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper json;

    private String bearerVendedor;
    private long cliente;

    @BeforeEach
    void crearVendedorYCliente() throws Exception {
        bearerVendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
        cliente = crearCliente("Dueño");
    }

    static Stream<Arguments> escrituras() {
        String placa = Identificadores.placa();
        return Stream.of(
                Arguments.of(HttpMethod.POST, BASE, moto(1L, placa)),
                Arguments.of(HttpMethod.PUT, BASE + "/1", ficha(placa)),
                Arguments.of(HttpMethod.PATCH, BASE + "/1/estado", "{\"activo\":false}"),
                Arguments.of(HttpMethod.PATCH, BASE + "/1/propietario", "{\"clienteId\":1}"));
    }

    static Stream<Arguments> todos() {
        return Stream.concat(Stream.of(
                Arguments.of(HttpMethod.GET, BASE, null),
                Arguments.of(HttpMethod.GET, BASE + "/1", null),
                Arguments.of(HttpMethod.GET, BASE + "/1/historial", null),
                Arguments.of(HttpMethod.GET, "/api/v1/clientes/1/motocicletas", null)), escrituras());
    }

    @ParameterizedTest(name = "{0} {1} sin token → 401")
    @MethodSource("todos")
    void sinTokenDa401(HttpMethod metodo, String ruta, String cuerpo) throws Exception {
        mvc.perform(peticion(metodo, ruta, cuerpo)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest(name = "{0} {1} como almacén → 403")
    @MethodSource("todos")
    void almacenNoVeMotos(HttpMethod metodo, String ruta, String cuerpo) throws Exception {
        mvc.perform(peticion(metodo, ruta, cuerpo).header(HttpHeaders.AUTHORIZATION, bearerDe(Rol.ALMACEN)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESO_DENEGADO"));
    }

    @ParameterizedTest(name = "{0} {1} como mecánico → 403")
    @MethodSource("escrituras")
    void mecanicoNoGestionaMotos(HttpMethod metodo, String ruta, String cuerpo) throws Exception {
        mvc.perform(peticion(metodo, ruta, cuerpo).header(HttpHeaders.AUTHORIZATION, bearerDe(Rol.MECANICO)))
                .andExpect(status().isForbidden());
    }

    @Test
    void mecanicoConsultaMotosYSuHistorial() throws Exception {
        long id = crearMoto(cliente, Identificadores.placa());
        String bearer = bearerDe(Rol.MECANICO);

        mvc.perform(get(BASE).header(HttpHeaders.AUTHORIZATION, bearer)).andExpect(status().isOk());
        mvc.perform(get(BASE + "/" + id).header(HttpHeaders.AUTHORIZATION, bearer)).andExpect(status().isOk());
        mvc.perform(get(BASE + "/" + id + "/historial").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/v1/clientes/" + cliente + "/motocicletas").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void registraLaMotoConPlacaYVinNormalizados() throws Exception {
        String placa = Identificadores.placa();
        String escrita = placa.substring(0, 3).toLowerCase(Locale.ROOT) + "-" + placa.substring(3, 5) + " "
                + placa.substring(5).toLowerCase(Locale.ROOT);
        String vin = Identificadores.vin();

        String respuesta = mvc.perform(comoVendedor(post(BASE)).content("""
                {"clienteId":%d,"placa":"%s","marca":" Yamaha ","modelo":"FZ 2.0","anio":2022,"vin":"%s",
                 "cilindradaCc":149,"color":"Azul"}""".formatted(cliente, escrita, vin.toLowerCase(Locale.ROOT))))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, startsWith("http://localhost" + BASE + "/")))
                .andExpect(jsonPath("$.placa").value(placa))
                .andExpect(jsonPath("$.vin").value(vin))
                .andExpect(jsonPath("$.marca").value("Yamaha"))
                .andExpect(jsonPath("$.propietario.id").value(cliente))
                .andExpect(jsonPath("$.propietario.nombreCompleto").value("Dueño Prueba"))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(respuesta).get("id").asLong();

        mvc.perform(comoVendedor(get("/api/v1/clientes/" + cliente)))
                .andExpect(jsonPath("$.cantidadMotos").value(1));
        assertThat(jdbc.queryForObject("select detalle->>'$.placa' from auditoria where accion = "
                + "'MOTOCICLETA_CREADA' and entidad_id = ?", String.class, id)).isEqualTo(placa);
    }

    @Test
    void cp17RechazaPlacasYVinInvalidos() throws Exception {
        for (String placa : new String[] { "AB123", "ABCD12" }) {
            mvc.perform(comoVendedor(post(BASE)).content(moto(cliente, placa)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors[0].campo").value("placa"))
                    .andExpect(jsonPath("$.errors[0].code").value("PLACA_INVALIDA"));
        }
        mvc.perform(comoVendedor(post(BASE)).content("""
                {"clienteId":%d,"placa":"%s","marca":"Honda","modelo":"CB","vin":"IOQ45678901234567","anio":1800}"""
                .formatted(cliente, Identificadores.placa())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.campo == 'vin')].code").value("VIN_INVALIDO"))
                .andExpect(jsonPath("$.errors[?(@.campo == 'anio')].code").value("MIN"));
    }

    @Test
    void cp18PlacaDuplicadaDa409() throws Exception {
        String placa = Identificadores.placa();
        crearMoto(cliente, placa);

        mvc.perform(comoVendedor(post(BASE)).content(moto(cliente, placa.toLowerCase(Locale.ROOT))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PLACA_DUPLICADA"));
        long otra = crearMoto(cliente, Identificadores.placa());
        mvc.perform(comoVendedor(put(BASE + "/" + otra)).content(ficha(placa)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PLACA_DUPLICADA"));
    }

    @Test
    void vinDuplicadoDa409() throws Exception {
        String vin = Identificadores.vin();
        String conVin = "\"vin\":\"" + vin + "\",\"marca\"";
        mvc.perform(comoVendedor(post(BASE)).content(moto(cliente, Identificadores.placa()).replace("\"marca\"", conVin)))
                .andExpect(status().isCreated());

        mvc.perform(comoVendedor(post(BASE)).content(moto(cliente, Identificadores.placa()).replace("\"marca\"", conVin)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VIN_DUPLICADO"));
    }

    @Test
    void editaLaFichaYAuditaLosCampos() throws Exception {
        String placa = Identificadores.placa();
        long id = crearMoto(cliente, placa);

        mvc.perform(comoVendedor(put(BASE + "/" + id)).content("""
                {"placa":"%s","marca":"Yamaha","modelo":"XRE 300","anio":2024,"color":"Blanco"}""".formatted(placa)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.modelo").value("XRE 300"))
                .andExpect(jsonPath("$.propietario.id").value(cliente));
        assertThat(jdbc.queryForObject("select detalle->>'$.campos' from auditoria where accion = "
                + "'MOTOCICLETA_ACTUALIZADA' and entidad_id = ?", String.class, id))
                .isEqualTo("[\"modelo\", \"anio\", \"color\"]");
    }

    @Test
    void noSeAsignaAUnClienteInactivoNiInexistente() throws Exception {
        long inactivo = crearCliente("Inactivo");
        mvc.perform(comoVendedor(patch("/api/v1/clientes/" + inactivo + "/estado")).content("{\"activo\":false}"))
                .andExpect(status().isOk());

        mvc.perform(comoVendedor(post(BASE)).content(moto(inactivo, Identificadores.placa())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CLIENTE_INACTIVO"));
        mvc.perform(comoVendedor(post(BASE)).content(moto(999_999_999L, Identificadores.placa())))
                .andExpect(status().isNotFound());
        long id = crearMoto(cliente, Identificadores.placa());
        mvc.perform(comoVendedor(patch(BASE + "/" + id + "/propietario")).content("{\"clienteId\":" + inactivo + "}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CLIENTE_INACTIVO"));
    }

    @Test
    void cambiaElPropietarioConservandoLaMotoYAudita() throws Exception {
        long id = crearMoto(cliente, Identificadores.placa());
        long nuevo = crearCliente("Comprador");

        mvc.perform(comoVendedor(patch(BASE + "/" + id + "/propietario")).content("{\"clienteId\":" + nuevo + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.propietario.id").value(nuevo))
                .andExpect(jsonPath("$.propietario.nombreCompleto").value("Comprador Prueba"));

        mvc.perform(comoVendedor(get("/api/v1/clientes/" + cliente + "/motocicletas")))
                .andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(comoVendedor(get("/api/v1/clientes/" + nuevo + "/motocicletas")))
                .andExpect(jsonPath("$[0].id").value(id));
        assertThat(jdbc.queryForMap("select detalle->>'$.clienteAnterior' anterior, detalle->>'$.clienteNuevo' nuevo "
                + "from auditoria where accion = 'MOTOCICLETA_PROPIETARIO_CAMBIADO' and entidad_id = ?", id))
                .containsEntry("anterior", String.valueOf(cliente))
                .containsEntry("nuevo", String.valueOf(nuevo));
    }

    @Test
    void buscaPorPlacaParcialEscritaEnMinusculasYConGuion() throws Exception {
        String placa = Identificadores.placa();
        long buscada = crearMoto(cliente, placa);
        int digito = (Character.digit(placa.charAt(3), 10) + 1) % 10;
        crearMoto(cliente, placa.substring(0, 3) + digito + placa.substring(4));
        String parcial = placa.substring(0, 3).toLowerCase(Locale.ROOT) + "-" + placa.substring(3, 5);

        mvc.perform(comoVendedor(get(BASE)).param("placa", parcial))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(buscada))
                .andExpect(jsonPath("$.content[0].propietario.nombreCompleto").value("Dueño Prueba"));
        mvc.perform(comoVendedor(get(BASE)).param("clienteId", String.valueOf(cliente)).param("marca", "yama"))
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(comoVendedor(get(BASE)).param("clienteId", String.valueOf(cliente)).param("modelo", "XRE"))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void desactivarLaMotoLaQuitaDelConteoDelCliente() throws Exception {
        long id = crearMoto(cliente, Identificadores.placa());

        mvc.perform(comoVendedor(patch(BASE + "/" + id + "/estado")).content("{\"activo\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activo").value(false));
        mvc.perform(comoVendedor(get("/api/v1/clientes/" + cliente)))
                .andExpect(jsonPath("$.cantidadMotos").value(0));
        mvc.perform(comoVendedor(get(BASE)).param("clienteId", String.valueOf(cliente)).param("activo", "false"))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(comoVendedor(patch(BASE + "/" + id + "/estado")).content("{\"activo\":true}"))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForList("select accion from auditoria where entidad = 'motocicleta' and entidad_id = ? "
                + "order by id", String.class, id))
                .containsExactly("MOTOCICLETA_CREADA", "MOTOCICLETA_DESACTIVADA", "MOTOCICLETA_ACTIVADA");
    }

    @Test
    void motoOClienteInexistenteDa404() throws Exception {
        mvc.perform(comoVendedor(get(BASE + "/999999999"))).andExpect(status().isNotFound());
        mvc.perform(comoVendedor(get(BASE + "/999999999/historial"))).andExpect(status().isNotFound());
        mvc.perform(comoVendedor(get("/api/v1/clientes/999999999/motocicletas"))).andExpect(status().isNotFound());
    }

    private long crearCliente(String nombre) throws Exception {
        String respuesta = mvc.perform(comoVendedor(post("/api/v1/clientes")).content("""
                {"tipoDocumento":"CC","numeroDocumento":"%s","nombres":"%s","apellidos":"Prueba",
                 "telefono":"3001234567","aceptaTratamientoDatos":true}""".formatted(Identificadores.cedula(), nombre)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(respuesta).get("id").asLong();
    }

    private long crearMoto(long clienteId, String placa) throws Exception {
        String respuesta = mvc.perform(comoVendedor(post(BASE)).content(moto(clienteId, placa)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(respuesta).get("id").asLong();
    }

    private String bearerDe(Rol rol) {
        return usuarios.bearer(usuarios.crear(rol).id());
    }

    private MockHttpServletRequestBuilder comoVendedor(MockHttpServletRequestBuilder peticion) {
        return peticion.header(HttpHeaders.AUTHORIZATION, bearerVendedor).contentType(MediaType.APPLICATION_JSON);
    }

    private static String moto(Long clienteId, String placa) {
        return """
                {"clienteId":%d,"placa":"%s","marca":"Yamaha","modelo":"FZ 2.0"}""".formatted(clienteId, placa);
    }

    /** Cuerpo de {@code PUT}: la ficha sin el propietario, que se cambia aparte. */
    private static String ficha(String placa) {
        return """
                {"placa":"%s","marca":"Yamaha","modelo":"FZ 2.0"}""".formatted(placa);
    }

    private static MockHttpServletRequestBuilder peticion(HttpMethod metodo, String ruta, String cuerpo) {
        MockHttpServletRequestBuilder peticion = MockMvcRequestBuilders.request(metodo, ruta);
        return cuerpo == null ? peticion : peticion.contentType(MediaType.APPLICATION_JSON).content(cuerpo);
    }
}
