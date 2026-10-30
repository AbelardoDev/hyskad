package com.hyskad.shared.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

/** Documentación OpenAPI. Swagger UI se publica en /api/docs solo en dev y test. */
@Configuration
public class OpenApiConfig {

    private static final String ESQUEMA_JWT = "bearerJwt";

    @Bean
    OpenAPI hyskadOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("HYSKAD API")
                        .description("Gestión de almacén y taller de motocicletas")
                        .version("v1"))
                .components(new Components().addSecuritySchemes(ESQUEMA_JWT, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(ESQUEMA_JWT));
    }
}
