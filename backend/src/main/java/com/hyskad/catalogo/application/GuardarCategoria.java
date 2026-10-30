package com.hyskad.catalogo.application;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Datos para crear o editar una categoría de productos (RF17). */
public record GuardarCategoria(@NotBlank @Size(max = 80) String nombre, @Size(max = 255) String descripcion) {
}
