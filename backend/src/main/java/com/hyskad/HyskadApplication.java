package com.hyskad;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class HyskadApplication {

    public static void main(String[] args) {
        SpringApplication.run(HyskadApplication.class, args);
    }
}
