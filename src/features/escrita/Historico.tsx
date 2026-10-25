"use client";

import { useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { exigir, useConsulta } from "@/lib/useConsulta";
import { useTempoReal } from "@/lib/tempoReal";
import { dataSP, formatarData } from "@/lib/datas";
import type { EscritaVersao, FormatoEscrita } from "@/lib/tipos";
import { Modal } from "@/components/ui/Modal";
import { Botao } from "@/components/ui/Botao";
import { EstadoErro, EstadoVazio, EsqueletoLista } from "@/components/ui/Estados";
import { textosDoFormato } from "./formatos";
import { PontosDominio } from "./Dominio";

const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function ModalHistorico({
  escritaId,
  formato,
  fechar,
  restaurar,
}: {
  escritaId: string | null;
  formato: FormatoEscrita;
  fechar: () => void;
  restaurar: (v: EscritaVersao) => void;
}) {
  const { dados, carregando, erro, recarregar, atualizar } = useConsulta(async () => {
    if (!escritaId) return [] as EscritaVersao[];
    return exigir(
      await supabase().from("escrita_versoes").select("*").eq("escrita_id", escritaId).order("created_at", { ascending: false }),
    ) as EscritaVersao[];
  }, escritaId ?? "");
  useTempoReal(["escrita_versoes"], atualizar);
  const [aberta, setAberta] = useState<string | null>(null);
  const versoes = dados ?? [];
  const selecionada = versoes.find((v) => v.id === aberta) ?? versoes[0];

  return (
    <Modal titulo="Histórico de versões" fechar={fechar} largura="max-w-4xl">
      {erro ? (
        <EstadoErro tentarDeNovo={recarregar} />
      ) : carregando && !dados ? (
        <EsqueletoLista linhas={4} />
      ) : versoes.length === 0 ? (
        <EstadoVazio icone={History} titulo="Nenhuma versão ainda" texto="Cada vez que você clica em Guardar escrita, uma versão fica guardada aqui." />
      ) : (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <ul className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
            {versoes.map((v, i) => (
              <li key={v.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setAberta(v.id)}
                  aria-pressed={selecionada?.id === v.id}
                  className={`flex w-full flex-col items-start gap-1 rounded-md border px-3 py-2 text-left ${
                    selecionada?.id === v.id ? "border-rosa bg-rosa-suave" : "border-borda hover:bg-hover"
                  }`}
                >
                  <span className="text-[13px] font-bold">
                    Versão {versoes.length - i}
                    {i === 0 && <span className="ml-1.5 text-xs font-semibold text-texto-2">(mais recente)</span>}
                  </span>
                  <span className="tabular text-xs text-texto-2">
                    {formatarData(dataSP(v.created_at))} às {hora.format(new Date(v.created_at))} · {v.palavras} palavras
                  </span>
                  <PontosDominio valor={v.dominio} />
                </button>
              </li>
            ))}
          </ul>
          {selecionada && (
            <div className="min-w-0 rounded-lg border border-borda p-4">
              <div className="flex flex-col gap-4 font-serif text-[16px] leading-relaxed">
                {textosDoFormato(selecionada.formato ?? formato, selecionada.conteudo).map((t) => (
                  <section key={t.rotulo}>
                    <h3 className="font-sans text-[13px] font-extrabold">{t.rotulo}</h3>
                    <p className="whitespace-pre-line">{t.texto}</p>
                  </section>
                ))}
                {selecionada.lacunas && (
                  <section>
                    <h3 className="font-sans text-[13px] font-extrabold">Lacunas</h3>
                    <p className="whitespace-pre-line">{selecionada.lacunas}</p>
                  </section>
                )}
              </div>
              <Botao className="mt-5" icone={<RotateCcw size={15} />} onClick={() => restaurar(selecionada)}>
                Restaurar esta versão
              </Botao>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
