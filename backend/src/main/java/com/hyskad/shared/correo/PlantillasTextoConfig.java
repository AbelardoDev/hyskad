package com.hyskad.shared.correo;

import java.nio.charset.StandardCharsets;
import java.util.Set;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

/**
 * Plantillas de texto plano de los correos ({@code templates/email/*.txt}). El motor de Thymeleaf
 * de Spring Boot suma este resolver al de HTML; este va primero y solo resuelve los {@code .txt}.
 */
@Configuration
class PlantillasTextoConfig {

    @Bean
    ClassLoaderTemplateResolver plantillasTexto() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setTemplateMode(TemplateMode.TEXT);
        resolver.setCharacterEncoding(StandardCharsets.UTF_8.name());
        resolver.setResolvablePatterns(Set.of("*.txt"));
        resolver.setOrder(0);
        resolver.setCheckExistence(true);
        return resolver;
    }
}
