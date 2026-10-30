package com.hyskad.usuarios.web;

import static com.hyskad.support.UsuariosDePrueba.PASSWORD;
import static com.hyskad.support.UsuariosDePrueba.ipUnica;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;
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

import com.hyskad.auth.web.CookieRefresh;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.support.UsuariosDePrueba.Creado;
import com.hyskad.usuarios.domain.Rol;

import jakarta.servlet.http.Cookie;

@IntegrationTest
class UsuarioControllerIT {

    private static final String BASE = "/api/v1/usuarios";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private JdbcTemplate jdbc;

    private Creado admin;
    private String bearerAdmin;

    @BeforeEach
    void crearAdmin() {
        admin = usuarios.crear(Rol.ADMIN);
        bearerAdmin = usuarios.bearer(admin.id());
    }

    static Stream<Arguments> endpoints() {
        String permisos = "{\"ajustes\":[]}";
        String usuario = "{\"nombre\":\"X\",\"email\":\"x@prueba.test\",\"password\":\"Clave12345\",\"rol\":\"VENDEDOR\"}";
        String edicion = "{\"nombre\":\"X\",\"email\":\"x@prueba.test\",\"rol\":\"VENDEDOR\"}";
        return Stream.of(
                Arguments.of(HttpMethod.GET, BASE, null),
                Arguments.of(HttpMethod.GET, BASE + "/1", null),
                Arguments.of(HttpMethod.POST, BASE, usuario),
                Arguments.of(HttpMethod.PUT, BASE + "/1", edicion),
                Arguments.of(HttpMethod.PATCH, BASE + "/1/estado", "{\"activo\":false}"),
                Arguments.of(HttpMethod.GET, BASE + "/1/permisos", null),
                Arguments.of(HttpMethod.PUT, BASE + "/1/permisos", permisos));
    }

    @ParameterizedTest(name = "{0} {1} sin token → 401")
    @MethodSource("endpoints")
    void sinTokenDa401(HttpMethod metodo, String ruta, String cuerpo) throws Exception {
        mvc.perform(peticion(metodo, ruta, cuerpo))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("NO_AUTENTICADO"));
    }

    @ParameterizedTest(name = "{0} {1} sin USUARIOS_GESTIONAR → 403")
    @MethodSource("endpoints")
    void cp10SinPermisoDa403(HttpMethod metodo, String ruta, String cuerpo) throws Exception {
        for (Rol rol : List.of(Rol.MECANICO, Rol.VENDEDOR, Rol.ALMACEN)) {
            Creado usuario = usuarios.crear(rol);
            mvc.perform(peticion(metodo, ruta, cuerpo).header(HttpHeaders.AUTHORIZATION, usuarios.bearer(usuario.id())))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("ACCESO_DENEGADO"));
        }
    }

    @Test
    void creaUnUsuarioConEmailNormalizadoYDevuelveLocation() throws Exception {
        String email = "Nuevo-" + UUID.randomUUID().toString().substring(0, 6) + "@Prueba.TEST";

        mvc.perform(conAdmin(post(BASE)).content("""
                {"nombre":"  Nuevo Vendedor ","email":"%s","telefono":"3001234567","password":"Clave12345",
                 "rol":"VENDEDOR","idioma":"en"}""".formatted(email)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, startsWith("http://localhost" + BASE + "/")))
                .andExpect(jsonPath("$.email").value(email.toLowerCase()))
                .andExpect(jsonPath("$.nombre").value("Nuevo Vendedor"))
                .andExpect(jsonPath("$.activo").value(true))
                .andExpect(jsonPath("$.idioma").value("en"))
                .andExpect(jsonPath("$.debeCambiarPassword").value(false))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        assertThat(jdbc.queryForObject("select created_by from usuario where email = ?", Long.class,
                email.toLowerCase())).isEqualTo(admin.id());
        assertThat(jdbc.queryForObject("select count(*) from auditoria a join usuario u on u.id = a.entidad_id "
                + "where a.accion = 'USUARIO_CREADO' and u.email = ? and a.usuario_id = ?", Integer.class,
                email.toLowerCase(), admin.id())).isEqualTo(1);
    }

    @Test
    void cp06ContrasenaDebilDa400() throws Exception {
        mvc.perform(conAdmin(post(BASE)).content("""
                {"nombre":"Debil","email":"debil@prueba.test","password":"solotexto","rol":"MECANICO"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDACION"))
                .andExpect(jsonPath("$.errors[0].campo").value("password"))
                .andExpect(jsonPath("$.errors[0].code").value("PASSWORD_DEBIL"));
    }

    @Test
    void cp07EmailRepetidoDa409SinImportarMayusculas() throws Exception {
        Creado existente = usuarios.crear(Rol.VENDEDOR);

        mvc.perform(conAdmin(post(BASE)).content("""
                {"nombre":"Repetido","email":"%s","password":"Clave12345","rol":"VENDEDOR"}"""
                .formatted(existente.email().toUpperCase())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_DUPLICADO"));
        Creado otro = usuarios.crear(Rol.VENDEDOR);
        mvc.perform(conAdmin(put(BASE + "/" + otro.id())).content("""
                {"nombre":"Otro","email":"%s","rol":"VENDEDOR"}""".formatted(existente.email())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_DUPLICADO"));
    }

    @Test
    void cp08NoSePuedeDesactivarNiDegradarAlUnicoAdminActivo() throws Exception {
        List<Long> otrosAdmins = jdbc.queryForList(
                "select id from usuario where rol = 'ADMIN' and activo = true and id <> ?", Long.class, admin.id());
        try {
            jdbc.update("update usuario set activo = false where rol = 'ADMIN' and id <> ?", admin.id());

            mvc.perform(conAdmin(patch(BASE + "/" + admin.id() + "/estado")).content("{\"activo\":false}"))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("ULTIMO_ADMIN"));
            mvc.perform(conAdmin(put(BASE + "/" + admin.id())).content("""
                    {"nombre":"Admin","email":"%s","rol":"VENDEDOR"}""".formatted(admin.email())))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("ULTIMO_ADMIN"));
        } finally {
            otrosAdmins.forEach(id -> jdbc.update("update usuario set activo = true where id = ?", id));
        }
    }

    @Test
    void nadiePuedeDesactivarseNiCambiarseSusPermisos() throws Exception {
        usuarios.crear(Rol.ADMIN);

        mvc.perform(conAdmin(patch(BASE + "/" + admin.id() + "/estado")).content("{\"activo\":false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("AUTO_MODIFICACION"));
        mvc.perform(conAdmin(put(BASE + "/" + admin.id() + "/permisos")).content("{\"ajustes\":[]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("AUTO_MODIFICACION"));
        mvc.perform(conAdmin(get(BASE + "/" + admin.id() + "/permisos")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].editable", everyItem(is(false))));
    }

    @Test
    void desactivarRevocaLasSesionesYReactivarFunciona() throws Exception {
        Creado vendedor = usuarios.crear(Rol.VENDEDOR);
        String refresh = refreshDe(vendedor);

        mvc.perform(conAdmin(patch(BASE + "/" + vendedor.id() + "/estado")).content("{\"activo\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activo").value(false));

        mvc.perform(post("/api/v1/auth/refresh").with(ipUnica()).cookie(new Cookie(CookieRefresh.NOMBRE, refresh)))
                .andExpect(status().isUnauthorized());
        mvc.perform(conAdmin(patch(BASE + "/" + vendedor.id() + "/estado")).content("{\"activo\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activo").value(true));
        assertThat(jdbc.queryForList("select accion from auditoria where entidad_id = ? and accion like 'USUARIO_%'",
                String.class, vendedor.id())).containsExactly("USUARIO_DESACTIVADO", "USUARIO_ACTIVADO");
    }

    @Test
    void cp09RetirarVentasCrearAUnVendedorCambiaSusPermisosYRevocaSesiones() throws Exception {
        Creado vendedor = usuarios.crear(Rol.VENDEDOR);
        String refresh = refreshDe(vendedor);

        mvc.perform(conAdmin(put(BASE + "/" + vendedor.id() + "/permisos")).content("""
                {"ajustes":[{"permiso":"VENTAS_CREAR","concedido":false},
                            {"permiso":"VENTAS_ANULAR","concedido":true}]}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.permiso == 'VENTAS_CREAR')].ajuste").value("RETIRADO"))
                .andExpect(jsonPath("$[?(@.permiso == 'VENTAS_CREAR')].efectivo").value(false))
                .andExpect(jsonPath("$[?(@.permiso == 'VENTAS_CREAR')].delRol").value(true))
                .andExpect(jsonPath("$[?(@.permiso == 'VENTAS_ANULAR')].ajuste").value("CONCEDIDO"))
                .andExpect(jsonPath("$[?(@.permiso == 'USUARIOS_GESTIONAR')].editable").value(false));

        mvc.perform(post("/api/v1/auth/refresh").with(ipUnica()).cookie(new Cookie(CookieRefresh.NOMBRE, refresh)))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, usuarios.bearer(vendedor.id())))
                .andExpect(jsonPath("$.permisos", not(hasItem("VENTAS_CREAR"))))
                .andExpect(jsonPath("$.permisos", hasItem("VENTAS_ANULAR")));
        assertThat(jdbc.queryForObject("select count(*) from auditoria where accion = 'PERMISOS_ACTUALIZADOS' and "
                + "entidad_id = ? and json_contains(detalle->'$.retirados', '\"VENTAS_CREAR\"')", Integer.class,
                vendedor.id())).isEqualTo(1);
    }

    @Test
    void noSeConcedeUnPermisoSoloAdminNiSeRepitenPermisos() throws Exception {
        Creado almacen = usuarios.crear(Rol.ALMACEN);

        mvc.perform(conAdmin(put(BASE + "/" + almacen.id() + "/permisos")).content("""
                {"ajustes":[{"permiso":"USUARIOS_GESTIONAR","concedido":true}]}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PERMISO_SOLO_ADMIN"));
        mvc.perform(conAdmin(put(BASE + "/" + almacen.id() + "/permisos")).content("""
                {"ajustes":[{"permiso":"VENTAS_VER","concedido":true},{"permiso":"VENTAS_VER","concedido":false}]}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("PERMISO_REPETIDO"));
    }

    @Test
    void cambiarElRolSeAuditaYRevocaSesiones() throws Exception {
        Creado mecanico = usuarios.crear(Rol.MECANICO);
        String refresh = refreshDe(mecanico);

        mvc.perform(conAdmin(put(BASE + "/" + mecanico.id())).content("""
                {"nombre":"Ahora Vendedor","email":"%s","telefono":"+57 300 1234567","rol":"VENDEDOR"}"""
                .formatted(mecanico.email())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rol").value("VENDEDOR"))
                .andExpect(jsonPath("$.telefono").value("+57 300 1234567"));

        mvc.perform(post("/api/v1/auth/refresh").with(ipUnica()).cookie(new Cookie(CookieRefresh.NOMBRE, refresh)))
                .andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("select json_unquote(detalle->'$.rolNuevo') from auditoria where "
                + "accion = 'USUARIO_ACTUALIZADO' and entidad_id = ?", String.class, mecanico.id())).isEqualTo("VENDEDOR");
    }

    @Test
    void listaPaginadaConFiltros() throws Exception {
        String marca = "Filtro" + UUID.randomUUID().toString().substring(0, 6);
        crearPorApi(marca + " Uno", "MECANICO");
        crearPorApi(marca + " Dos", "MECANICO");
        Long inactivo = crearPorApi(marca + " Tres", "ALMACEN");
        mvc.perform(conAdmin(patch(BASE + "/" + inactivo + "/estado")).content("{\"activo\":false}"));

        mvc.perform(conAdmin(get(BASE)).param("q", marca.toLowerCase()).param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].nombre").value(marca + " Dos"));
        mvc.perform(conAdmin(get(BASE)).param("q", marca).param("rol", "MECANICO"))
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(conAdmin(get(BASE)).param("q", marca).param("activo", "false"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(inactivo));
        mvc.perform(conAdmin(get(BASE)).param("q", "%")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(conAdmin(get(BASE)).param("sort", "noExiste,asc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PARAMETRO_INVALIDO"));
    }

    @Test
    void obtenerUnUsuarioInexistenteDa404() throws Exception {
        mvc.perform(conAdmin(get(BASE + "/999999999")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECURSO_NO_ENCONTRADO"));
    }

    private Long crearPorApi(String nombre, String rol) throws Exception {
        String respuesta = mvc.perform(conAdmin(post(BASE)).content("""
                {"nombre":"%s","email":"%s@prueba.test","password":"Clave12345","rol":"%s"}"""
                .formatted(nombre, UUID.randomUUID(), rol)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return Long.valueOf(respuesta.replaceAll(".*\"id\":(\\d+).*", "$1"));
    }

    private String refreshDe(Creado usuario) throws Exception {
        String cookie = mvc.perform(post("/api/v1/auth/login").with(ipUnica()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + usuario.email() + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader(HttpHeaders.SET_COOKIE);
        return cookie.substring("hk_refresh=".length(), cookie.indexOf(';'));
    }

    private MockHttpServletRequestBuilder conAdmin(MockHttpServletRequestBuilder peticion) {
        return peticion.header(HttpHeaders.AUTHORIZATION, bearerAdmin).contentType(MediaType.APPLICATION_JSON);
    }

    private static MockHttpServletRequestBuilder peticion(HttpMethod metodo, String ruta, String cuerpo) {
        MockHttpServletRequestBuilder peticion = MockMvcRequestBuilders.request(metodo, ruta);
        return cuerpo == null ? peticion : peticion.contentType(MediaType.APPLICATION_JSON).content(cuerpo);
    }
}
