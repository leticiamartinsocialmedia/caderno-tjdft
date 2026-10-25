"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { haExclusaoPendente } from "@/components/ui/Toast";

let sequencia = 0;

/**
 * Tempo real: quando qualquer aparelho muda uma das tabelas, chama `aoMudar`
 * (normalmente para recarregar a lista). Também atualiza ao voltar para a aba
 * e ao reconectar, para cobrir avisos perdidos enquanto o aparelho dormia.
 */
export function useTempoReal(tabelas: string[], aoMudar: () => void) {
  const ref = useRef(aoMudar);
  useEffect(() => {
    ref.current = aoMudar;
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

    const canal = sb.channel(`tempo-real-${chave}-${++sequencia}`);
    for (const tabela of chave.split(",")) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: tabela }, () => agendar());
    }
    let jaConectou = false;
    canal.subscribe((status) => {
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
      void sb.removeChannel(canal);
    };
  }, [chave]);
}
