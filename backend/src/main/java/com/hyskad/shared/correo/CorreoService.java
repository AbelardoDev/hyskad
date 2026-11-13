package com.hyskad.shared.correo;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

/**
 * Envía correos con plantillas Thymeleaf de {@code templates/email/}: la versión HTML
 * ({@code <plantilla>.html}, sobre {@code layout.html} con el logo incrustado por CID) y la de
 * texto plano ({@code <plantilla>.txt}). Los textos salen de {@code i18n/correos*.properties} en el
 * idioma indicado. Se usa desde listeners asíncronos: si falla, se reintenta con espera creciente
 * y al final solo se registra (con el {@code requestId} del MDC); nunca revierte la operación de
 * negocio. Los logs no incluyen el destinatario ni el contenido.
 */
@Service
public class CorreoService {

    static final String CID_LOGO = "logo";
    private static final String LOGO = "static/email/logo-email.png";
    private static final Logger log = LoggerFactory.getLogger(CorreoService.class);

    private final JavaMailSender mailSender;
    private final SpringTemplateEngine plantillas;
    private final MessageSource mensajes;
    private final PieCorreo pie;
    private final String remitente;
    private final int reintentos;
    private final long esperaInicialMs;

    public CorreoService(JavaMailSender mailSender, SpringTemplateEngine plantillas, MessageSource mensajes,
            PieCorreo pie, @Value("${hyskad.mail-from}") String remitente,
            @Value("${hyskad.correo.reintentos:2}") int reintentos,
            @Value("${hyskad.correo.espera-inicial-ms:1000}") long esperaInicialMs) {
        this.mailSender = mailSender;
        this.plantillas = plantillas;
        this.mensajes = mensajes;
        this.pie = pie;
        this.remitente = remitente;
        this.reintentos = reintentos;
        this.esperaInicialMs = esperaInicialMs;
    }

    /**
     * @param plantilla nombre dentro de {@code templates/email/}; el asunto es la clave
     *                  {@code <plantilla>.asunto} de los mensajes de correo
     * @return {@code true} si se envió
     */
    public boolean enviar(String destinatario, String plantilla, Locale idioma, Map<String, Object> variables) {
        Correo correo = renderizar(plantilla, idioma, variables);
        long espera = esperaInicialMs;
        for (int intento = 1; intento <= reintentos + 1; intento++) {
            try {
                MimeMessage mensaje = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(mensaje, MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                        StandardCharsets.UTF_8.name());
                helper.setFrom(remitente);
                helper.setTo(destinatario);
                helper.setSubject(correo.asunto());
                helper.setText(correo.texto(), correo.html());
                helper.addInline(CID_LOGO, new ClassPathResource(LOGO), "image/png");
                mailSender.send(mensaje);
                return true;
            } catch (MailException | MessagingException e) {
                log.warn("Falló el envío del correo '{}' (intento {} de {}): {}", plantilla, intento, reintentos + 1,
                        e.getClass().getSimpleName());
                if (intento <= reintentos && !esperar(espera)) {
                    break;
                }
                espera *= 2;
            }
        }
        log.error("No se pudo enviar el correo '{}' tras {} intentos", plantilla, reintentos + 1);
        return false;
    }

    /** HTML, texto plano y asunto de la plantilla con los datos del taller para el pie. */
    public Correo renderizar(String plantilla, Locale idioma, Map<String, Object> variables) {
        Map<String, Object> todas = new HashMap<>(variables);
        todas.put("taller", pie.datos());
        todas.put("cidLogo", CID_LOGO);
        Context contexto = new Context(idioma, todas);
        return new Correo(mensajes.getMessage(plantilla + ".asunto", null, idioma),
                plantillas.process("email/" + plantilla, contexto),
                plantillas.process("email/" + plantilla + ".txt", contexto));
    }

    private static boolean esperar(long ms) {
        try {
            Thread.sleep(ms);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    public record Correo(String asunto, String html, String texto) {
    }
}
