package com.hyskad.reportes.web;

import static com.hyskad.support.FlujoOrdenes.con;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.hyskad.catalogo.domain.Producto;
import com.hyskad.inventario.application.InventarioService;
import com.hyskad.inventario.domain.Referencia;
import com.hyskad.support.CatalogoDePrueba;
import com.hyskad.support.FlujoOrdenes;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;
import com.hyskad.ventas.application.EstadisticasVentas;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Reportes de servicios, inventario y ventas con MySQL real (RF32, RF33, RN-53). */
@IntegrationTest
class ReportesIT {

    private static final String BASE = "/api/v1/reportes";
    private static final Referencia COMPRA = new Referencia(Referencia.TipoReferencia.COMPRA, 1L, "C-1");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private FlujoOrdenes flujo;

    @Autowired
    private CatalogoDePrueba catalogo;

    @Autowired
    private InventarioService inventario;

    @Autowired
    private EstadisticasVentas estadisticasVentas;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper json;

    private String admin;
    private String vendedor;
    private String hoy;

    @BeforeEach
    void iniciar() {
        admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        vendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
        hoy = LocalDate.now(ZoneId.of("America/Bogota")).toString();
    }

    @Test
    void cp56ServiciosPorRangoYMecanicoConTotalesCorrectos() throws Exception {
        long mecanicoA = usuarios.crear(Rol.MECANICO).id();
        long mecanicoB = usuarios.crear(Rol.MECANICO).id();
        String bearerA = usuarios.bearer(mecanicoA);
        String bearerB = usuarios.bearer(mecanicoB);
        flujo.finalizada(flujo.clienteConMoto(admin), 100, 100000, vendedor, mecanicoA, bearerA);
        flujo.entregada(flujo.clienteConMoto(admin), 100, 50000, vendedor, mecanicoA, bearerA);
        flujo.finalizada(flujo.clienteConMoto(admin), 100, 70000, vendedor, mecanicoB, bearerB);

        JsonNode r = flujo.ok(mvc.perform(con(get(BASE + "/servicios"), vendedor).param("desde", hoy)
                .param("hasta", hoy).param("mecanicoId", String.valueOf(mecanicoA))));
        assertThat(r.get("ordenes").asLong()).isEqualTo(2);
        assertThat(r.get("servicios").asLong()).isEqualTo(2);
        assertThat(r.get("ingresosManoObra").decimalValue()).isEqualByComparingTo("150000");
        assertThat(r.get("ingresosRepuestos").decimalValue()).isEqualByComparingTo("0");
        assertThat(r.get("detalle")).hasSize(2);
        assertThat(r.get("detalle").get(0).get("mecanicos").asString()).isEqualTo("Prueba MECANICO");
        assertThat(r.get("detalle").get(0).get("total").decimalValue()).isEqualByComparingTo("59500");
        assertThat(r.get("porServicio").get(0).get("nombre").asString()).isEqualTo("Mantenimiento general");
        assertThat(r.get("porServicio").get(0).get("cantidad").asLong()).isEqualTo(2);

        String ayer = LocalDate.parse(hoy).minusDays(1).toString();
        JsonNode antes = flujo.ok(mvc.perform(con(get(BASE + "/servicios"), vendedor).param("desde", ayer)
                .param("hasta", ayer).param("mecanicoId", String.valueOf(mecanicoA))));
        assertThat(antes.get("ordenes").asLong()).isZero();
        mvc.perform(con(get(BASE + "/servicios"), vendedor).param("desde", hoy).param("hasta", ayer))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cp57InventarioConStockBajoYAgotadosExportableACsv() throws Exception {
        Producto bajo = catalogo.producto("5");
        inventario.registrarEntradaCompra(bajo.getId(), new BigDecimal("3"), new BigDecimal("10000"), COMPRA);
        Producto agotado = catalogo.producto("2");
        Long categoria = catalogo.obtener(bajo.getId()).getCategoria().getId();

        JsonNode r = flujo.ok(mvc.perform(con(get(BASE + "/inventario"), admin)
                .param("categoriaId", String.valueOf(categoria))));
        assertThat(r.get("productos").asLong()).isOne();
        assertThat(r.get("conStockBajo").asLong()).isOne();
        assertThat(r.get("valorInventario").decimalValue()).isEqualByComparingTo("30000");
        assertThat(r.get("detalle").get(0).get("nivel").asString()).isEqualTo("BAJO");
        JsonNode otra = flujo.ok(mvc.perform(con(get(BASE + "/inventario"), admin).param("categoriaId",
                String.valueOf(catalogo.obtener(agotado.getId()).getCategoria().getId()))));
        assertThat(otra.get("agotados").asLong()).isOne();
        assertThat(otra.get("detalle").get(0).get("nivel").asString()).isEqualTo("AGOTADO");
        assertThat(r.get("movimientos").findValues("tipo")).extracting(JsonNode::asString).contains("ENTRADA_COMPRA");

        jdbc.update("update producto set nombre = ? where id = ?", "Pastillas de freno \"cerámicas\"", bajo.getId());
        MvcResult csv = mvc.perform(con(get(BASE + "/inventario"), admin).param("categoriaId",
                String.valueOf(categoria)).param("formato", "csv")).andExpect(status().isOk()).andReturn();
        assertThat(csv.getResponse().getContentType()).startsWith("text/csv");
        assertThat(csv.getResponse().getHeader("Content-Disposition")).contains("reporte-inventario-");
        byte[] bytes = csv.getResponse().getContentAsByteArray();
        assertThat(bytes).startsWith(0xEF, 0xBB, 0xBF);
        String[] lineas = new String(bytes, StandardCharsets.UTF_8).substring(1).split("\r\n");
        assertThat(lineas[0]).isEqualTo("codigo;producto;categoria;unidad;existencias;disponible;minimo;"
                + "costo_promedio;valor;nivel");
        assertThat(lineas[1]).contains(";\"Pastillas de freno \"\"cerámicas\"\"\";").endsWith(";3;3;5;10000;30000;BAJO");
    }

    @Test
    void ventasConUtilidadBrutaYAgrupacionPorDiaEnBogota() throws Exception {
        UsuariosDePrueba.Creado cajero = usuarios.crear(Rol.ADMIN);
        String bearer = usuarios.bearer(cajero.id());
        Producto p = catalogo.producto("0");
        inventario.registrarEntradaCompra(p.getId(), new BigDecimal("10"), new BigDecimal("15000"), COMPRA);
        long venta = vender(bearer, p, "2", 5000);
        // 23:30 del 9 de marzo en Bogotá = 04:30 UTC del 10 de marzo
        jdbc.update("update venta set fecha = '2026-03-10 04:30:00' where id = ?", venta);

        JsonNode r = flujo.ok(mvc.perform(con(get(BASE + "/ventas"), bearer).param("desde", "2026-03-09")
                .param("hasta", "2026-03-09").param("vendedorId", String.valueOf(cajero.id()))));
        // 2 × 25.000 = 50.000 − 5.000 de descuento − 30.000 de costo = 15.000
        assertThat(r.get("ventas").asLong()).isOne();
        assertThat(r.get("costo").decimalValue()).isEqualByComparingTo("30000");
        assertThat(r.get("utilidadBruta").decimalValue()).isEqualByComparingTo("15000");
        assertThat(r.get("margenPorcentaje").decimalValue()).isEqualByComparingTo("33.3");
        assertThat(r.get("porDia").get(0).get("clave").asString()).isEqualTo("2026-03-09");
        JsonNode siguiente = flujo.ok(mvc.perform(con(get(BASE + "/ventas"), bearer).param("desde", "2026-03-10")
                .param("hasta", "2026-03-10").param("vendedorId", String.valueOf(cajero.id()))));
        assertThat(siguiente.get("ventas").asLong()).isZero();

        // La serie diaria del dashboard (SQL con CONVERT_TZ) la cuenta el 9, no el 10
        var porDia = estadisticasVentas.totalPorDia(LocalDate.parse("2026-03-09"), LocalDate.parse("2026-03-10"));
        assertThat(porDia.get(LocalDate.parse("2026-03-09"))).isEqualByComparingTo("53550");
        assertThat(porDia).doesNotContainKey(LocalDate.parse("2026-03-10"));

        String csv = mvc.perform(con(get(BASE + "/ventas"), bearer).param("desde", "2026-03-09")
                .param("hasta", "2026-03-09").param("vendedorId", String.valueOf(cajero.id())).param("formato", "csv"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).contains("2026-03-09 23:30").contains(";53550;30000;15000").doesNotContain("53.550");
    }

    @Test
    void cadaReporteExigeSuPermiso() throws Exception {
        String almacen = usuarios.bearer(usuarios.crear(Rol.ALMACEN).id());
        String mecanico = usuarios.bearer(usuarios.crear(Rol.MECANICO).id());

        mvc.perform(con(get(BASE + "/inventario"), vendedor)).andExpect(status().isForbidden());
        mvc.perform(con(get(BASE + "/ventas"), vendedor)).andExpect(status().isForbidden());
        mvc.perform(con(get(BASE + "/servicios"), vendedor)).andExpect(status().isOk());
        mvc.perform(con(get(BASE + "/cuentas-pendientes"), vendedor)).andExpect(status().isOk());

        mvc.perform(con(get(BASE + "/inventario"), almacen)).andExpect(status().isOk());
        mvc.perform(con(get(BASE + "/servicios"), almacen)).andExpect(status().isForbidden());
        mvc.perform(con(get(BASE + "/cuentas-pendientes"), almacen)).andExpect(status().isForbidden());

        for (String ruta : new String[] { "/servicios", "/inventario", "/ventas", "/cuentas-pendientes" }) {
            mvc.perform(con(get(BASE + ruta), mecanico)).andExpect(status().isForbidden());
        }
        mvc.perform(con(get(BASE + "/ventas"), admin)).andExpect(status().isOk());
    }

    private long vender(String bearer, Producto p, String cantidad, int descuento) throws Exception {
        return json.readTree(mvc.perform(con(post("/api/v1/ventas"), bearer).content("""
                {"items":[{"productoId":%d,"cantidad":%s}],"descuento":%d,"metodoPago":"EFECTIVO"}"""
                .formatted(p.getId(), cantidad, descuento))).andExpect(status().isCreated()).andReturn().getResponse()
                .getContentAsString()).get("id").asLong();
    }
}
