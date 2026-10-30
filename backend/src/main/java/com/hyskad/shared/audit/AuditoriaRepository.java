package com.hyskad.shared.audit;

import org.springframework.data.jpa.repository.JpaRepository;

interface AuditoriaRepository extends JpaRepository<Auditoria, Long> {
}
