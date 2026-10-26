"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase/client";
import { haExclusaoPendente } from "@/components/ui/Toast";

let sequencia = 0;

// Situação da conexão em tempo real, para o indicador "Ao vivo" no topo.
export type StatusTempoReal = "ao_vivo" | "conectando" | "offline";
const canais = new Map<number, string>();
const ouvintes = new Set<() => void>();
let statusAtual: StatusTempoReal = "conectando";

function recalcular() {
  const lista = [...canais.values()];
  const novo: StatusTempoReal =
    typeof navigator !== "undefined" && !navigator.onLine
      ? "offline"
      : lista.includes("SUBSCRIBED")
        ? "ao_vivo"
        : lista.some((s) => s === "CHANNEL_ERROR" || s === "TIMED_OUT")
          ? "offline"
          : "conectando";
  if (novo !== statusAtual) {
    statusAtual = novo;
    ouvintes.forEach((o) => o());
  }
}

export function useStatusTempoReal(): StatusTempoReal {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      window.addEventListener("online", recalcular);
      window.addEventListener("offline", recalcular);
      return () => {
        ouvintes.delete(o);
        window.removeEventListener("online", recalcular);
        window.removeEventListener("offline", recalcular);
      };
    },
    () => statusAtual,
    () => "conectando",
  );
}

export type FiltroTempoReal = (tabela: string, linha: Record<string, unknown>) => boolean;

/**
 * Tempo real: quando qualquer aparelho muda uma das tabelas, chama `aoMudar`
 * (normalmente para recarregar a lista). Também atualiza ao voltar para a aba
 * e ao reconectar, para cobrir avisos perdidos enquanto o aparelho dormia.
 * `filtro` (opcional) ignora mudanças que não interessam à tela, pela linha nova (ou apagada).
 */
export function useTempoReal(tabelas: string[], aoMudar: () => void, filtro?: FiltroTempoReal) {
  const ref = useRef(aoMudar);
  const filtroRef = useRef(filtro);
  useEffect(() => {
    ref.current = aoMudar;
    filtroRef.current = filtro;
  });
  const chave = tabelas.join(",");

  useEffect(() => {
    if (!chave) return;
    const sb = supabase();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const agendar = (espera = 350) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (haExclusaoPendente()) return agendar(1000);
        ref.current();
      }, espera);
    };

    const numero = ++sequencia;
    const canal = sb.channel(`tempo-real-${chave}-${numero}`);
    for (const tabela of chave.split(",")) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: tabela }, (evento) => {
        const linha = (evento.new && Object.keys(evento.new).length ? evento.new : evento.old) as Record<string, unknown>;
        if (filtroRef.current && !filtroRef.current(tabela, linha ?? {})) return;
        agendar();
      });
    }
    let jaConectou = false;
    canal.subscribe((status) => {
      canais.set(numero, status);
      recalcular();
      if (status === "SUBSCRIBED") {
        // Numa reconexão, busca o que mudou enquanto estava fora.
        if (jaConectou) agendar();
        jaConectou = true;
      }
    });

    const aoVoltar = () => document.visibilityState === "visible" && agendar(0);
    const aoReconectar = () => agendar(0);
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", aoReconectar);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", aoReconectar);
      canais.delete(numero);
      recalcular();
      void sb.removeChannel(canal);
    };
  }, [chave]);
}
