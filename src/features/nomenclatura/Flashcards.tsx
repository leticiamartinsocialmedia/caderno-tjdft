"use client";

import { useMemo, useState } from "react";
import { Check, Layers, RotateCcw, Shuffle, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { porNaRevisao } from "@/lib/filaRevisao";
import type { Termo } from "@/lib/tipos";
import { Botao } from "@/components/ui/Botao";
import { EstadoVazio } from "@/components/ui/Estados";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/components/shell/AppContext";

function embaralhar<T>(lista: T[]) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Modo flashcard: mostra a sigla, você tenta lembrar, vira e marca "Sabia" ou "Não sabia". */
export function Flashcards({ termos }: { termos: Termo[] }) {
  const { usuario } = useApp();
  const { avisar } = useToast();
  const [soAprendendo, setSoAprendendo] = useState(true);
  const [semente, setSemente] = useState(0);
  const baralho = useMemo(
    () => embaralhar(termos.filter((t) => !soAprendendo || t.status === "aprendendo")),
    // semente força um novo embaralhamento ao recomeçar
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [termos.length, soAprendendo, semente],
  );
  const [indice, setIndice] = useState(0);
  const [virado, setVirado] = useState(false);
  const [resultado, setResultado] = useState({ sabia: 0, naoSabia: 0 });

  function recomecar(so = soAprendendo) {
    setSoAprendendo(so);
    setSemente((s) => s + 1);
    setIndice(0);
    setVirado(false);
    setResultado({ sabia: 0, naoSabia: 0 });
  }

  async function responder(sabia: boolean) {
    const termo = baralho[indice];
    setResultado((r) => (sabia ? { ...r, sabia: r.sabia + 1 } : { ...r, naoSabia: r.naoSabia + 1 }));
    setVirado(false);
    setIndice((i) => i + 1);
    if (!sabia) {
      try {
        await porNaRevisao(usuario.id, "termo", termo.id);
        if (termo.status !== "aprendendo") await supabase().from("termos").update({ status: "aprendendo" }).eq("id", termo.id);
      } catch {
        avisar({ texto: `Não deu para pôr "${termo.termo}" na revisão.`, tipo: "erro" });
      }
    }
  }

  const filtro = (
    <label className="flex cursor-pointer items-center gap-2 text-[13px]">
      <input id="so-aprendendo" type="checkbox" checked={soAprendendo} onChange={(e) => recomecar(e.target.checked)} className="h-4 w-4 accent-[#FF2E63]" />
      Só os que estou aprendendo
    </label>
  );

  if (baralho.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {filtro}
        <EstadoVazio icone={Layers} titulo="Nenhum card neste baralho" texto="Desmarque o filtro para treinar todos os termos." />
      </div>
    );
  }

  if (indice >= baralho.length) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 rounded-xl border border-borda p-8 text-center">
        <Layers size={28} />
        <h2 className="text-[20px] font-extrabold">Baralho concluído</h2>
        <p className="tabular text-[15px]">
          <strong>{resultado.sabia}</strong> sabia · <strong>{resultado.naoSabia}</strong> não sabia
        </p>
        {resultado.naoSabia > 0 && <p className="text-[13px] text-texto-2">Os que você não sabia entraram na fila de revisões de amanhã.</p>}
        <Botao variante="primario" icone={<RotateCcw size={15} />} onClick={() => recomecar()}>
          Treinar de novo
        </Botao>
      </div>
    );
  }

  const termo = baralho[indice];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {filtro}
        <span className="tabular text-[13px] font-semibold text-texto-2">
          {indice + 1} de {baralho.length}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-hover">
        <div className="h-full bg-rosa transition-[width]" style={{ width: `${(indice / baralho.length) * 100}%` }} />
      </div>

      <button
        type="button"
        onClick={() => setVirado((v) => !v)}
        aria-label={virado ? "Mostrar a frente do card" : "Virar o card"}
        className="mx-auto flex min-h-[300px] w-full max-w-2xl flex-col items-center justify-center gap-3 rounded-xl border border-borda bg-superficie px-6 py-8 text-center shadow-sm transition-colors hover:bg-hover/50"
      >
        {!virado ? (
          <>
            <span className="text-[44px] leading-tight font-extrabold break-words sm:text-[56px]">{termo.termo}</span>
            <span className="text-[13px] text-texto-2">Tente lembrar o significado. Toque para virar.</span>
          </>
        ) : (
          <div className="flex w-full flex-col gap-3 text-left">
            <p className="text-[13px] font-bold text-texto-2">{termo.termo}</p>
            {termo.extenso && <p className="text-[20px] leading-snug font-extrabold">{termo.extenso}</p>}
            {termo.pratica && (
              <p className="text-[14.5px] leading-relaxed">
                <span className="mb-0.5 block text-xs font-bold text-texto-2">Jeito simples</span>
                {termo.pratica}
              </p>
            )}
            {termo.tecnica && (
              <p className="text-[14.5px] leading-relaxed">
                <span className="mb-0.5 block text-xs font-bold text-texto-2">Como a prova cobra</span>
                {termo.tecnica}
              </p>
            )}
          </div>
        )}
      </button>

      <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-3">
        {!virado ? (
          <Botao className="col-span-2 h-12! text-[14px]" variante="primario" onClick={() => setVirado(true)}>
            Virar
          </Botao>
        ) : (
          <>
            <button
              type="button"
              onClick={() => responder(false)}
              className="flex h-12 items-center justify-center gap-2 rounded-lg border-2 border-erro bg-superficie text-[14px] font-extrabold text-erro hover:bg-erro-suave"
            >
              <X size={18} /> Não sabia
            </button>
            <button
              type="button"
              onClick={() => responder(true)}
              className="flex h-12 items-center justify-center gap-2 rounded-lg border-2 border-sucesso bg-superficie text-[14px] font-extrabold text-sucesso hover:bg-sucesso-suave"
            >
              <Check size={18} /> Sabia
            </button>
          </>
        )}
      </div>
      <div className="flex justify-center">
        <Botao variante="fantasma" icone={<Shuffle size={15} />} onClick={() => recomecar()}>
          Embaralhar de novo
        </Botao>
      </div>
    </div>
  );
}
