package com.hyskad.shared.error;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.hyskad.support.IntegrationTest;

@IntegrationTest
class GlobalExceptionHandlerIT {

    private static final String BASE = "/api/v1/pruebas-errores";
    private static final String VALIDO = """
            {"nombre":"Ana","placa":"abc-12d","tipoDocumento":"NIT","numeroDocumento":"900.123.456-8"}""";

    @Autowired
    private MockMvc mvc;

    private ResultActions postJson(String cuerpo) throws Exception {
        return mvc.perform(post(BASE).contentType(MediaType.APPLICATION_JSON).content(cuerpo));
    }

    private static void esProblema(ResultActions resultado, int status, String code) throws Exception {
        resultado.andExpect(status().is(status))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(status))
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.type").value("urn:hyskad:error:" + code))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

    @Nested
    @WithMockUser
    class ConUsuario {

        @Test
        void solicitudValidaPasa() throws Exception {
            postJson(VALIDO).andExpect(status().isOk());
        }

        @Test
        void validacionDeCuerpoDevuelveErroresPorCampo() throws Exception {
            ResultActions r = postJson("""
                    {"nombre":" ","placa":"AB123","tipoDocumento":"NIT","numeroDocumento":"900123456-7"}""");
            esProblema(r, 400, "VALIDACION");
            r.andExpect(jsonPath("$.errors[*].campo")
                            .value(containsInAnyOrder("nombre", "placa", "numeroDocumento")))
                    .andExpect(jsonPath("$.errors[?(@.campo == 'nombre')].code").value(hasItem("NOT_BLANK")))
                    .andExpect(jsonPath("$.errors[?(@.campo == 'placa')].code").value(hasItem("PLACA_INVALIDA")))
                    .andExpect(jsonPath("$.errors[?(@.campo == 'numeroDocumento')].code")
                            .value(hasItem("NIT_INVALIDO")));
        }

        @Test
        void validacionDeParametro() throws Exception {
            ResultActions r = mvc.perform(get(BASE + "/parametro").param("cantidad", "50"));
            esProblema(r, 400, "VALIDACION");
            r.andExpect(jsonPath("$.errors[0].campo").value("cantidad"))
                    .andExpect(jsonPath("$.errors[0].code").value("MAX"));
        }

        @Test
        void tipoDeParametroInvalido() throws Exception {
            ResultActions r = mvc.perform(get(BASE + "/parametro").param("cantidad", "abc"));
            esProblema(r, 400, "PARAMETRO_INVALIDO");
            r.andExpect(jsonPath("$.errors[0].campo").value("cantidad"));
        }

        @Test
        void parametroFaltante() throws Exception {
            esProblema(mvc.perform(get(BASE + "/parametro")), 400, "PARAMETRO_REQUERIDO");
        }

        @Test
        void jsonMalFormado() throws Exception {
            esProblema(postJson("{\"nombre\": "), 400, "SOLICITUD_MALFORMADA");
        }

        @Test
        void propiedadDesconocidaSeRechaza() throws Exception {
            ResultActions r = postJson("""
                    {"nombre":"Ana","placa":"ABC12D","tipoDocumento":"CC","numeroDocumento":"1234567","extra":1}""");
            esProblema(r, 400, "SOLICITUD_MALFORMADA");
            r.andExpect(jsonPath("$.errors[0].campo").value("extra"))
                    .andExpect(jsonPath("$.errors[0].code").value("PROPIEDAD_DESCONOCIDA"));
        }

        @Test
        void tipoDeContenidoNoSoportado() throws Exception {
            esProblema(mvc.perform(post(BASE).contentType(MediaType.TEXT_PLAIN).content("hola")), 415,
                    "TIPO_CONTENIDO_NO_SOPORTADO");
        }

        @Test
        void recursoNoEncontrado() throws Exception {
            ResultActions r = mvc.perform(get(BASE + "/no-encontrado"));
            esProblema(r, 404, "RECURSO_NO_ENCONTRADO");
            r.andExpect(jsonPath("$.recurso").value("producto"));
        }

        @Test
        void rutaInexistente() throws Exception {
            esProblema(mvc.perform(get("/api/v1/no-existe")), 404, "RUTA_NO_ENCONTRADA");
        }

        @Test
        void metodoNoPermitido() throws Exception {
            ResultActions r = mvc.perform(delete(BASE));
            esProblema(r, 405, "METODO_NO_PERMITIDO");
            r.andExpect(header().exists("Allow"));
        }

        @Test
        void accesoDenegado() throws Exception {
            esProblema(mvc.perform(get(BASE + "/acceso-denegado")), 403, "ACCESO_DENEGADO");
        }

        @Test
        void conflictoDeConcurrencia() throws Exception {
            esProblema(mvc.perform(get(BASE + "/concurrencia")), 409, "CONFLICTO_CONCURRENCIA");
        }

        @Test
        void violacionDeIntegridadNoFiltraDetalles() throws Exception {
            ResultActions r = mvc.perform(get(BASE + "/integridad"));
            esProblema(r, 409, "CONFLICTO_DATOS");
            r.andExpect(content().string(not(containsString("secreto"))));
        }

        @Test
        void errorInesperadoNoFiltraDetalles() throws Exception {
            ResultActions r = mvc.perform(get(BASE + "/inesperado"));
            esProblema(r, 500, "ERROR_INTERNO");
            r.andExpect(content().string(not(containsString("detalle interno"))));
        }

        @Test
        void reutilizaElRequestIdRecibido() throws Exception {
            mvc.perform(get(BASE + "/no-encontrado").header("X-Request-Id", "abc-123"))
                    .andExpect(header().string("X-Request-Id", "abc-123"))
                    .andExpect(jsonPath("$.requestId").value("abc-123"));
        }

        @Test
        void ignoraUnRequestIdInseguro() throws Exception {
            mvc.perform(get(BASE + "/no-encontrado").header("X-Request-Id", "<script>"))
                    .andExpect(header().string("X-Request-Id", not("<script>")));
        }
    }

    @Test
    void sinAutenticacionDevuelve401() throws Exception {
        esProblema(mvc.perform(get(BASE + "/no-encontrado")), 401, "NO_AUTENTICADO");
    }
}
