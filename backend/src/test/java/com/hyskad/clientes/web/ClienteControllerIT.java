package com.hyskad.clientes.web;

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

import java.util.concurrent.ThreadLocalRandom;
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
class ClienteControllerIT {

    private static final String BASE = "/api/v1/clientes";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper json;

    private String bearerVendedor;

    @BeforeEach
    void crearVendedor() {
        bearerVendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
    }

    static Stream<Arguments> escrituras() {
        String cliente = persona(Identificadores.cedula(), "Ana", "Prueba", "3001234567");
        return Stream.of(
                Arguments.of(HttpMethod.POST, BASE, cliente),
                Arguments.of(HttpMethod.PUT, BASE + "/1", cliente),
                Arguments.of(HttpMethod.PATCH, BASE + "/1/estado", "{\"activo\":false}"));
    }

    static Stream<Arguments> lecturas() {
        return Stream.of(Arguments.of(HttpMethod.GET, BASE, null), Arguments.of(HttpMethod.GET, BASE + "/1", null));
    }

    static Stream<Arguments> todos() {
        return Stream.concat(lecturas(), escrituras());
    }

    @ParameterizedTest(name = "{0} {1} sin token → 401")
    @MethodSource("todos")
    void sinTokenDa401(HttpMethod metodo, String ruta, String cuerpo) throws Exception {
        mvc.perform(peticion(metodo, ruta, cuerpo)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest(name = "{0} {1} como almacén → 403")
    @MethodSource("todos")
    void almacenNoVeClientes(HttpMethod metodo, String ruta, String cuerpo) throws Exception {
        mvc.perform(peticion(metodo, ruta, cuerpo).header(HttpHeaders.AUTHORIZATION, bearerDe(Rol.ALMACEN)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESO_DENEGADO"));
    }

    @ParameterizedTest(name = "{0} {1} como mecánico → 403")
    @MethodSource("escrituras")
    void mecanicoNoGestionaClientes(HttpMethod metodo, String ruta, String cuerpo) throws Exception {
        mvc.perform(peticion(metodo, ruta, cuerpo).header(HttpHeaders.AUTHORIZATION, bearerDe(Rol.MECANICO)))
                .andExpect(status().isForbidden());
    }

    @Test
    void mecanicoConsultaClientes() throws Exception {
        long id = crear(persona(Identificadores.cedula(), "Mario", "Consulta", "3001234567"));
        String bearer = bearerDe(Rol.MECANICO);

        mvc.perform(get(BASE).header(HttpHeaders.AUTHORIZATION, bearer)).andExpect(status().isOk());
        mvc.perform(get(BASE + "/" + id).header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id));
    }

    @Test
    void cp14RegistraClienteConCedulaYAutorizacionDeDatos() throws Exception {
        String cedula = Identificadores.cedula();

        String respuesta = mvc.perform(comoVendedor(post(BASE)).content("""
                {"tipoDocumento":"CC","numeroDocumento":" %s ","nombres":"  Carlos ","apellidos":"Pérez",
                 "telefono":"+57 300 123-4567","email":"Carlos@Correo.TEST","direccion":"Calle 1",
                 "ciudad":"Montería","aceptaTratamientoDatos":true}""".formatted(cedula)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, startsWith("http://localhost" + BASE + "/")))
                .andExpect(jsonPath("$.numeroDocumento").value(cedula))
                .andExpect(jsonPath("$.nombres").value("Carlos"))
                .andExpect(jsonPath("$.nombreCompleto").value("Carlos Pérez"))
                .andExpect(jsonPath("$.telefono").value("3001234567"))
                .andExpect(jsonPath("$.email").value("carlos@correo.test"))
                .andExpect(jsonPath("$.aceptaTratamientoDatos").value(true))
                .andExpect(jsonPath("$.fechaAceptacionDatos").isNotEmpty())
                .andExpect(jsonPath("$.activo").value(true))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(respuesta).get("id").asLong();

        mvc.perform(comoVendedor(get(BASE + "/" + id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.direccion").value("Calle 1"))
                .andExpect(jsonPath("$.cantidadMotos").value(0));
        assertThat(jdbc.queryForObject("select detalle->>'$.tipoDocumento' from auditoria "
                + "where accion = 'CLIENTE_CREADO' and entidad_id = ?", String.class, id)).isEqualTo("CC");
    }

    @Test
    void conNitGuardaElDvConGuionYUsaRazonSocial() throws Exception {
        String nit = Identificadores.nit();
        String conPuntos = nit.substring(0, 3) + "." + nit.substring(3, 6) + "." + nit.substring(6, 9) + "-"
                + nit.substring(9);

        mvc.perform(comoVendedor(post(BASE)).content("""
                {"tipoDocumento":"NIT","numeroDocumento":"%s","nombres":"Ignorado","razonSocial":"Motos S.A.S.",
                 "telefono":"6047891234","aceptaTratamientoDatos":false}""".formatted(conPuntos)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.numeroDocumento").value(nit.substring(0, 9) + "-" + nit.substring(9)))
                .andExpect(jsonPath("$.razonSocial").value("Motos S.A.S."))
                .andExpect(jsonPath("$.nombres").doesNotExist())
                .andExpect(jsonPath("$.nombreCompleto").value("Motos S.A.S."))
                .andExpect(jsonPath("$.fechaAceptacionDatos").doesNotExist());
    }

    @Test
    void cp15NitConDigitoDeVerificacionIncorrectoDa400() throws Exception {
        String nit = Identificadores.nit();
        String dvMalo = nit.substring(0, 9) + ((Character.digit(nit.charAt(9), 10) + 1) % 10);

        mvc.perform(comoVendedor(post(BASE)).content("""
                {"tipoDocumento":"NIT","numeroDocumento":"%s","razonSocial":"Mala S.A.S.","telefono":"3001234567",
                 "aceptaTratamientoDatos":true}""".formatted(dvMalo)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDACION"))
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].campo").value("numeroDocumento"))
                .andExpect(jsonPath("$.errors[0].code").value("NIT_INVALIDO"));
    }

    @Test
    void validaNombreSegunTipoTelefonoYAutorizacion() throws Exception {
        mvc.perform(comoVendedor(post(BASE)).content("""
                {"tipoDocumento":"NIT","numeroDocumento":"%s","nombres":"Sin","apellidos":"Razón",
                 "telefono":"3001234567","aceptaTratamientoDatos":true}""".formatted(Identificadores.nit())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].campo").value("razonSocial"))
                .andExpect(jsonPath("$.errors[0].code").value("NOT_BLANK"));

        mvc.perform(comoVendedor(post(BASE)).content("""
                {"tipoDocumento":"CC","numeroDocumento":"12AB","razonSocial":"Empresa","telefono":"2001234567"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(5)))
                .andExpect(jsonPath("$.errors[?(@.campo == 'numeroDocumento')].code").value("DOCUMENTO_INVALIDO"))
                .andExpect(jsonPath("$.errors[?(@.campo == 'nombres')].code").value("NOT_BLANK"))
                .andExpect(jsonPath("$.errors[?(@.campo == 'apellidos')].code").value("NOT_BLANK"))
                .andExpect(jsonPath("$.errors[?(@.campo == 'telefono')].code").value("TELEFONO_INVALIDO"))
                .andExpect(jsonPath("$.errors[?(@.campo == 'aceptaTratamientoDatos')].code").value("NOT_NULL"));
    }

    @Test
    void cp16DocumentoDuplicadoDa409() throws Exception {
        String cedula = Identificadores.cedula();
        crear(persona(cedula, "Primero", "Dueño", "3001234567"));

        mvc.perform(comoVendedor(post(BASE)).content(persona(cedula.substring(0, 4) + " " + cedula.substring(4),
                "Segundo", "Dueño", "3001234567")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DOCUMENTO_DUPLICADO"));

        long otro = crear(persona(Identificadores.cedula(), "Otro", "Cliente", "3001234567"));
        mvc.perform(comoVendedor(put(BASE + "/" + otro)).content(persona(cedula, "Otro", "Cliente", "3001234567")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DOCUMENTO_DUPLICADO"));
        // El mismo número con otro tipo de documento no choca (RN-40: único por tipo)
        mvc.perform(comoVendedor(post(BASE)).content("""
                {"tipoDocumento":"PPT","numeroDocumento":"%s","nombres":"Otro","apellidos":"Tipo",
                 "telefono":"3001234567","aceptaTratamientoDatos":true}""".formatted(cedula.substring(0, 8))))
                .andExpect(status().isCreated());
    }

    @Test
    void editarConservaLaFechaDeAutorizacionYRetirarlaLaBorra() throws Exception {
        String cedula = Identificadores.cedula();
        long id = crear(persona(cedula, "Laura", "Edita", "3001234567"));
        String fecha = jdbc.queryForObject("select fecha_aceptacion_datos from cliente where id = ?", String.class, id);

        mvc.perform(comoVendedor(put(BASE + "/" + id)).content(persona(cedula, "Laura", "Editada", "3109876543")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apellidos").value("Editada"))
                .andExpect(jsonPath("$.telefono").value("3109876543"));
        assertThat(jdbc.queryForObject("select fecha_aceptacion_datos from cliente where id = ?", String.class, id))
                .isEqualTo(fecha);
        assertThat(jdbc.queryForObject("select detalle->>'$.campos' from auditoria where accion = "
                + "'CLIENTE_ACTUALIZADO' and entidad_id = ?", String.class, id))
                .isEqualTo("[\"apellidos\", \"telefono\"]");

        mvc.perform(comoVendedor(put(BASE + "/" + id)).content(persona(cedula, "Laura", "Editada", "3109876543")
                .replace("\"aceptaTratamientoDatos\":true", "\"aceptaTratamientoDatos\":false")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aceptaTratamientoDatos").value(false))
                .andExpect(jsonPath("$.fechaAceptacionDatos").doesNotExist());
    }

    @Test
    void desactivaYReactivaConAuditoria() throws Exception {
        long id = crear(persona(Identificadores.cedula(), "Pedro", "Estado", "3001234567"));

        mvc.perform(comoVendedor(patch(BASE + "/" + id + "/estado")).content("{\"activo\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activo").value(false));
        mvc.perform(comoVendedor(patch(BASE + "/" + id + "/estado")).content("{\"activo\":false}"))
                .andExpect(status().isOk());
        mvc.perform(comoVendedor(patch(BASE + "/" + id + "/estado")).content("{\"activo\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activo").value(true));
        assertThat(jdbc.queryForList("select accion from auditoria where entidad = 'cliente' and entidad_id = ? "
                + "order by id", String.class, id))
                .containsExactly("CLIENTE_CREADO", "CLIENTE_DESACTIVADO", "CLIENTE_ACTIVADO");
    }

    @Test
    void cp20BuscaPorNombreParcialDocumentoYTelefonoConPaginacion() throws Exception {
        String marca = "Zuñiga" + ThreadLocalRandom.current().nextInt(100_000, 999_999);
        String cedula = Identificadores.cedula();
        String telefono = "31" + cedula.substring(2);
        crear(persona(cedula, "Ana", marca + " Uno", telefono));
        long segundo = crear(persona(Identificadores.cedula(), "Beatriz", marca + " Dos", "3001234567"));
        crear(persona(Identificadores.cedula(), "Camila", marca + " Tres", "3001234567"));
        mvc.perform(comoVendedor(patch(BASE + "/" + segundo + "/estado")).content("{\"activo\":false}"));

        // Nombre parcial sin tilde ni mayúsculas, paginado de a 2, ordenado por nombre
        String parcial = marca.replace("Zuñiga", "zuniga");
        mvc.perform(comoVendedor(get(BASE)).param("q", parcial).param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content[0].nombreCompleto").value("Ana " + marca + " Uno"))
                .andExpect(jsonPath("$.content[1].nombreCompleto").value("Beatriz " + marca + " Dos"))
                .andExpect(jsonPath("$.content[0].direccion").doesNotExist())
                .andExpect(jsonPath("$.content[0].aceptaTratamientoDatos").doesNotExist())
                .andExpect(jsonPath("$.content[0].cantidadMotos").value(0));
        mvc.perform(comoVendedor(get(BASE)).param("q", parcial).param("activo", "true"))
                .andExpect(jsonPath("$.totalElements").value(2));

        // Documento escrito con espacios y teléfono parcial con espacios
        String conEspacios = cedula.substring(0, 3) + " " + cedula.substring(3);
        mvc.perform(comoVendedor(get(BASE)).param("q", conEspacios))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].numeroDocumento").value(cedula));
        mvc.perform(comoVendedor(get(BASE)).param("q", telefono.substring(0, 3) + " " + telefono.substring(3)))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(comoVendedor(get(BASE)).param("q", "%")).andExpect(status().isOk());
    }

    @Test
    void clienteInexistenteDa404() throws Exception {
        mvc.perform(comoVendedor(get(BASE + "/999999999")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECURSO_NO_ENCONTRADO"));
    }

    private long crear(String cuerpo) throws Exception {
        String respuesta = mvc.perform(comoVendedor(post(BASE)).content(cuerpo))
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

    private static String persona(String cedula, String nombres, String apellidos, String telefono) {
        return """
                {"tipoDocumento":"CC","numeroDocumento":"%s","nombres":"%s","apellidos":"%s","telefono":"%s",
                 "aceptaTratamientoDatos":true}""".formatted(cedula, nombres, apellidos, telefono);
    }

    private static MockHttpServletRequestBuilder peticion(HttpMethod metodo, String ruta, String cuerpo) {
        MockHttpServletRequestBuilder peticion = MockMvcRequestBuilders.request(metodo, ruta);
        return cuerpo == null ? peticion : peticion.contentType(MediaType.APPLICATION_JSON).content(cuerpo);
    }
}
