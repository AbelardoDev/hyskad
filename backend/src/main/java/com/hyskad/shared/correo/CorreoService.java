package com.hyskad.shared.correo;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

/**
 * Envía correos HTML con plantillas Thymeleaf de {@code templates/email/} y textos de
 * {@code i18n/correos*.properties} en el idioma indicado. Se usa desde listeners asíncronos: un
 * fallo se reintenta una vez y luego solo se registra (nunca revierte la operación de negocio).
 * Los logs no incluyen el destinatario ni el contenido.
 */
@Service
public class CorreoService {

    private static final Logger log = LoggerFactory.getLogger(CorreoService.class);
    private static final int INTENTOS = 2;

    private final JavaMailSender mailSender;
    private final SpringTemplateEngine plantillas;
    private final MessageSource mensajes;
    private final String remitente;

    public CorreoService(JavaMailSender mailSender, SpringTemplateEngine plantillas, MessageSource mensajes,
            @Value("${hyskad.mail-from}") String remitente) {
        this.mailSender = mailSender;
        this.plantillas = plantillas;
        this.mensajes = mensajes;
        this.remitente = remitente;
    }

    /**
     * @param plantilla nombre dentro de {@code templates/email/}; el asunto es la clave
     *                  {@code <plantilla>.asunto} de los mensajes de correo
     * @return {@code true} si se envió
     */
    public boolean enviar(String destinatario, String plantilla, Locale idioma, Map<String, Object> variables) {
        Context contexto = new Context(idioma, variables);
        String html = plantillas.process("email/" + plantilla, contexto);
        String asunto = mensajes.getMessage(plantilla + ".asunto", null, idioma);
        for (int intento = 1; intento <= INTENTOS; intento++) {
            try {
                MimeMessage mensaje = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(mensaje, false, StandardCharsets.UTF_8.name());
                helper.setFrom(remitente);
                helper.setTo(destinatario);
                helper.setSubject(asunto);
                helper.setText(html, true);
                mailSender.send(mensaje);
                return true;
            } catch (MailException | MessagingException e) {
                log.warn("Falló el envío del correo '{}' (intento {} de {}): {}", plantilla, intento, INTENTOS,
                        e.getClass().getSimpleName());
            }
        }
        log.error("No se pudo enviar el correo '{}' tras {} intentos", plantilla, INTENTOS);
        return false;
    }
}
