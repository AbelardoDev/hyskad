package com.hyskad.shared.consecutivo;

import com.hyskad.shared.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "consecutivo")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class Consecutivo extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, unique = true, length = 20)
    private TipoConsecutivo tipo;

    @Column(nullable = false)
    private long siguiente;

    /** Devuelve el número actual y deja listo el siguiente. */
    long tomar() {
        return siguiente++;
    }
}
