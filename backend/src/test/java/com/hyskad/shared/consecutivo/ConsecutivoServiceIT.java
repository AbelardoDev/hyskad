package com.hyskad.shared.consecutivo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.support.TransactionTemplate;

import com.hyskad.support.IntegrationTest;

@IntegrationTest
class ConsecutivoServiceIT {

    @Autowired
    private ConsecutivoService service;

    @Autowired
    private TransactionTemplate tx;

    @Test
    void entregaNumerosSeguidosConFormato() {
        String primero = tx.execute(estado -> service.siguiente(TipoConsecutivo.COMPRA));
        String segundo = tx.execute(estado -> service.siguiente(TipoConsecutivo.COMPRA));

        assertThat(primero).matches("C-\\d{6}");
        assertThat(numero(segundo)).isEqualTo(numero(primero) + 1);
    }

    @Test
    void siLaTransaccionSeRevierteElNumeroNoSeConsume() {
        String antes = tx.execute(estado -> service.siguiente(TipoConsecutivo.PRESUPUESTO));
        tx.executeWithoutResult(estado -> {
            service.siguiente(TipoConsecutivo.PRESUPUESTO);
            estado.setRollbackOnly();
        });
        String despues = tx.execute(estado -> service.siguiente(TipoConsecutivo.PRESUPUESTO));

        assertThat(numero(despues)).isEqualTo(numero(antes) + 1);
    }

    @Test
    void exigeUnaTransaccionDelLlamador() {
        assertThatThrownBy(() -> service.siguiente(TipoConsecutivo.OT))
                .isInstanceOf(IllegalTransactionStateException.class);
    }

    @Test
    void diezHilosConcurrentesObtienenNumerosDistintosYSinHuecos() throws Exception {
        int hilos = 10;
        CountDownLatch salida = new CountDownLatch(1);
        List<Callable<String>> tareas = IntStream.range(0, hilos)
                .<Callable<String>>mapToObj(i -> () -> {
                    salida.await();
                    return tx.execute(estado -> service.siguiente(TipoConsecutivo.VENTA));
                })
                .toList();

        List<String> numeros = new ArrayList<>();
        try (ExecutorService pool = Executors.newFixedThreadPool(hilos)) {
            List<Future<String>> futuros = tareas.stream().map(pool::submit).toList();
            salida.countDown();
            for (Future<String> futuro : futuros) {
                numeros.add(futuro.get());
            }
        }

        List<Long> ordenados = numeros.stream().map(ConsecutivoServiceIT::numero).sorted().toList();
        assertThat(numeros).allMatch(n -> n.startsWith("V-")).doesNotHaveDuplicates();
        assertThat(ordenados.getLast() - ordenados.getFirst()).isEqualTo(hilos - 1);
    }

    private static long numero(String consecutivo) {
        return Long.parseLong(consecutivo.substring(consecutivo.indexOf('-') + 1));
    }
}
