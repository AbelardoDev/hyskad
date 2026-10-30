package com.hyskad.auth.web;

import static com.hyskad.support.UsuariosDePrueba.PASSWORD;
import static com.hyskad.support.UsuariosDePrueba.ipUnica;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.support.UsuariosDePrueba.Creado;
import com.hyskad.usuarios.domain.Rol;

import jakarta.servlet.http.Cookie;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@IntegrationTest
@ExtendWith(OutputCaptureExtension.class)
class AuthControllerIT {

    private static final Pattern VALOR_COOKIE = Pattern.compile("hk_refresh=([^;]*)");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper json;

    @Test
    void cp01LoginValidoEntregaTokenYCookieSegura(CapturedOutput salida) throws Exception {
        Creado vendedor = usuarios.crear(Rol.VENDEDOR);
        int inicioSalida = salida.getAll().length();

        MvcResult resultado = mvc.perform(login(vendedor.email().toUpperCase(), PASSWORD, ipUnica()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expiresIn").value(900))
                .andExpect(jsonPath("$.usuario.id").value(vendedor.id()))
                .andExpect(jsonPath("$.usuario.email").value(vendedor.email()))
                .andExpect(jsonPath("$.usuario.rol").value("VENDEDOR"))
                .andExpect(jsonPath("$.usuario.permisos", hasItem("VENTAS_CREAR")))
                .andExpect(jsonPath("$.usuario.permisos", not(hasItem("USUARIOS_GESTIONAR"))))
                .andExpect(jsonPath("$.usuario.debeCambiarPassword").value(false))
                .andExpect(jsonPath("$.usuario.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andReturn();

        String cookie = resultado.getResponse().getHeader(HttpHeaders.SET_COOKIE);
        assertThat(cookie).startsWith("hk_refresh=").contains("Path=/api/v1/auth", "HttpOnly", "SameSite=Strict",
                "Secure", "Max-Age=604800");

        JsonNode claims = claims(resultado);
        assertThat(claims.get("sub").asString()).isEqualTo(String.valueOf(vendedor.id()));
        assertThat(claims.get("iss").asString()).isEqualTo("hyskad");
        assertThat(claims.get("rol").asString()).isEqualTo("VENDEDOR");
        assertThat(claims.get("exp").asLong() - claims.get("iat").asLong()).isEqualTo(900);
        assertThat(claims.has("email") && claims.has("nombre") && claims.has("permisos")).isTrue();

        assertThat(jdbc.queryForObject("select ultimo_acceso from usuario where id = ?", Object.class, vendedor.id()))
                .isNotNull();
        assertThat(auditorias("LOGIN_EXITOSO", vendedor.id())).isEqualTo(1);
        assertThat(salida.getAll().substring(inicioSalida))
                .doesNotContain(PASSWORD, accessToken(resultado), valorCookie(resultado));
    }

    /** Dos dispositivos del mismo usuario entrando a la vez no deben bloquearse mutuamente (deadlock). */
    @Test
    void loginsSimultaneosDelMismoUsuarioResponden200() throws Exception {
        Creado vendedor = usuarios.crear(Rol.VENDEDOR);
        int intentos = 8;
        CountDownLatch salida = new CountDownLatch(1);
        try (ExecutorService hilos = Executors.newFixedThreadPool(intentos)) {
            List<Future<Integer>> estados = new ArrayList<>();
            for (int i = 0; i < intentos; i++) {
                estados.add(hilos.submit(() -> {
                    salida.await();
                    return mvc.perform(login(vendedor.email(), PASSWORD, ipUnica())).andReturn().getResponse()
                            .getStatus();
                }));
            }
            salida.countDown();
            for (Future<Integer> estado : estados) {
                assertThat(estado.get(30, TimeUnit.SECONDS)).isEqualTo(200);
            }
        }
    }

    @Test
    void elAccessTokenDaAccesoAMe() throws Exception {
        Creado mecanico = usuarios.crear(Rol.MECANICO);
        MvcResult sesion = mvc.perform(login(mecanico.email(), PASSWORD, ipUnica())).andReturn();

        mvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken(sesion)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(mecanico.id()))
                .andExpect(jsonPath("$.permisos", hasItem("ORDENES_VER_ASIGNADAS")));
    }

    @Test
    void cp02ContrasenaErroneaUsuarioInactivoYCorreoInexistenteRespondenIgual() throws Exception {
        Creado activo = usuarios.crear(Rol.ALMACEN);
        Creado inactivo = usuarios.crear(Rol.ALMACEN, false, "es");

        String malaClave = cuerpoError(login(activo.email(), "Otra12345", ipUnica()));
        String inactivoOk = cuerpoError(login(inactivo.email(), PASSWORD, ipUnica()));
        String inexistente = cuerpoError(login("nadie@prueba.test", PASSWORD, ipUnica()));

        assertThat(malaClave).isEqualTo(inactivoOk).isEqualTo(inexistente);
        assertThat(json.readTree(malaClave).get("code").asString()).isEqualTo("CREDENCIALES_INVALIDAS");
        assertThat(json.readTree(malaClave).get("detail").asString()).isEqualTo("Credenciales inválidas");
        assertThat(auditorias("LOGIN_FALLIDO", activo.id())).isEqualTo(1);
        assertThat(auditorias("LOGIN_FALLIDO", inactivo.id())).isEqualTo(1);
    }

    @Test
    void cp03ElSextoIntentoEnUnMinutoDa429() throws Exception {
        Creado usuario = usuarios.crear(Rol.VENDEDOR);
        RequestPostProcessor ip = ipUnica();
        for (int i = 0; i < 5; i++) {
            mvc.perform(login(usuario.email(), "Mala12345", ip)).andExpect(status().isUnauthorized());
        }

        mvc.perform(login(usuario.email(), PASSWORD, ip))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(jsonPath("$.code").value("DEMASIADAS_SOLICITUDES"));
        mvc.perform(login(usuario.email(), PASSWORD, ipUnica())).andExpect(status().isOk());
    }

    @Test
    void laRotacionInvalidaElRefreshUsadoYEntregaUnoNuevo() throws Exception {
        Creado usuario = usuarios.crear(Rol.VENDEDOR);
        String primero = valorCookie(mvc.perform(login(usuario.email(), PASSWORD, ipUnica())).andReturn());

        MvcResult rotado = mvc.perform(refresh(primero)).andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.usuario.id").value(usuario.id()))
                .andReturn();
        String segundo = valorCookie(rotado);

        assertThat(segundo).isNotEqualTo(primero);
        mvc.perform(refresh(segundo)).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select count(*) from refresh_token where usuario_id = ? and "
                + "reemplazado_por is not null", Integer.class, usuario.id())).isEqualTo(2);
    }

    @Test
    void cp05ReutilizarUnRefreshRotadoRevocaTodaLaFamilia() throws Exception {
        Creado usuario = usuarios.crear(Rol.MECANICO);
        String original = valorCookie(mvc.perform(login(usuario.email(), PASSWORD, ipUnica())).andReturn());
        String rotado = valorCookie(mvc.perform(refresh(original)).andExpect(status().isOk()).andReturn());

        mvc.perform(refresh(original))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESION_INVALIDA"));
        mvc.perform(refresh(rotado)).andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("select count(*) from refresh_token where usuario_id = ? and revocado_en is null",
                Integer.class, usuario.id())).isZero();
        assertThat(auditorias("REFRESH_REUTILIZADO", usuario.id())).isPositive();
    }

    @Test
    void refreshSinCookieOConTokenDesconocidoDa401() throws Exception {
        mvc.perform(post("/api/v1/auth/refresh").with(ipUnica()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESION_INVALIDA"));
        mvc.perform(refresh("token-que-no-existe")).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevocaElRefreshYBorraLaCookie() throws Exception {
        Creado usuario = usuarios.crear(Rol.ALMACEN);
        String refresh = valorCookie(mvc.perform(login(usuario.email(), PASSWORD, ipUnica())).andReturn());

        MvcResult salida = mvc.perform(post("/api/v1/auth/logout").cookie(new Cookie(CookieRefresh.NOMBRE, refresh)))
                .andExpect(status().isNoContent()).andReturn();

        assertThat(salida.getResponse().getHeader(HttpHeaders.SET_COOKIE))
                .contains("hk_refresh=;", "Max-Age=0", "Path=/api/v1/auth");
        mvc.perform(refresh(refresh)).andExpect(status().isUnauthorized());
        assertThat(auditorias("LOGOUT", usuario.id())).isEqualTo(1);
        mvc.perform(post("/api/v1/auth/logout")).andExpect(status().isNoContent());
    }

    @Test
    void elUsuarioDesactivadoNoPuedeRenovarSuSesion() throws Exception {
        Creado usuario = usuarios.crear(Rol.VENDEDOR);
        String refresh = valorCookie(mvc.perform(login(usuario.email(), PASSWORD, ipUnica())).andReturn());
        String bearer = usuarios.bearer(usuario.id());
        jdbc.update("update usuario set activo = false where id = ?", usuario.id());

        mvc.perform(refresh(refresh)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESION_INVALIDA"));
    }

    @Test
    void sinTokenOConTokenAlteradoDa401() throws Exception {
        Creado usuario = usuarios.crear(Rol.ADMIN);
        String bearer = usuarios.bearer(usuario.id());

        mvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("NO_AUTENTICADO"));
        mvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, bearer + "x"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("NO_AUTENTICADO"));
    }

    @Test
    void cambiaElIdiomaDelUsuario() throws Exception {
        Creado usuario = usuarios.crear(Rol.MECANICO);

        mvc.perform(put("/api/v1/auth/me/preferencias").header(HttpHeaders.AUTHORIZATION, usuarios.bearer(usuario.id()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"idioma\":\"en\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.idioma").value("en"));
        mvc.perform(put("/api/v1/auth/me/preferencias").header(HttpHeaders.AUTHORIZATION, usuarios.bearer(usuario.id()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"idioma\":\"fr\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("IDIOMA_INVALIDO"));
    }

    @Test
    void cambiarContrasenaExigeLaActualYAplicaLaPolitica() throws Exception {
        Creado usuario = usuarios.crear(Rol.VENDEDOR);
        String bearer = usuarios.bearer(usuario.id());

        mvc.perform(cambiarPassword(bearer, "NoEsLaActual1", "NuevaClave99"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_ACTUAL_INCORRECTA"));
        mvc.perform(cambiarPassword(bearer, PASSWORD, "corta"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("PASSWORD_DEBIL"));
        mvc.perform(cambiarPassword(bearer, PASSWORD, "NuevaClave99")).andExpect(status().isNoContent());

        mvc.perform(login(usuario.email(), "NuevaClave99", ipUnica())).andExpect(status().isOk());
        assertThat(auditorias("PASSWORD_CAMBIADA", usuario.id())).isEqualTo(1);
    }

    @Test
    void elAdminInicialSeCreaObligadoACambiarLaContrasena() throws Exception {
        Map<String, Object> admin = jdbc.queryForMap(
                "select rol, debe_cambiar_password, password_hash from usuario where email = 'admin@hyskad.test'");

        assertThat(admin).containsEntry("rol", "ADMIN").containsEntry("debe_cambiar_password", true);
        assertThat((String) admin.get("password_hash")).startsWith("$2a$12$");
        mvc.perform(login("admin@hyskad.test", "AdminInicial2026", ipUnica()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.usuario.debeCambiarPassword").value(true));
    }

    @Test
    void lasRespuestasLlevanLasCabecerasDeSeguridad() throws Exception {
        mvc.perform(get("/api/v1/auth/me"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().exists("Cache-Control"));
    }

    @Test
    void cp13LaContrasenaSeGuardaConBcryptYNoViajaEnLasRespuestas() throws Exception {
        Creado admin = usuarios.crear(Rol.ADMIN);
        String cuerpo = """
                {"nombre":"Hash Prueba","email":"hash-%d@prueba.test","password":"Secreta2026","rol":"VENDEDOR"}
                """.formatted(System.nanoTime());

        String respuesta = mvc.perform(post("/api/v1/usuarios").header(HttpHeaders.AUTHORIZATION,
                usuarios.bearer(admin.id())).contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        Long id = json.readTree(respuesta).get("id").asLong();

        assertThat(respuesta).doesNotContain("Secreta2026", "passwordHash", "$2a$");
        String hash = jdbc.queryForObject("select password_hash from usuario where id = ?", String.class, id);
        assertThat(hash).startsWith("$2a$12$").doesNotContain("Secreta2026");
        assertThat(jdbc.queryForObject("select count(*) from auditoria where cast(detalle as char) like '%Secreta2026%'",
                Integer.class)).isZero();
    }

    private static RequestBuilder login(String email, String password,
            RequestPostProcessor ip) {
        return post("/api/v1/auth/login").with(ip).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
    }

    private static RequestBuilder refresh(String valor) {
        return post("/api/v1/auth/refresh").with(ipUnica()).cookie(new Cookie(CookieRefresh.NOMBRE, valor));
    }

    private static RequestBuilder cambiarPassword(String bearer, String actual,
            String nueva) {
        return post("/api/v1/auth/password/cambiar").header(HttpHeaders.AUTHORIZATION, bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"actual\":\"" + actual + "\",\"nueva\":\"" + nueva + "\"}");
    }

    private String cuerpoError(RequestBuilder peticion) throws Exception {
        String cuerpo = mvc.perform(peticion).andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();
        // requestId cambia en cada petición: se excluye de la comparación
        return cuerpo.replaceAll(",?\"requestId\":\"[^\"]*\"", "");
    }

    private int auditorias(String accion, Long entidadId) {
        return jdbc.queryForObject("select count(*) from auditoria where accion = ? and entidad_id = ?", Integer.class,
                accion, entidadId);
    }

    private String accessToken(MvcResult resultado) throws Exception {
        return json.readTree(resultado.getResponse().getContentAsString()).get("accessToken").asString();
    }

    private JsonNode claims(MvcResult resultado) throws Exception {
        String carga = accessToken(resultado).split("\\.")[1];
        return json.readTree(new String(Base64.getUrlDecoder().decode(carga)));
    }

    private static String valorCookie(MvcResult resultado) {
        List<String> cookies = resultado.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        Matcher m = VALOR_COOKIE.matcher(cookies.getFirst());
        assertThat(m.find()).isTrue();
        return m.group(1);
    }
}
