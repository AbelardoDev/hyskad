package com.hyskad.shared.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.PropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

/**
 * OWASP A05 (configuración insegura): con el perfil prod no se publica la documentación de la API, el
 * actuator solo expone health sin detalles, los errores no llevan stacktrace ni mensaje interno y no
 * hay secretos con valor por defecto. Lee los mismos YAML que usa Spring, en el mismo orden.
 */
class ConfiguracionProduccionTest {

    @Test
    void elPerfilProdNoExponeDocumentacionActuatorNiDetallesDeError() throws IOException {
        StandardEnvironment entorno = entornoProd();

        assertThat(entorno.getProperty("springdoc.api-docs.enabled", Boolean.class)).isFalse();
        assertThat(entorno.getProperty("springdoc.swagger-ui.enabled", Boolean.class)).isFalse();
        assertThat(entorno.getProperty("management.endpoints.web.exposure.include")).isEqualTo("health");
        assertThat(entorno.getProperty("management.endpoint.health.show-details", "never")).isEqualTo("never");
        assertThat(entorno.getProperty("server.error.include-stacktrace")).isEqualTo("never");
        assertThat(entorno.getProperty("server.error.include-message")).isEqualTo("never");
        assertThat(entorno.getProperty("spring.jpa.open-in-view", Boolean.class)).isFalse();
        assertThat(entorno.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
    }

    @Test
    void enProdLosSecretosNoTienenValorPorDefecto() throws IOException {
        StandardEnvironment entorno = entornoProd();
        for (String clave : List.of("hyskad.jwt.secret", "spring.datasource.password", "spring.mail.password",
                "hyskad.admin.password")) {
            String valor = entorno.getProperty(clave);
            // No está, viene vacío o es una variable de entorno sin valor por defecto: ${VARIABLE}
            assertThat(valor == null || valor.isEmpty() || valor.matches("\\$\\{[A-Z_]+}"))
                    .as(clave + " = " + valor).isTrue();
        }
    }

    /** application.yml y encima application-prod.yml, sin resolver las variables de entorno. */
    private static StandardEnvironment entornoProd() throws IOException {
        StandardEnvironment entorno = new StandardEnvironment();
        MutablePropertySources fuentes = entorno.getPropertySources();
        fuentes.remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        fuentes.remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
        YamlPropertySourceLoader cargador = new YamlPropertySourceLoader();
        for (String archivo : List.of("application.yml", "application-prod.yml")) {
            for (PropertySource<?> fuente : cargador.load(archivo, new ClassPathResource(archivo))) {
                fuentes.addFirst(fuente);
            }
        }
        entorno.setIgnoreUnresolvableNestedPlaceholders(true);
        return entorno;
    }
}
