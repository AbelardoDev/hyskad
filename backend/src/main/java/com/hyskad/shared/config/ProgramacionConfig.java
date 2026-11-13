package com.hyskad.shared.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Tareas periódicas (p. ej. el latido de las conexiones SSE). */
@Configuration
@EnableScheduling
public class ProgramacionConfig {
}
