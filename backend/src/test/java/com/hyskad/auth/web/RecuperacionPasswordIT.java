package com.hyskad.auth.web;

import static com.hyskad.support.UsuariosDePrueba.PASSWORD;
import static com.hyskad.support.UsuariosDePrueba.ipUnica;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.support.UsuariosDePrueba.Creado;
import com.hyskad.usuarios.domain.Rol;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.GreenMailUtil;
import com.icegreen.greenmail.util.ServerSetupTest;

import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.Cookie;

/** RF35 / RN-50 con un servidor SMTP real en memoria (GreenMail, puerto 3025 del perfil test). */
@IntegrationTest
class RecuperacionPasswordIT {

    @RegisterExtension
    static final GreenMailExtension SMTP = new GreenMailExtension(ServerSetupTest.SMTP).withPerMethodLifecycle(true);

    private static final Pattern ENLACE = Pattern.compile("http://localhost:4200/restablecer\\?token=([A-Za-z0-9_-]{43})");
    private static final long ESPERA_MS = 10_000;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void cp11LaRespuestaEsIgualExistaONoElCorreoYSoloElExistenteRecibeElEnlace() throws Exception {
        Creado usuario = usuarios.crear(Rol.VENDEDOR);

        String existente = olvide(usuario.email().toUpperCase()).andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();
        String inexistente = olvide("no-existe@prueba.test").andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();

        assertThat(existente).isEqualTo(inexistente).isEmpty();
        assertThat(SMTP.waitForIncomingEmail(ESPERA_MS, 1)).isTrue();
        Thread.sleep(500);
        MimeMessage[] recibidos = SMTP.getReceivedMessages();
        assertThat(recibidos).hasSize(1);
        assertThat(recibidos[0].getAllRecipients()[0].toString()).isEqualTo(usuario.email());
        assertThat(recibidos[0].getFrom()[0].toString()).isEqualTo("no-reply@hyskad.test");
        assertThat(recibidos[0].getSubject()).isEqualTo("HYSKAD: restablece tu contraseña");
        String cuerpo = GreenMailUtil.getBody(recibidos[0]);
        assertThat(cuerpo).contains("30 minutos");
        assertThat(token(recibidos[0])).isNotBlank();
    }

    @Test
    void elCorreoSaleEnElIdiomaDelUsuario() throws Exception {
        Creado usuario = usuarios.crear(Rol.MECANICO, true, "en");

        olvide(usuario.email()).andExpect(status().isAccepted());

        assertThat(SMTP.waitForIncomingEmail(ESPERA_MS, 1)).isTrue();
        MimeMessage correo = SMTP.getReceivedMessages()[0];
        assertThat(correo.getSubject()).isEqualTo("HYSKAD: reset your password");
        assertThat(GreenMailUtil.getBody(correo)).contains("expires in 30 minutes");
    }

    @Test
    void restablecerCambiaLaContrasenaCierraLasSesionesYElEnlaceEsDeUnSoloUso() throws Exception {
        Creado usuario = usuarios.crear(Rol.ALMACEN);
        String refresh = refreshDe(usuario);
        String token = solicitarYLeerToken(usuario);

        mvc.perform(restablecer(token, "Restablecida2026")).andExpect(status().isNoContent());

        mvc.perform(login(usuario.email(), PASSWORD)).andExpect(status().isUnauthorized());
        mvc.perform(login(usuario.email(), "Restablecida2026")).andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/refresh").with(ipUnica()).cookie(new Cookie(CookieRefresh.NOMBRE, refresh)))
                .andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("select count(*) from auditoria where accion = 'PASSWORD_RESTABLECIDA' "
                + "and entidad_id = ?", Integer.class, usuario.id())).isEqualTo(1);

        // CP-12: enlace ya usado
        mvc.perform(restablecer(token, "OtraVez2026"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TOKEN_INVALIDO"));
    }

    @Test
    void cp12EnlaceVencidoDa400() throws Exception {
        Creado usuario = usuarios.crear(Rol.VENDEDOR);
        String token = solicitarYLeerToken(usuario);
        jdbc.update("update token_recuperacion set expira_en = utc_timestamp(6) - interval 1 minute "
                + "where usuario_id = ?", usuario.id());

        mvc.perform(restablecer(token, "Restablecida2026"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TOKEN_INVALIDO"));
        mvc.perform(restablecer("token-inventado", "Restablecida2026"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TOKEN_INVALIDO"));
    }

    @Test
    void pedirUnEnlaceNuevoInvalidaElAnterior() throws Exception {
        Creado usuario = usuarios.crear(Rol.VENDEDOR);
        String primero = solicitarYLeerToken(usuario);
        SMTP.reset();
        String segundo = solicitarYLeerToken(usuario);

        mvc.perform(restablecer(primero, "Restablecida2026")).andExpect(status().isBadRequest());
        mvc.perform(restablecer(segundo, "Restablecida2026")).andExpect(status().isNoContent());
    }

    @Test
    void laNuevaContrasenaDebeCumplirLaPolitica() throws Exception {
        mvc.perform(restablecer("cualquiera", "debil"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("PASSWORD_DEBIL"));
    }

    @Test
    void elCuartoPedidoEnQuinceMinutosDa429() throws Exception {
        var ip = ipUnica();
        for (int i = 0; i < 3; i++) {
            mvc.perform(peticionOlvide("limite@prueba.test").with(ip)).andExpect(status().isAccepted());
        }
        mvc.perform(peticionOlvide("limite@prueba.test").with(ip))
                .andExpect(status().isTooManyRequests())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    private String solicitarYLeerToken(Creado usuario) throws Exception {
        olvide(usuario.email()).andExpect(status().isAccepted());
        assertThat(SMTP.waitForIncomingEmail(ESPERA_MS, 1)).isTrue();
        return token(SMTP.getReceivedMessages()[0]);
    }

    private static String token(MimeMessage correo) {
        Matcher m = ENLACE.matcher(GreenMailUtil.getBody(correo).replace("=\r\n", "").replace("=3D", "="));
        assertThat(m.find()).as("el correo trae el enlace de restablecimiento").isTrue();
        return m.group(1);
    }

    private ResultActions olvide(String email) throws Exception {
        return mvc.perform(peticionOlvide(email).with(ipUnica()));
    }

    private static MockHttpServletRequestBuilder peticionOlvide(
            String email) {
        return post("/api/v1/auth/password/olvide").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\"}");
    }

    private static RequestBuilder restablecer(String token, String nueva) {
        return post("/api/v1/auth/password/restablecer").with(ipUnica()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\",\"nueva\":\"" + nueva + "\"}");
    }

    private static RequestBuilder login(String email, String password) {
        return post("/api/v1/auth/login").with(ipUnica()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
    }

    private String refreshDe(Creado usuario) throws Exception {
        String cookie = mvc.perform(login(usuario.email(), PASSWORD)).andExpect(status().isOk())
                .andReturn().getResponse().getHeader(HttpHeaders.SET_COOKIE);
        return cookie.substring("hk_refresh=".length(), cookie.indexOf(';'));
    }
}
