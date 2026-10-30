package com.hyskad.shared.config;

import java.util.Map;

import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskDecorator;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/** Ejecutor acotado para tareas asíncronas (correos, notificaciones). Propaga el MDC (requestId). */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "taskExecutor")
    ThreadPoolTaskExecutor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("hyskad-async-");
        executor.setTaskDecorator(propagarMdc());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        return executor;
    }

    private static TaskDecorator propagarMdc() {
        return tarea -> {
            Map<String, String> contexto = MDC.getCopyOfContextMap();
            return () -> {
                if (contexto != null) {
                    MDC.setContextMap(contexto);
                }
                try {
                    tarea.run();
                } finally {
                    MDC.clear();
                }
            };
        };
    }
}
