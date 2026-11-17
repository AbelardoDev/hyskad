package com.hyskad.shared.web;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * CSV para Excel en español: UTF-8 con BOM (las tildes se ven bien), separado por punto y coma,
 * números sin separador de miles y con punto decimal, y textos entre comillas. Una celda que empieza
 * por {@code = + - @} lleva un apóstrofo para que la hoja no la ejecute como fórmula (inyección CSV).
 */
public final class Csv {

    public static final MediaType TIPO = new MediaType("text", "csv", StandardCharsets.UTF_8);
    private static final String BOM = "\uFEFF";
    private static final String SEPARADOR = ";";
    private static final String FIN = "\r\n";

    private final StringBuilder contenido = new StringBuilder(BOM);

    private Csv(List<String> encabezados) {
        contenido.append(String.join(SEPARADOR, encabezados)).append(FIN);
    }

    public static Csv con(String... encabezados) {
        return new Csv(Arrays.asList(encabezados));
    }

    /** Cada valor ya convertido con {@link #texto} o {@link #numero}. */
    public Csv fila(String... celdas) {
        contenido.append(Arrays.stream(celdas).map(c -> c == null ? "" : c).collect(Collectors.joining(SEPARADOR)))
                .append(FIN);
        return this;
    }

    public byte[] bytes() {
        return contenido.toString().getBytes(StandardCharsets.UTF_8);
    }

    /** Respuesta de descarga con el nombre de archivo indicado. */
    public ResponseEntity<byte[]> descarga(String archivo) {
        return ResponseEntity.ok().contentType(TIPO)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(archivo).build()
                        .toString())
                .body(bytes());
    }

    /** Texto entre comillas (duplicando las internas), neutralizando fórmulas. */
    public static String texto(Object valor) {
        if (valor == null) {
            return "";
        }
        String s = valor.toString();
        String seguro = s.matches("^[=+\\-@\\t\\r].*") ? "'" + s : s;
        return "\"" + seguro.replace("\"", "\"\"") + "\"";
    }

    /** Número plano: {@code 1250000}, {@code 2.5}; sin miles ni ceros sobrantes. */
    public static String numero(BigDecimal valor) {
        return valor == null ? "" : valor.stripTrailingZeros().toPlainString();
    }

    public static String numero(long valor) {
        return Long.toString(valor);
    }
}
