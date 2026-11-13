package com.hyskad.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.springframework.boot.test.context.TestComponent;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Lleva una orden de trabajo por su ciclo vía la API (recepción, diagnóstico, presupuesto,
 * reparación, finalización, pago y entrega) para las pruebas que necesitan órdenes en un estado.
 * Cada método recibe los bearer de quien actúa: el vendedor recibe, presupuesta y cobra; el
 * mecánico asignado diagnostica y repara.
 */
@TestComponent
public class FlujoOrdenes {

    public static final String BASE = "/api/v1/ordenes-trabajo";

    private final MockMvc mvc;
    private final ObjectMapper json;

    public FlujoOrdenes(MockMvc mvc, ObjectMapper json) {
        this.mvc = mvc;
        this.json = json;
    }

    /** Cliente nuevo (sin email, con autorización de datos) y su moto; devuelve sus ids. */
    public ClienteMoto clienteConMoto(String admin) throws Exception {
        return clienteConMoto(admin, null, true);
    }

    /** Cliente nuevo con el email y la autorización de datos indicados (RN-45), y su moto. */
    public ClienteMoto clienteConMoto(String admin, String email, boolean aceptaDatos) throws Exception {
        long cliente = idCreado(admin, "/api/v1/clientes", """
                {"tipoDocumento":"CC","numeroDocumento":"%s","nombres":"Ana","apellidos":"Pagos",
                 "telefono":"3001234567","email":%s,"aceptaTratamientoDatos":%s}""".formatted(Identificadores.cedula(),
                email == null ? "null" : "\"" + email + "\"", aceptaDatos));
        long moto = idCreado(admin, "/api/v1/motocicletas", """
                {"clienteId":%d,"placa":"%s","marca":"Suzuki","modelo":"GN 125"}"""
                .formatted(cliente, Identificadores.placa()));
        return new ClienteMoto(cliente, moto);
    }

    /** Orden recibida de la moto con el mecánico asignado. */
    public JsonNode recibida(ClienteMoto cm, int kilometraje, String vendedor, long mecanicoId) throws Exception {
        JsonNode orden = json.readTree(mvc.perform(con(post(BASE), vendedor).content("""
                {"clienteId":%d,"motocicletaId":%d,"kilometrajeIngreso":%d,"motivoIngreso":"Revisión general",
                 "descripcionProblema":"Ruido en el motor"}""".formatted(cm.clienteId(), cm.motocicletaId(),
                kilometraje))).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        return ok(mvc.perform(con(put(BASE + "/" + id(orden) + "/mecanicos"), vendedor).content("""
                {"version":%d,"mecanicos":[{"mecanicoId":%d}]}""".formatted(version(orden), mecanicoId))));
    }

    /** Orden finalizada (sin pago) con un servicio libre de {@code precio} (+ IVA vigente). */
    public JsonNode finalizada(ClienteMoto cm, int kilometraje, int precio, String vendedor, long mecanicoId,
            String mecanico) throws Exception {
        JsonNode orden = recibida(cm, kilometraje, vendedor, mecanicoId);
        orden = transicion(orden, "EN_DIAGNOSTICO", null, mecanico);
        orden = ok(mvc.perform(con(put(BASE + "/" + id(orden) + "/diagnostico"), mecanico).content("""
                {"version":%d,"diagnostico":"Cadena destensionada y bujía gastada"}""".formatted(version(orden)))));
        orden = ok(mvc.perform(con(post(BASE + "/" + id(orden) + "/servicios"), mecanico).content("""
                {"version":%d,"descripcion":"Mantenimiento general","precio":%d}""".formatted(version(orden), precio))));
        JsonNode presupuesto = json.readTree(mvc.perform(con(post(BASE + "/" + id(orden) + "/presupuestos"), vendedor)
                .content("{\"version\":%d,\"descuento\":0}".formatted(version(orden))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        mvc.perform(con(post("/api/v1/presupuestos/" + presupuesto.get("id").asLong() + "/decision"), vendedor)
                .content("{\"decision\":\"APROBADO\"}")).andExpect(status().isOk());
        return transicion(obtener(orden, vendedor), "FINALIZADA", null, mecanico);
    }

    public JsonNode transicion(JsonNode orden, String estado, String nota, String bearer) throws Exception {
        String cuerpo = nota == null ? "{\"version\":%d,\"estado\":\"%s\"}".formatted(version(orden), estado)
                : "{\"version\":%d,\"estado\":\"%s\",\"nota\":\"%s\"}".formatted(version(orden), estado, nota);
        return ok(mvc.perform(con(post(BASE + "/" + id(orden) + "/transiciones"), bearer).content(cuerpo)));
    }

    public ResultActions pagar(JsonNode orden, String cuerpo, String bearer) throws Exception {
        return mvc.perform(con(post(BASE + "/" + id(orden) + "/pago"), bearer).content(cuerpo));
    }

    /** Pago en efectivo por el total exacto. */
    public JsonNode pagarEnEfectivo(JsonNode orden, String bearer) throws Exception {
        return ok(pagar(orden, "{\"monto\":%s,\"metodo\":\"EFECTIVO\"}".formatted(orden.get("total").decimalValue()
                .toPlainString()), bearer));
    }

    public ResultActions entregar(JsonNode orden, String observaciones, String bearer) throws Exception {
        String cuerpo = observaciones == null ? "{}" : "{\"observaciones\":\"%s\"}".formatted(observaciones);
        return mvc.perform(con(post(BASE + "/" + id(orden) + "/entrega"), bearer).content(cuerpo));
    }

    /** Orden finalizada, pagada en efectivo y entregada. */
    public JsonNode entregada(ClienteMoto cm, int kilometraje, int precio, String vendedor, long mecanicoId,
            String mecanico) throws Exception {
        JsonNode orden = pagarEnEfectivo(finalizada(cm, kilometraje, precio, vendedor, mecanicoId, mecanico), vendedor);
        return ok(entregar(orden, null, vendedor));
    }

    public JsonNode obtener(JsonNode orden, String bearer) throws Exception {
        return ok(mvc.perform(con(get(BASE + "/" + id(orden)), bearer)));
    }

    public JsonNode ok(ResultActions resultado) throws Exception {
        return json.readTree(resultado.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    public static long id(JsonNode orden) {
        return orden.get("id").asLong();
    }

    public static long version(JsonNode orden) {
        return orden.get("version").asLong();
    }

    public static MockHttpServletRequestBuilder con(MockHttpServletRequestBuilder peticion, String bearer) {
        return peticion.header(HttpHeaders.AUTHORIZATION, bearer).contentType(MediaType.APPLICATION_JSON);
    }

    private long idCreado(String bearer, String ruta, String cuerpo) throws Exception {
        return json.readTree(mvc.perform(con(post(ruta), bearer).content(cuerpo)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    public record ClienteMoto(long clienteId, long motocicletaId) {
    }
}
