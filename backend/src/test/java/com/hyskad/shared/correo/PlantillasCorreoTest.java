package com.hyskad.shared.correo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Stream;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.mail.javamail.JavaMailSender;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

/**
 * Cada plantilla de correo se renderiza con datos de ejemplo sin errores de Thymeleaf, y su HTML y
 * su texto plano coinciden con el snapshot de {@code src/test/resources/correos/}. Para regenerar
 * los snapshots tras un cambio intencional: {@code -Dsnapshots.actualizar=true}.
 */
class PlantillasCorreoTest {

    private static final Path SNAPSHOTS = Path.of("src/test/resources/correos");
    private static final Locale ES = Locale.forLanguageTag("es-CO");
    private static final List<Map<String, String>> LINEAS = List.of(
            Map.of("descripcion", "Mantenimiento de frenos", "cantidad", "1", "subtotal", "$ 45.000"),
            Map.of("descripcion", "Pastillas de freno", "cantidad", "2", "subtotal", "$ 100.000"));

    private final CorreoService correos = new CorreoService(mock(JavaMailSender.class), motor(), mensajes(),
            () -> new PieCorreo.Datos("Taller HYSKAD", "900123456-8", "Calle 41 # 10-25, Montería", "6047891234"),
            "no-reply@hyskad.test", 0, 0);

    static Stream<Arguments> plantillas() {
        Map<String, Object> orden = Map.of("nombre", "Ana Pérez", "numero", "OT-000123", "placa", "ABC12D",
                "moto", "Yamaha FZ 150");
        return Stream.of(
                Arguments.of("orden-recibida", ES, unir(orden, Map.of("fecha", "12/11/2026 9:45 p. m.",
                        "motivo", "Mantenimiento general"))),
                Arguments.of("presupuesto-pendiente", ES, unir(orden, Map.of("presupuesto", "P-000045",
                        "lineas", LINEAS, "subtotal", "$ 145.000", "descuento", "$ 5.000", "iva", "19",
                        "impuesto", "$ 26.600", "total", "$ 166.600"))),
                Arguments.of("orden-lista", ES, unir(orden, Map.of("total", "$ 166.600"))),
                Arguments.of("orden-entregada", ES, unir(orden, Map.of("fecha", "13/11/2026 10:00 a. m.",
                        "lineas", LINEAS, "total", "$ 166.600", "metodo", "EFECTIVO"))),
                Arguments.of("recuperacion-password", ES, Map.of("nombre", "Ana", "minutos", 30,
                        "enlace", "http://localhost:4200/restablecer?token=abc")),
                Arguments.of("recuperacion-password", Locale.ENGLISH, Map.of("nombre", "Ana", "minutos", 30,
                        "enlace", "http://localhost:4200/restablecer?token=abc")));
    }

    @ParameterizedTest(name = "{0} ({1})")
    @MethodSource("plantillas")
    void seRenderizaSinErroresYCoincideConSuSnapshot(String plantilla, Locale idioma, Map<String, Object> datos)
            throws IOException {
        CorreoService.Correo correo = correos.renderizar(plantilla, idioma, datos);

        assertThat(correo.asunto()).isNotBlank().doesNotContain("??");
        assertThat(correo.html()).contains("cid:logo").contains("width=\"240\"").contains("Taller HYSKAD")
                .doesNotContain("??").doesNotContain("th:text", "th:replace", "xmlns:th");
        assertThat(correo.texto()).contains("Taller HYSKAD").doesNotContain("??").doesNotContain("[(");
        String nombre = plantilla + "-" + idioma.getLanguage();
        comparar(nombre + ".html", correo.html());
        comparar(nombre + ".txt", correo.texto());
    }

    private static void comparar(String archivo, String actual) throws IOException {
        Path snapshot = SNAPSHOTS.resolve(archivo);
        String normalizado = actual.replace("\r\n", "\n");
        if (Boolean.getBoolean("snapshots.actualizar") || !Files.exists(snapshot)) {
            Files.createDirectories(SNAPSHOTS);
            Files.writeString(snapshot, normalizado, StandardCharsets.UTF_8);
        }
        assertThat(normalizado).isEqualTo(Files.readString(snapshot, StandardCharsets.UTF_8).replace("\r\n", "\n"));
    }

    private static Map<String, Object> unir(Map<String, Object> a, Map<String, Object> b) {
        java.util.HashMap<String, Object> todo = new java.util.HashMap<>(a);
        todo.putAll(b);
        return todo;
    }

    private static SpringTemplateEngine motor() {
        ClassLoaderTemplateResolver html = new ClassLoaderTemplateResolver();
        html.setPrefix("templates/");
        html.setSuffix(".html");
        html.setTemplateMode(TemplateMode.HTML);
        html.setCharacterEncoding(StandardCharsets.UTF_8.name());
        html.setOrder(1);
        SpringTemplateEngine motor = new SpringTemplateEngine();
        motor.addTemplateResolver(new PlantillasTextoConfig().plantillasTexto());
        motor.addTemplateResolver(html);
        motor.setTemplateEngineMessageSource(mensajes());
        return motor;
    }

    private static ResourceBundleMessageSource mensajes() {
        ResourceBundleMessageSource mensajes = new ResourceBundleMessageSource();
        mensajes.setBasename("i18n/correos");
        mensajes.setDefaultEncoding(StandardCharsets.UTF_8.name());
        mensajes.setFallbackToSystemLocale(false);
        return mensajes;
    }
}
