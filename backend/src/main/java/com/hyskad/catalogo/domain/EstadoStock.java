package com.hyskad.catalogo.domain;

/** Nivel del stock disponible frente al mínimo: agotado (≤ 0), bajo (≤ mínimo) u ok. */
public enum EstadoStock {
    OK, BAJO, AGOTADO
}
