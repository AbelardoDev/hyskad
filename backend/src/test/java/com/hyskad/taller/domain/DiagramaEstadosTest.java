package com.hyskad.taller.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

/**
 * El diagrama Mermaid de ARCHITECTURE.md §6.2 se genera a partir de {@link EstadoOrden}: si el enum
 * cambia, esta prueba falla y muestra el diagrama nuevo para pegarlo en el documento.
 */
class DiagramaEstadosTest {

    private static final Path ARQUITECTURA = Path.of("..", "docs", "ARCHITECTURE.md");
    private static final String INICIO = "<!-- diagrama-estados:inicio -->";
    private static final String FIN = "<!-- diagrama-estados:fin -->";

    static String mermaid() {
        StringBuilder diagrama = new StringBuilder("```mermaid\nstateDiagram-v2\n    [*] --> ")
                .append(EstadoOrden.RECIBIDA).append('\n');
        for (EstadoOrden desde : EstadoOrden.values()) {
            for (EstadoOrden hasta : desde.destinos()) {
                EstadoOrden.Regla regla = desde.regla(hasta).orElseThrow();
                String etiqueta = regla.esAutomatica() ? "automática"
                        : regla.permiso() + (regla.requiereNota() ? " + nota" : "");
                diagrama.append("    ").append(desde).append(" --> ").append(hasta).append(": ").append(etiqueta)
                        .append('\n');
            }
        }
        for (EstadoOrden estado : EstadoOrden.finales()) {
            diagrama.append("    ").append(estado).append(" --> [*]\n");
        }
        return diagrama.append("```").toString();
    }

    @Test
    void elDiagramaDeLaDocumentacionCoincideConElEnum() throws IOException {
        String documento = Files.readString(ARQUITECTURA, StandardCharsets.UTF_8).replace("\r\n", "\n");
        int inicio = documento.indexOf(INICIO);
        int fin = documento.indexOf(FIN);
        assertThat(inicio).as("marcador %s en ARCHITECTURE.md", INICIO).isNotNegative();
        assertThat(fin).as("marcador %s en ARCHITECTURE.md", FIN).isGreaterThan(inicio);

        assertThat(documento.substring(inicio + INICIO.length(), fin).strip())
                .as("Diagrama desactualizado; reemplázalo por:%n%s", mermaid())
                .isEqualTo(mermaid());
    }
}
