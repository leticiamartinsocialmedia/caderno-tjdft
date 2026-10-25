"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { dataSP, formatarData } from "@/lib/datas";
import { Botao } from "@/components/ui/Botao";

const SECOES = [
  "O que está certo",
  "O que corrigir",
  "O que faltou",
  "Explicação prática",
  "Explicação técnica",
  "Assertivas estilo Cebraspe",
];

const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

let iaAtiva: Promise<boolean> | null = null;
function verificarIA() {
  iaAtiva ??= fetch("/api/corrigir")
    .then((r) => (r.ok ? r.json() : { ativo: false }))
    .then((j: { ativo?: boolean }) => Boolean(j.ativo))
    .catch(() => false);
  return iaAtiva;
}

/** Correção por IA: só aparece se a chave da Anthropic estiver configurada no servidor. */
export function PainelCorrecao({
  escritaId,
  correcao,
  corrigidaEm,
  antesDeCorrigir,
  aoCorrigir,
}: {
  escritaId: string;
  correcao: string | null;
  corrigidaEm: string | null;
  antesDeCorrigir: () => Promise<boolean>;
  aoCorrigir: (texto: string, em: string) => void;
}) {
  const [ativo, setAtivo] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    void verificarIA().then(setAtivo);
  }, []);

  if (!ativo && !correcao) return null;

  async function corrigir() {
    setErro("");
    setCorrigindo(true);
    try {
      if (!(await antesDeCorrigir())) throw new Error("Salve a escrita antes de corrigir.");
      const r = await fetch("/api/corrigir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escritaId }),
      });
      const j = (await r.json()) as { correcao?: string; corrigida_em?: string; erro?: string };
      if (!r.ok || !j.correcao) throw new Error(j.erro ?? "Não deu para corrigir agora.");
      aoCorrigir(j.correcao, j.corrigida_em ?? new Date().toISOString());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para corrigir agora.");
    } finally {
      setCorrigindo(false);
    }
  }

  return (
    <section className="rounded-lg border border-borda p-4" aria-labelledby="titulo-correcao">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="titulo-correcao" className="flex items-center gap-2 text-[15px] font-extrabold">
            <Sparkles size={17} className="text-rosa-texto" /> Correção por IA
          </h2>
          <p className="text-[12.5px] text-texto-2">
            {corrigidaEm
              ? `Corrigida em ${formatarData(dataSP(corrigidaEm))} às ${hora.format(new Date(corrigidaEm))}.`
              : "Confere o conteúdo e cria 3 assertivas no estilo Cebraspe. Leva cerca de 1 minuto."}
          </p>
        </div>
        {ativo && (
          <Botao icone={corrigindo ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} onClick={corrigir} disabled={corrigindo}>
            {corrigindo ? "Corrigindo…" : correcao ? "Corrigir de novo" : "Corrigir com IA"}
          </Botao>
        )}
      </div>
      {erro && (
        <p className="mt-3 rounded-md bg-erro-suave px-3 py-2 text-[13px] font-medium text-erro" role="alert">
          {erro}
        </p>
      )}
      {correcao && (
        <div className="mt-4 flex flex-col gap-1 text-[14px] leading-relaxed">
          {correcao.split("\n").map((linha, i) => {
            const limpa = linha.trim().replace(/:$/, "");
            const ehTitulo = SECOES.some((s) => limpa.toLowerCase().startsWith(s.toLowerCase())) && limpa.length < 60;
            return ehTitulo ? (
              <h3 key={i} className="mt-3 text-[13.5px] font-extrabold first:mt-0">
                {limpa}
              </h3>
            ) : (
              <p key={i} className={linha.trim() ? "whitespace-pre-wrap" : "h-1"}>
                {linha}
              </p>
            );
          })}
        </div>
      )}
    </section>
  );
}
