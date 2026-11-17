package com.hyskad;

import static com.hyskad.support.FlujoOrdenes.con;
import static com.hyskad.support.FlujoOrdenes.id;
import static com.hyskad.support.FlujoOrdenes.version;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.hyskad.support.FlujoOrdenes;
import com.hyskad.support.Identificadores;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.JsonNode;

/**
 * Seguridad transversal (F12, OWASP Top 10): control de acceso por objeto (IDOR), inyección SQL en
 * búsquedas y ordenamiento, y XSS almacenado (CP-61). Cada prueba crea sus propios datos.
 */
@IntegrationTest
class SeguridadIT {

    private static final String ORDENES = "/api/v1/ordenes-trabajo";

    /** Cargas típicas de inyección SQL. */
    private static final List<String> INYECCIONES = List.of("' OR '1'='1", "%' OR 1=1 -- ", "'; DROP TABLE cliente; --",
            "\" OR \"\"=\"", "1 UNION SELECT password_hash FROM usuario", "\\'; SELECT SLEEP(5); --");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private FlujoOrdenes flujo;

    @Autowired
    private JdbcTemplate jdbc;

    private String admin;
    private String vendedor;

    @BeforeEach
    void iniciar() {
        admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        vendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
    }

    // OWASP A01 (IDOR): un mecánico con el id de una orden que no tiene asignada no la ve ni la toca,
    // por ningún sub-recurso (RN-27: responde 404 o 403, nunca datos).
    @Test
    void unMecanicoNoAccedeAOrdenesAjenasPorNingunSubrecurso() throws Exception {
        UsuariosDePrueba.Creado mio = usuarios.crear(Rol.MECANICO);
        UsuariosDePrueba.Creado otro = usuarios.crear(Rol.MECANICO);
        String mecanico = usuarios.bearer(mio.id());
        JsonNode ajena = flujo.recibida(flujo.clienteConMoto(admin), 100, vendedor, otro.id());
        String base = ORDENES + "/" + id(ajena);
        long v = version(ajena);

        List<MockHttpServletRequestBuilder> intentos = List.of(
                get(base), get(base + "/comprobante"), get(base + "/presupuestos"),
                put(base).content("{\"version\":%d}".formatted(v)),
                put(base + "/diagnostico").content("{\"version\":%d,\"diagnostico\":\"x\"}".formatted(v)),
                put(base + "/mecanicos").content("{\"version\":%d,\"mecanicos\":[]}".formatted(v)),
                post(base + "/transiciones").content("{\"version\":%d,\"estado\":\"EN_DIAGNOSTICO\"}".formatted(v)),
                post(base + "/servicios").content("{\"version\":%d,\"descripcion\":\"x\",\"precio\":1000}".formatted(v)),
                post(base + "/repuestos").content("{\"version\":%d,\"productoId\":1,\"cantidad\":1}".formatted(v)),
                delete(base + "/repuestos/1").param("version", String.valueOf(v)),
                post(base + "/presupuestos").content("{\"descuento\":0}"),
                post(base + "/pago").content("{\"metodo\":\"EFECTIVO\",\"monto\":0}"),
                post(base + "/entrega").content("{}"));
        for (MockHttpServletRequestBuilder intento : intentos) {
            // El detalle responde 404: para él la orden ajena "no existe"
            if (intento == intentos.get(0)) {
                mvc.perform(con(intento, mecanico)).andExpect(status().isNotFound());
            }
            // 400 (cuerpo incompleto a propósito) tampoco expone ni cambia nada; nunca un 2xx
            int estado = mvc.perform(con(intento, mecanico)).andReturn().getResponse().getStatus();
            assertThat(estado).as(intento.toString()).isIn(400, 403, 404);
        }
        // Nada cambió: la orden sigue recibida, sin ítems ni historial nuevo
        JsonNode despues = flujo.obtener(ajena, admin);
        assertThat(despues.get("estado").asString()).isEqualTo("RECIBIDA");
        assertThat(despues.get("version").asLong()).isEqualTo(v);
        assertThat(despues.get("servicios")).isEmpty();
    }

    // OWASP A01: el acceso entre roles se decide por permiso en el backend, no solo en el menú
    @Test
    void sinElPermisoNoSeLeenNiModificanRecursosDeOtrasAreas() throws Exception {
        long adminId = usuarios.crear(Rol.ADMIN).id();
        String mecanico = usuarios.bearer(usuarios.crear(Rol.MECANICO).id());
        String almacen = usuarios.bearer(usuarios.crear(Rol.ALMACEN).id());

        mvc.perform(con(get("/api/v1/usuarios/" + adminId), vendedor)).andExpect(status().isForbidden());
        mvc.perform(con(patch("/api/v1/usuarios/" + adminId + "/estado"), vendedor).content("{\"activo\":false}"))
                .andExpect(status().isForbidden());
        mvc.perform(con(get("/api/v1/auditoria"), vendedor)).andExpect(status().isForbidden());
        mvc.perform(con(get("/api/v1/configuracion"), vendedor)).andExpect(status().isForbidden());
        mvc.perform(con(post("/api/v1/ventas/1/anulacion"), vendedor).content("{\"motivo\":\"Prueba de acceso\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(con(get("/api/v1/ventas"), mecanico)).andExpect(status().isForbidden());
        mvc.perform(con(get("/api/v1/clientes"), almacen)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/clientes")).andExpect(status().isUnauthorized());
    }

    // CP-61, OWASP A03: las búsquedas tratan la entrada como dato (consultas con parámetros)
    @Test
    void cp61LasBusquedasNoEjecutanInyeccionSql() throws Exception {
        long clientesAntes = jdbc.queryForObject("select count(*) from cliente", Long.class);
        List<String> listados = List.of("/api/v1/clientes", "/api/v1/motocicletas", ORDENES, "/api/v1/productos",
                "/api/v1/ventas", "/api/v1/proveedores", "/api/v1/usuarios");
        for (String carga : INYECCIONES) {
            for (String listado : listados) {
                mvc.perform(con(get(listado).param("q", carga), admin))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.totalElements").value(0));
            }
            JsonNode busqueda = flujo.ok(mvc.perform(con(get("/api/v1/busqueda").param("q", carga), admin)));
            busqueda.properties().forEach(tipo -> assertThat(tipo.getValue()).as(tipo.getKey()).isEmpty());
        }
        assertThat(jdbc.queryForObject("select count(*) from cliente", Long.class)).isEqualTo(clientesAntes);
    }

    // CP-61: el ordenamiento solo acepta propiedades conocidas; lo demás es 400, no SQL ni 500
    @Test
    void cp61ElOrdenamientoNoAceptaSqlNiPropiedadesDesconocidas() throws Exception {
        for (String sort : List.of("nombreCompleto;DROP TABLE cliente", "password_hash,asc", "(select 1)",
                "nombreCompleto,asc; --")) {
            mvc.perform(con(get("/api/v1/clientes").param("sort", sort), admin))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").exists());
        }
    }

    // CP-61, OWASP A03 (XSS): el backend guarda el texto tal cual y lo devuelve como JSON; el frontend
    // lo muestra como texto (Angular escapa la interpolación; la E2E de seguridad lo verifica en el navegador).
    @Test
    void cp61UnScriptEnUnNombreSeGuardaYDevuelveComoTextoJson() throws Exception {
        String script = "<script>alert(1)</script>";
        MvcResult creado = mvc.perform(con(post("/api/v1/clientes"), admin).content("""
                {"tipoDocumento":"CC","numeroDocumento":"%s","nombres":"%s","apellidos":"<img src=x onerror=alert(2)>",
                 "telefono":"3001234567","aceptaTratamientoDatos":true}""".formatted(Identificadores.cedula(), script)))
                .andExpect(status().isCreated())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andReturn();
        JsonNode cliente = flujo.ok(mvc.perform(con(get(creado.getResponse().getHeader("Location")), admin)));
        assertThat(cliente.get("nombres").asString()).isEqualTo(script);
    }
}
