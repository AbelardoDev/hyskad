package com.hyskad.taller.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;

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

import com.hyskad.catalogo.domain.Producto;
import com.hyskad.inventario.application.InventarioService;
import com.hyskad.inventario.domain.Referencia;
import com.hyskad.support.CatalogoDePrueba;
import com.hyskad.support.Identificadores;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.taller.domain.EstadoPresupuesto;
import com.hyskad.taller.domain.OrdenFinalizada;
import com.hyskad.taller.domain.PresupuestoDecidido;
import com.hyskad.taller.domain.PresupuestoEnviado;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Ítems de la orden, reservas, totales y presupuestos con MySQL real (RN-28 a RN-34). */
@IntegrationTest
@RecordApplicationEvents
class ItemsPresupuestosIT {

    private static final String BASE = "/api/v1/ordenes-trabajo";
    private static final Referencia COMPRA = new Referencia(Referencia.TipoReferencia.COMPRA, 1L, "C-1");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private CatalogoDePrueba catalogo;

    @Autowired
    private InventarioService inventario;

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
    void cp40ElRepuestoReservaAlAgregarseSeSumaSiSeRepiteYSeLiberaAlQuitarse() throws Exception {
        Producto p = conStock("10");
        JsonNode orden = ordenEnDiagnostico();

        orden = repuesto(orden, p, "2", mecanicoBearer);
        assertThat(reservado(p)).isEqualByComparingTo("2");
        orden = repuesto(orden, p, "1", mecanicoBearer);
        assertThat(orden.get("repuestos")).hasSize(1);
        assertThat(orden.get("repuestos").get(0).get("cantidad").decimalValue()).isEqualByComparingTo("3");
        assertThat(reservado(p)).isEqualByComparingTo("3");

        long itemId = orden.get("repuestos").get(0).get("id").asLong();
        orden = ok(mvc.perform(con(delete(BASE + "/" + id(orden) + "/repuestos/" + itemId)
                .param("version", String.valueOf(version(orden))), mecanicoBearer)));
        assertThat(orden.get("repuestos")).isEmpty();
        assertThat(reservado(p)).isEqualByComparingTo("0");
        assertThat(jdbc.queryForList("select accion from auditoria where entidad = 'orden_trabajo' and entidad_id = ? "
                + "and accion like 'ORDEN_REPUESTO%' order by id", String.class, id(orden)))
                .containsExactly("ORDEN_REPUESTO_AGREGADO", "ORDEN_REPUESTO_AGREGADO", "ORDEN_REPUESTO_QUITADO");
    }

    @Test
    void cambiarLaCantidadAjustaLaReservaPorLaDiferencia() throws Exception {
        Producto p = conStock("10");
        JsonNode orden = repuesto(ordenEnDiagnostico(), p, "2", vendedor);
        long itemId = orden.get("repuestos").get(0).get("id").asLong();

        for (String cantidad : new String[] { "5", "1" }) {
            orden = ok(mvc.perform(con(put(BASE + "/" + id(orden) + "/repuestos/" + itemId), vendedor).content("""
                    {"version":%d,"cantidad":%s}""".formatted(version(orden), cantidad))));
            assertThat(reservado(p)).isEqualByComparingTo(cantidad);
            assertThat(catalogo.obtener(p.getId()).getStockActual()).isEqualByComparingTo("10");
        }
    }

    @Test
    void sinDisponibleNoSeAgregaNadaYUnProductoReservadoNoSeDesactiva() throws Exception {
        Producto p = conStock("3");
        JsonNode orden = ordenEnDiagnostico();
        mvc.perform(con(post(BASE + "/" + id(orden) + "/repuestos"), vendedor).content("""
                {"version":%d,"productoId":%d,"cantidad":4}""".formatted(version(orden), p.getId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STOCK_INSUFICIENTE"));
        orden = obtener(orden, vendedor);
        assertThat(orden.get("repuestos")).isEmpty();
        assertThat(orden.get("total").decimalValue()).isEqualByComparingTo("0");

        repuesto(orden, p, "1", vendedor);
        mvc.perform(con(patch("/api/v1/productos/" + p.getId() + "/estado"), admin).content("{\"activo\":false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESERVA_PENDIENTE"));
    }

    @Test
    void cp41LosItemsSoloCambianEnDiagnosticoYElMecanicoNoAsignadoNoLosToca() throws Exception {
        Producto p = conStock("5");
        JsonNode recibida = asignar(crearOrden(), mecanico.id());
        mvc.perform(con(post(BASE + "/" + id(recibida) + "/servicios"), vendedor).content("""
                {"version":%d,"descripcion":"Ajuste","precio":10000}""".formatted(version(recibida))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORDEN_ESTADO_INVALIDO"));

        JsonNode orden = enReparacion(conStock("5"));
        mvc.perform(con(post(BASE + "/" + id(orden) + "/repuestos"), mecanicoBearer).content("""
                {"version":%d,"productoId":%d,"cantidad":1}""".formatted(version(orden), p.getId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORDEN_ESTADO_INVALIDO"));

        String otro = usuarios.bearer(usuarios.crear(Rol.MECANICO).id());
        JsonNode diagnostico = ordenEnDiagnostico();
        mvc.perform(con(post(BASE + "/" + id(diagnostico) + "/servicios"), otro).content("""
                {"version":%d,"descripcion":"Ajuste","precio":10000}""".formatted(version(diagnostico))))
                .andExpect(status().isNotFound());
    }

    @Test
    void cp45TotalesConServiciosRepuestosDescuentoEIva() throws Exception {
        Producto p = conStock("10");
        long sincronizacion = servicioCatalogo("Sincronización IT", 80000);
        JsonNode orden = ordenEnDiagnostico();
        // Del catálogo con el precio editado, mano de obra libre y 2 repuestos de $25.000
        orden = ok(mvc.perform(con(post(BASE + "/" + id(orden) + "/servicios"), mecanicoBearer).content("""
                {"version":%d,"servicioId":%d,"precio":85000,"mecanicoId":%d}"""
                .formatted(version(orden), sincronizacion, mecanico.id()))));
        assertThat(orden.get("servicios").get(0).get("descripcion").asString()).startsWith("Sincronización IT");
        assertThat(orden.get("servicios").get(0).get("mecanico").get("nombre").asString()).isEqualTo("Prueba MECANICO");
        orden = servicioLibre(orden, "Soldadura del soporte", 25000);
        orden = repuesto(orden, p, "2", mecanicoBearer);
        // 85.000 + 25.000 + 50.000 = 160.000; IVA 19 % = 30.400
        assertThat(orden.get("subtotal").decimalValue()).isEqualByComparingTo("160000");
        assertThat(orden.get("impuesto").decimalValue()).isEqualByComparingTo("30400");
        assertThat(orden.get("total").decimalValue()).isEqualByComparingTo("190400");

        // Con descuento de 10.000: base 150.000 + IVA 28.500 = 178.500
        JsonNode presupuesto = generar(orden, 10000);
        assertThat(presupuesto.get("total").decimalValue()).isEqualByComparingTo("178500");
        orden = obtener(orden, vendedor);
        assertThat(orden.get("descuento").decimalValue()).isEqualByComparingTo("10000");
        assertThat(orden.get("total").decimalValue()).isEqualByComparingTo("178500");
    }

    @Test
    void elServicioLibreExigeDescripcionYPrecioYElMecanicoDebeEstarAsignado() throws Exception {
        JsonNode orden = ordenEnDiagnostico();
        mvc.perform(con(post(BASE + "/" + id(orden) + "/servicios"), vendedor).content("""
                {"version":%d,"descripcion":" ","mecanicoId":999999}""".formatted(version(orden))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].campo").value(contains("descripcion", "precio",
                        "mecanicoId")));
    }

    @Test
    void cp42UnNuevoPresupuestoReemplazaAlPendienteConVersionSiguiente() throws Exception {
        JsonNode orden = servicioLibre(ordenEnDiagnostico(), "Revisión", 50000);
        mvc.perform(con(post(BASE + "/" + id(orden) + "/transiciones"), vendedor).content("""
                {"version":%d,"estado":"PENDIENTE_APROBACION"}""".formatted(version(orden))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.motivo").value("PRESUPUESTO_REQUERIDO"));

        JsonNode primero = generar(orden, 0);
        assertThat(primero.get("numero").asString()).matches("P-\\d{6}");
        assertThat(primero.get("version").asInt()).isEqualTo(1);
        mvc.perform(con(post("/api/v1/presupuestos/" + primero.get("id").asLong() + "/retiro"), vendedor))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("REEMPLAZADO"));
        orden = obtener(orden, vendedor);
        assertThat(orden.get("estado").asString()).isEqualTo("EN_DIAGNOSTICO");

        orden = servicioLibre(orden, "Ajuste extra", 10000);
        JsonNode segundo = generar(orden, 5000);
        assertThat(segundo.get("version").asInt()).isEqualTo(2);
        mvc.perform(con(get(BASE + "/" + id(orden) + "/presupuestos"), vendedor))
                .andExpect(jsonPath("$[0].version").value(2))
                .andExpect(jsonPath("$[0].estado").value("PENDIENTE"))
                .andExpect(jsonPath("$[0].items.length()").value(2))
                .andExpect(jsonPath("$[1].estado").value("REEMPLAZADO"))
                .andExpect(jsonPath("$[1].items.length()").value(1));
        assertThat(eventos.stream(PresupuestoEnviado.class)).hasSize(2);
    }

    @Test
    void cp43ElPresupuestoAprobadoPasaLaOrdenAReparacionYSuTotalEsElDeLaOrden() throws Exception {
        Producto p = conStock("10");
        JsonNode orden = repuesto(servicioLibre(ordenEnDiagnostico(), "Frenos", 45000), p, "1.5", vendedor);
        JsonNode presupuesto = generar(orden, 3333.33);
        decidir(presupuesto, "APROBADO", "El cliente aprueba por teléfono")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("APROBADO"))
                .andExpect(jsonPath("$.observacionesDecision").value("El cliente aprueba por teléfono"));

        orden = obtener(orden, vendedor);
        assertThat(orden.get("estado").asString()).isEqualTo("EN_REPARACION");
        // RN-34: el total de la orden es el del presupuesto aprobado
        assertThat(orden.get("total").decimalValue()).isEqualByComparingTo(presupuesto.get("total").decimalValue());
        assertThat(orden.get("subtotal").decimalValue()).isEqualByComparingTo(presupuesto.get("subtotal").decimalValue());
        assertThat(eventos.stream(PresupuestoDecidido.class)).singleElement()
                .satisfies(e -> assertThat(e.decision()).isEqualTo(EstadoPresupuesto.APROBADO));
        decidir(presupuesto, "RECHAZADO", null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PRESUPUESTO_NO_PENDIENTE"));
    }

    @Test
    void cp44RechazarCancelaLaOrdenYLiberaTodasLasReservas() throws Exception {
        Producto a = conStock("5");
        Producto b = conStock("5");
        JsonNode orden = repuesto(repuesto(ordenEnDiagnostico(), a, "2", vendedor), b, "3", vendedor);
        decidir(generar(orden, 0), "RECHAZADO", "Muy caro").andExpect(status().isOk());

        orden = obtener(orden, vendedor);
        assertThat(orden.get("estado").asString()).isEqualTo("CANCELADA");
        assertThat(reservado(a)).isEqualByComparingTo("0");
        assertThat(reservado(b)).isEqualByComparingTo("0");
        assertThat(catalogo.obtener(a.getId()).getStockActual()).isEqualByComparingTo("5");
    }

    @Test
    void cancelarUnaOrdenConTresRepuestosLiberaTodasLasReservasYReemplazaElPresupuesto() throws Exception {
        Producto a = conStock("5");
        Producto b = conStock("5");
        Producto c = conStock("5");
        JsonNode orden = repuesto(repuesto(repuesto(ordenEnDiagnostico(), a, "1", vendedor), b, "2", vendedor), c,
                "3", vendedor);
        JsonNode presupuesto = generar(orden, 0);
        orden = obtener(orden, vendedor);

        mvc.perform(con(post(BASE + "/" + id(orden) + "/transiciones"), vendedor).content("""
                {"version":%d,"estado":"CANCELADA","nota":"El cliente se llevó la moto"}""".formatted(version(orden))))
                .andExpect(status().isOk());
        for (Producto p : new Producto[] { a, b, c }) {
            assertThat(reservado(p)).isEqualByComparingTo("0");
        }
        mvc.perform(con(get(BASE + "/" + id(orden) + "/presupuestos"), vendedor))
                .andExpect(jsonPath("$[0].id").value(presupuesto.get("id").asLong()))
                .andExpect(jsonPath("$[0].estado").value("REEMPLAZADO"));
    }

    @Test
    void cp46FinalizarDescuentaElStockReservadoYCongelaElCosto() throws Exception {
        Producto p = conStock("10");
        JsonNode orden = enReparacion(p);
        orden = ok(mvc.perform(con(post(BASE + "/" + id(orden) + "/transiciones"), mecanicoBearer).content("""
                {"version":%d,"estado":"FINALIZADA"}""".formatted(version(orden)))));

        assertThat(orden.get("estado").asString()).isEqualTo("FINALIZADA");
        assertThat(orden.get("fechaFinalizacion").isNull()).isFalse();
        Producto despues = catalogo.obtener(p.getId());
        assertThat(despues.getStockActual()).isEqualByComparingTo("8");
        assertThat(despues.getStockReservado()).isEqualByComparingTo("0");
        assertThat(jdbc.queryForObject("select count(*) from movimiento_inventario where producto_id = ? and tipo = "
                + "'SALIDA_ORDEN' and referencia_id = ?", Integer.class, p.getId(), id(orden))).isOne();
        assertThat(jdbc.queryForObject("select costo_unitario from orden_repuesto where orden_id = ?",
                BigDecimal.class, id(orden))).isEqualByComparingTo("15000");
        BigDecimal total = orden.get("total").decimalValue();
        assertThat(eventos.stream(OrdenFinalizada.class)).singleElement()
                .satisfies(e -> assertThat(e.total()).isEqualByComparingTo(total));
    }

    @Test
    void siUnRepuestoNoPuedeSalirAlFinalizarNoSaleNinguno() throws Exception {
        Producto a = conStock("10");
        Producto b = conStock("10");
        JsonNode orden = enReparacion(a);
        // Un segundo repuesto agregado antes de aprobar y luego vaciado a mano en la BD
        orden = ok(mvc.perform(con(post(BASE + "/" + id(orden) + "/transiciones"), mecanicoBearer).content("""
                {"version":%d,"estado":"EN_DIAGNOSTICO","nota":"Apareció otro daño"}""".formatted(version(orden)))));
        orden = repuesto(orden, b, "1", mecanicoBearer);
        decidir(generar(orden, 0), "APROBADO", null).andExpect(status().isOk());
        orden = obtener(orden, vendedor);
        jdbc.update("update producto set stock_actual = 0, stock_reservado = 0 where id = ?", b.getId());

        mvc.perform(con(post(BASE + "/" + id(orden) + "/transiciones"), mecanicoBearer).content("""
                {"version":%d,"estado":"FINALIZADA"}""".formatted(version(orden))))
                .andExpect(status().isConflict());
        assertThat(obtener(orden, vendedor).get("estado").asString()).isEqualTo("EN_REPARACION");
        assertThat(catalogo.obtener(a.getId()).getStockActual()).isEqualByComparingTo("10");
        assertThat(reservado(a)).isEqualByComparingTo("2");
    }

    @Test
    void requiereAjusteVuelveADiagnosticoConLasReservasYSinDescuento() throws Exception {
        Producto p = conStock("10");
        JsonNode orden = enReparacion(p);
        mvc.perform(con(post(BASE + "/" + id(orden) + "/transiciones"), mecanicoBearer).content("""
                {"version":%d,"estado":"EN_DIAGNOSTICO"}""".formatted(version(orden))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("NOTA_REQUERIDA"));
        orden = ok(mvc.perform(con(post(BASE + "/" + id(orden) + "/transiciones"), mecanicoBearer).content("""
                {"version":%d,"estado":"EN_DIAGNOSTICO","nota":"Apareció fuga de aceite"}""".formatted(version(orden)))));

        assertThat(orden.get("descuento").decimalValue()).isEqualByComparingTo("0");
        assertThat(reservado(p)).isEqualByComparingTo("2");
        assertThat(orden.get("accionesPermitidas").get("editarItems").asBoolean()).isTrue();
        JsonNode segundo = generar(orden, 0);
        assertThat(segundo.get("version").asInt()).isEqualTo(2);
    }

    @Test
    void elMecanicoAgregaItemsPeroNoGestionaPresupuestosYVeElDocumento() throws Exception {
        JsonNode orden = servicioLibre(ordenEnDiagnostico(), "Revisión", 20000);
        mvc.perform(con(post(BASE + "/" + id(orden) + "/presupuestos"), mecanicoBearer).content("""
                {"version":%d,"descuento":0}""".formatted(version(orden))))
                .andExpect(status().isForbidden());
        JsonNode presupuesto = generar(orden, 0);

        mvc.perform(con(get("/api/v1/presupuestos/" + presupuesto.get("id").asLong()), mecanicoBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.presupuesto.numero").value(matchesPattern("P-\\d{6}")))
                .andExpect(jsonPath("$.moto.placa").isString())
                .andExpect(jsonPath("$.taller.nombre").isString())
                .andExpect(jsonPath("$.leyenda").value("Documento interno. No es factura electrónica."));
        String otro = usuarios.bearer(usuarios.crear(Rol.MECANICO).id());
        mvc.perform(con(get("/api/v1/presupuestos/" + presupuesto.get("id").asLong()), otro))
                .andExpect(status().isNotFound());
        mvc.perform(con(post(BASE + "/" + id(orden) + "/presupuestos"), vendedor).content("""
                {"version":%d,"descuento":999999}""".formatted(version(obtener(orden, vendedor)))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TRANSICION_INVALIDA"));
    }

    @Test
    void elDescuentoNoSuperaElSubtotal() throws Exception {
        JsonNode orden = servicioLibre(ordenEnDiagnostico(), "Revisión", 20000);
        mvc.perform(con(post(BASE + "/" + id(orden) + "/presupuestos"), vendedor).content("""
                {"version":%d,"descuento":20000.01}""".formatted(version(orden))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("DESCUENTO_INVALIDO"));
    }

    // ---- apoyo ----

    /** Producto a $25.000 con existencias al costo de $15.000. */
    private Producto conStock(String cantidad) {
        Producto p = catalogo.producto("0");
        inventario.registrarEntradaCompra(p.getId(), new BigDecimal(cantidad), new BigDecimal("15000"), COMPRA);
        return p;
    }

    private BigDecimal reservado(Producto p) {
        return catalogo.obtener(p.getId()).getStockReservado();
    }

    private long servicioCatalogo(String nombre, int precio) throws Exception {
        return idCreado("/api/v1/servicios", """
                {"nombre":"%s %s","precioBase":%d,"tiempoEstimadoMin":60}"""
                .formatted(nombre, CatalogoDePrueba.unico(), precio));
    }

    private JsonNode crearOrden() throws Exception {
        long cliente = idCreado("/api/v1/clientes", """
                {"tipoDocumento":"CC","numeroDocumento":"%s","nombres":"Ana","apellidos":"Ítems",
                 "telefono":"3001234567","aceptaTratamientoDatos":true}""".formatted(Identificadores.cedula()));
        long moto = idCreado("/api/v1/motocicletas", """
                {"clienteId":%d,"placa":"%s","marca":"Suzuki","modelo":"GN 125"}"""
                .formatted(cliente, Identificadores.placa()));
        return json.readTree(mvc.perform(con(post(BASE), vendedor).content("""
                {"clienteId":%d,"motocicletaId":%d,"kilometrajeIngreso":100,"motivoIngreso":"Revisión",
                 "descripcionProblema":"Frena mal"}""".formatted(cliente, moto)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    /** Orden con el mecánico asignado, en diagnóstico y con el diagnóstico registrado. */
    private JsonNode ordenEnDiagnostico() throws Exception {
        JsonNode orden = asignar(crearOrden(), mecanico.id());
        orden = ok(mvc.perform(con(post(BASE + "/" + id(orden) + "/transiciones"), mecanicoBearer).content("""
                {"version":%d,"estado":"EN_DIAGNOSTICO"}""".formatted(version(orden)))));
        return ok(mvc.perform(con(put(BASE + "/" + id(orden) + "/diagnostico"), mecanicoBearer).content("""
                {"version":%d,"diagnostico":"Pastillas gastadas"}""".formatted(version(orden)))));
    }

    /** Orden aprobada (en reparación) con 2 unidades de {@code p} y un servicio de $40.000. */
    private JsonNode enReparacion(Producto p) throws Exception {
        JsonNode orden = repuesto(servicioLibre(ordenEnDiagnostico(), "Cambio de pastillas", 40000), p, "2",
                mecanicoBearer);
        decidir(generar(orden, 0), "APROBADO", null).andExpect(status().isOk());
        return obtener(orden, vendedor);
    }

    private JsonNode asignar(JsonNode orden, long mecanicoId) throws Exception {
        return ok(mvc.perform(con(put(BASE + "/" + id(orden) + "/mecanicos"), vendedor).content("""
                {"version":%d,"mecanicos":[{"mecanicoId":%d}]}""".formatted(version(orden), mecanicoId))));
    }

    private JsonNode repuesto(JsonNode orden, Producto p, String cantidad, String bearer) throws Exception {
        return ok(mvc.perform(con(post(BASE + "/" + id(orden) + "/repuestos"), bearer).content("""
                {"version":%d,"productoId":%d,"cantidad":%s}""".formatted(version(orden), p.getId(), cantidad))));
    }

    private JsonNode servicioLibre(JsonNode orden, String descripcion, int precio) throws Exception {
        return ok(mvc.perform(con(post(BASE + "/" + id(orden) + "/servicios"), vendedor).content("""
                {"version":%d,"descripcion":"%s","precio":%d}""".formatted(version(orden), descripcion, precio))));
    }

    private JsonNode generar(JsonNode orden, double descuento) throws Exception {
        JsonNode actual = obtener(orden, vendedor);
        return json.readTree(mvc.perform(con(post(BASE + "/" + id(orden) + "/presupuestos"), vendedor).content("""
                {"version":%d,"descuento":%s,"observaciones":"Válido por 8 días"}"""
                .formatted(version(actual), BigDecimal.valueOf(descuento).toPlainString())))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    private ResultActions decidir(JsonNode presupuesto, String decision, String observaciones) throws Exception {
        String cuerpo = observaciones == null ? "{\"decision\":\"%s\"}".formatted(decision)
                : "{\"decision\":\"%s\",\"observaciones\":\"%s\"}".formatted(decision, observaciones);
        return mvc.perform(con(post("/api/v1/presupuestos/" + presupuesto.get("id").asLong() + "/decision"), vendedor)
                .content(cuerpo));
    }

    private JsonNode obtener(JsonNode orden, String bearer) throws Exception {
        return ok(mvc.perform(con(get(BASE + "/" + id(orden)), bearer)));
    }

    private long idCreado(String ruta, String cuerpo) throws Exception {
        return json.readTree(mvc.perform(con(post(ruta), admin).content(cuerpo)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
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
