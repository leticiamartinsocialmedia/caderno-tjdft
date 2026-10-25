"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, FileQuestion, History, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { exigir, useConsulta } from "@/lib/useConsulta";
import { useTempoReal } from "@/lib/tempoReal";
import { useEditalBasico } from "@/lib/useEditalBasico";
import { dataSP, formatarData, hojeSP } from "@/lib/datas";
import { avaliar, INTERVALOS, ROTULO_AVALIACAO, rotuloIntervalo } from "@/lib/revisao";
import type { Avaliacao, Erro, Escrita, Revisao, RevisaoHistorico, Termo } from "@/lib/tipos";
import { CabecalhoPagina } from "@/components/ui/Cabecalho";
import { Botao } from "@/components/ui/Botao";
import { EstadoErro, EstadoVazio, Esqueleto } from "@/components/ui/Estados";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/components/shell/AppContext";
import { Folha } from "@/features/escrita/Folha";
import { montarItem, TIPO_ITEM } from "./dados";

async function carregar(id: string) {
  const sb = supabase();
  const revisao = exigir(await sb.from("revisoes").select("*").eq("id", id).maybeSingle()) as Revisao | null;
  if (!revisao) return null;
  const tabela = { escrita: "escritas", erro: "erros", termo: "termos" }[revisao.item_tipo];
  const [item, historico] = await Promise.all([
    sb.from(tabela).select("*").eq("id", revisao.item_id).maybeSingle(),
    sb.from("revisao_historico").select("*").eq("revisao_id", id).order("created_at", { ascending: false }),
  ]);
  return {
    revisao,
    item: exigir(item) as Escrita | Erro | Termo | null,
    historico: exigir(historico) as RevisaoHistorico[],
  };
}

const ESTILO_AVALIACAO: Record<Avaliacao, string> = {
  esqueci: "border-erro text-erro hover:bg-erro-suave",
  parcial: "border-alerta text-alerta hover:bg-alerta-suave",
  bem: "border-sucesso text-sucesso hover:bg-sucesso-suave",
};

const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function RevisaoAtiva({ id }: { id: string }) {
  const router = useRouter();
  const { avisar } = useToast();
  const { atualizarContadores } = useApp();
  const edital = useEditalBasico();
  const { dados, carregando, erro, recarregar, atualizar } = useConsulta(() => carregar(id), id);
  useTempoReal(["revisao_historico"], atualizar);
  const [reescrita, setReescrita] = useState("");
  const [mostrando, setMostrando] = useState(false);
  const [salvando, setSalvando] = useState<Avaliacao | null>(null);

  if (erro) return <EstadoErro texto="Não deu para abrir a revisão." tentarDeNovo={recarregar} />;
  if (carregando && !dados) {
    return (
      <div className="flex flex-col gap-4">
        <Esqueleto className="h-8 w-64" />
        <Esqueleto className="h-48" />
      </div>
    );
  }

  const item =
    dados?.revisao && dados.item
      ? montarItem(
          dados.revisao,
          dados.revisao.item_tipo === "escrita" ? (dados.item as Escrita) : undefined,
          dados.revisao.item_tipo === "erro" ? (dados.item as Erro) : undefined,
          dados.revisao.item_tipo === "termo" ? (dados.item as Termo) : undefined,
          edital.nomeTopico,
        )
      : null;

  if (!dados || !item) {
    return (
      <div className="flex flex-col gap-6">
        <CabecalhoPagina titulo="Revisão não encontrada" voltarPara="/revisoes" />
        <EstadoVazio icone={FileQuestion} titulo="Este item não existe mais" texto="Ele pode ter sido excluído em outro aparelho." />
      </div>
    );
  }

  const { revisao, historico } = dados;
  const hoje = hojeSP();
  const Icone = TIPO_ITEM[revisao.item_tipo].icone;

  async function registrar(avaliacao: Avaliacao) {
    setSalvando(avaliacao);
    const proximo = avaliar(revisao.nivel, avaliacao, hoje);
    const sb = supabase();
    const [h, r] = await Promise.all([
      sb.from("revisao_historico").insert({
        revisao_id: revisao.id,
        reescrita: reescrita.trim() || null,
        avaliacao,
        nivel_antes: revisao.nivel,
        nivel_depois: proximo.nivel,
      }),
      sb.from("revisoes").update(proximo).eq("id", revisao.id),
    ]);
    if (h.error || r.error) {
      setSalvando(null);
      avisar({ texto: "Não deu para registrar. Sua reescrita continua aqui; tente de novo.", tipo: "erro" });
      return;
    }
    atualizarContadores();
    avisar({ texto: `${ROTULO_AVALIACAO[avaliacao]}. Próxima revisão em ${formatarData(proximo.proxima_data)}.`, duracao: 4500 });

    // Segue para a próxima revisão do dia, se houver.
    const { data: proxima } = await sb
      .from("revisoes")
      .select("id")
      .eq("ativa", true)
      .lte("proxima_data", hoje)
      .neq("id", revisao.id)
      .order("proxima_data")
      .limit(1)
      .maybeSingle();
    router.push(proxima ? `/revisoes/${proxima.id}` : "/revisoes");
  }

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={item.titulo}
        voltarPara="/revisoes"
        acoesNaLinha
        subtitulo={
          <span className="inline-flex flex-wrap items-center gap-x-2">
            <Icone size={13} /> {TIPO_ITEM[revisao.item_tipo].rotulo}
            {item.materiaId && edital.nomeMateria.get(item.materiaId) && <span>· {edital.nomeMateria.get(item.materiaId)}</span>}
            <span>
              · Revisão {revisao.nivel + 1} de {INTERVALOS.length}
            </span>
          </span>
        }
      />

      <ol className="flex flex-col gap-6">
        <li className="flex flex-col gap-3">
          <p className="rounded-lg bg-hover px-4 py-3 text-[14px] leading-relaxed font-semibold whitespace-pre-line">{item.pergunta}</p>
          <Folha
            id="reescrita"
            numero={1}
            rotulo="Reescreva de memória"
            dica="Sem consultar. Não precisa estar perfeito: o objetivo é lembrar."
            valor={reescrita}
            aoMudar={setReescrita}
            linhasMinimas={8}
          />
        </li>

        <li className="flex flex-col gap-3">
          {!mostrando ? (
            <div>
              <Botao variante="primario" icone={<Eye size={15} />} onClick={() => setMostrando(true)}>
                Mostrar original
              </Botao>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="min-w-0 rounded-lg border border-borda p-4">
                <h2 className="text-[13px] font-extrabold">O que você escreveu agora</h2>
                <p className="mt-2 font-serif text-[16px] leading-relaxed whitespace-pre-line">
                  {reescrita.trim() || <span className="text-texto-2">Você não escreveu nada desta vez.</span>}
                </p>
              </section>
              <section className="min-w-0 rounded-lg border border-texto p-4">
                <h2 className="flex items-center justify-between gap-2 text-[13px] font-extrabold">
                  Original
                  <Link href={item.link} className="text-xs font-bold text-rosa-texto underline underline-offset-4">
                    Abrir
                  </Link>
                </h2>
                <div className="mt-2 flex flex-col gap-3 font-serif text-[16px] leading-relaxed">
                  {item.original.map((o) => (
                    <div key={o.rotulo}>
                      <p className="font-sans text-xs font-bold text-texto-2">{o.rotulo}</p>
                      <p className="whitespace-pre-line">{o.texto}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </li>

        {mostrando && (
          <li className="flex flex-col gap-3">
            <h2 className="text-[14px] font-extrabold">Como foi?</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["esqueci", "parcial", "bem"] as Avaliacao[]).map((a) => {
                const proximo = avaliar(revisao.nivel, a, hoje);
                return (
                  <button
                    key={a}
                    type="button"
                    disabled={salvando !== null}
                    onClick={() => registrar(a)}
                    className={`flex flex-col items-start gap-0.5 rounded-lg border-2 bg-superficie px-4 py-3 text-left transition-colors disabled:opacity-60 ${ESTILO_AVALIACAO[a]}`}
                  >
                    <span className="flex items-center gap-2 text-[14px] font-extrabold">
                      {salvando === a && <Loader2 size={15} className="animate-spin" />}
                      {ROTULO_AVALIACAO[a]}
                    </span>
                    <span className="tabular text-xs font-semibold text-texto-2">
                      Próxima em {rotuloIntervalo(proximo.nivel)} · {formatarData(proximo.proxima_data)}
                    </span>
                  </button>
                );
              })}
            </div>
          </li>
        )}
      </ol>

      {historico.length > 0 && (
        <details className="rounded-lg border border-borda p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-[13.5px] font-extrabold">
            <History size={15} /> Revisões anteriores ({historico.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {historico.map((h) => (
              <li key={h.id} className="border-t border-borda pt-3">
                <p className="tabular text-xs font-bold text-texto-2">
                  {formatarData(dataSP(h.created_at))} às {hora.format(new Date(h.created_at))} · {ROTULO_AVALIACAO[h.avaliacao]}
                </p>
                <p className="mt-1 font-serif text-[15px] leading-relaxed whitespace-pre-line">{h.reescrita || "Sem reescrita."}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
