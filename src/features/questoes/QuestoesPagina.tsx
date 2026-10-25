"use client";

import { useMemo, useState } from "react";
import { BarChart3, ListChecks, Pause, Pencil, Play, Plus, Square, Table2, Timer, Trash2, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useConsulta } from "@/lib/useConsulta";
import { useTempoReal } from "@/lib/tempoReal";
import { buscarTodos, useEditalBasico } from "@/lib/useEditalBasico";
import { formatarData } from "@/lib/datas";
import { corAcerto, evolucaoSemanal, formatarMinutos, formatarPct, pctAcerto, porMateria, somar } from "@/lib/desempenho";
import { formatarRelogio, useCronometroEstudo } from "@/lib/cronometro";
import type { Sessao } from "@/lib/tipos";
import { Abas, CabecalhoPagina } from "@/components/ui/Cabecalho";
import { Botao, BotaoIcone } from "@/components/ui/Botao";
import { EstadoErro, EstadoVazio, EsqueletoLista } from "@/components/ui/Estados";
import { Pill } from "@/components/ui/Selos";
import { GraficoLinhaPct } from "@/components/ui/Graficos";
import { useToast } from "@/components/ui/Toast";
import { ROTULO_ATIVIDADE } from "./atividades";
import { ModalSessao } from "./ModalSessao";

type Aba = "sessoes" | "materias" | "evolucao";
const POR_PAGINA = 40;

export function PillAcerto({ pct }: { pct: number | null }) {
  const cor = corAcerto(pct);
  if (cor === "neutro") return <span className="text-xs text-texto-2">—</span>;
  return <Pill tipo={cor}>{formatarPct(pct)}</Pill>;
}

export function QuestoesPagina() {
  const { avisar, excluirComDesfazer } = useToast();
  const edital = useEditalBasico();
  const cronometro = useCronometroEstudo();
  const { dados, setDados, carregando, erro, recarregar, atualizar } = useConsulta(() =>
    buscarTodos<Sessao>((de, ate) =>
      supabase().from("sessoes").select("*").order("data", { ascending: false }).order("created_at", { ascending: false }).range(de, ate),
    ),
  );
  useTempoReal(["sessoes"], atualizar);
  const [aba, setAba] = useState<Aba>("sessoes");
  const [modal, setModal] = useState<{ sessao?: Sessao; minutos?: number } | null>(null);
  const [limite, setLimite] = useState(POR_PAGINA);

  const sessoes = useMemo(() => dados ?? [], [dados]);
  const total = useMemo(() => somar(sessoes), [sessoes]);
  const materias = useMemo(() => {
    const mapa = porMateria(sessoes);
    return [...mapa]
      .map(([id, t]) => ({ id, nome: id ? (edital.nomeMateria.get(id) ?? "Matéria excluída") : "Sem matéria", ...t }))
      .sort((a, b) => b.minutos - a.minutos);
  }, [sessoes, edital.nomeMateria]);
  const evolucao = useMemo(() => evolucaoSemanal(sessoes), [sessoes]);

  function excluir(s: Sessao) {
    const copia = sessoes;
    excluirComDesfazer({
      texto: "Sessão excluída",
      esconder: () => setDados(copia.filter((x) => x.id !== s.id)),
      restaurar: () => setDados(copia),
      apagar: async () => {
        const { error } = await supabase().from("sessoes").delete().eq("id", s.id);
        if (error) throw error;
      },
    });
  }

  return (
    <div className="flex flex-col">
      <CabecalhoPagina
        titulo="Questões"
        subtitulo="Registre cada sessão de estudo para ver tempo e acerto por matéria."
        acoes={
          <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setModal({})}>
            Registrar sessão
          </Botao>
        }
      />

      {/* Cronômetro de estudo */}
      <section
        aria-label="Cronômetro de estudo"
        className={`mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border p-4 ${cronometro.rodando ? "border-rosa" : "border-borda"}`}
      >
        <Timer size={22} className={cronometro.rodando ? "text-rosa-texto" : "text-texto-2"} />
        <div>
          <p className="tabular text-[30px] leading-none font-extrabold">{formatarRelogio(cronometro.ms)}</p>
          <p className="mt-1 text-[12.5px] text-texto-2">
            {cronometro.rodando ? "Contando. Pode trocar de tela que ele continua." : cronometro.ms > 0 ? "Pausado." : "Cronômetro de estudo"}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {cronometro.rodando ? (
            <Botao icone={<Pause size={15} />} onClick={cronometro.pausar}>
              Pausar
            </Botao>
          ) : (
            <Botao variante={cronometro.ms > 0 ? "secundario" : "primario"} icone={<Play size={15} />} onClick={cronometro.iniciar}>
              {cronometro.ms > 0 ? "Continuar" : "Iniciar"}
            </Botao>
          )}
          {cronometro.ms > 0 && (
            <Botao
              variante="primario"
              icone={<Square size={14} />}
              onClick={() => {
                const minutos = cronometro.parar();
                setModal({ minutos });
              }}
            >
              Parar e registrar
            </Botao>
          )}
        </div>
      </section>

      {/* Totais */}
      {sessoes.length > 0 && (
        <dl className="mt-5 grid grid-cols-3 gap-3">
          {[
            { rotulo: "Tempo estudado", valor: formatarMinutos(total.minutos) },
            { rotulo: "Questões feitas", valor: total.questoes.toLocaleString("pt-BR") },
            { rotulo: "Acerto geral", valor: formatarPct(total.pct) },
          ].map((t) => (
            <div key={t.rotulo} className="rounded-lg border border-borda-card p-3 sm:p-4">
              <dt className="text-xs font-semibold text-texto-2">{t.rotulo}</dt>
              <dd className="tabular mt-1 text-[16px] font-extrabold whitespace-nowrap sm:text-[24px]">{t.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      <Abas<Aba>
        abas={[
          { id: "sessoes", rotulo: "Sessões", icone: ListChecks, contagem: sessoes.length },
          { id: "materias", rotulo: "Por matéria", icone: Table2 },
          { id: "evolucao", rotulo: "Evolução", icone: TrendingUp },
        ]}
        ativa={aba}
        aoTrocar={setAba}
      />

      <div className="mt-4">
        {erro ? (
          <EstadoErro texto="Não deu para carregar as sessões." tentarDeNovo={recarregar} />
        ) : carregando && !dados ? (
          <EsqueletoLista />
        ) : sessoes.length === 0 ? (
          <EstadoVazio
            icone={BarChart3}
            titulo="Nenhuma sessão registrada"
            texto="Use o cronômetro enquanto estuda ou registre depois: data, matéria, minutos, questões e acertos."
            acao={
              <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setModal({})}>
                Registrar sessão
              </Botao>
            }
          />
        ) : aba === "sessoes" ? (
          <>
            <ul className="flex flex-col">
              <li className="hidden grid-cols-[96px_minmax(0,1fr)_130px_80px_70px_70px_80px_76px] gap-3 border-b border-borda px-2 pb-2.5 text-xs font-semibold text-texto-2 lg:grid">
                <span>Data</span>
                <span>Matéria e tópico</span>
                <span>Atividade</span>
                <span className="text-right">Tempo</span>
                <span className="text-right">Questões</span>
                <span className="text-right">Acertos</span>
                <span>Acerto</span>
                <span />
              </li>
              {sessoes.slice(0, limite).map((s) => (
                <li
                  key={s.id}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-borda px-2 py-3 transition-colors hover:bg-hover lg:grid-cols-[96px_minmax(0,1fr)_130px_80px_70px_70px_80px_76px]"
                >
                  <span className="tabular text-[13px] font-semibold lg:font-normal">{formatarData(s.data)}</span>
                  <span className="col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:row-start-auto">
                    <span className="block truncate text-[13.5px] font-semibold">
                      {s.materia_id ? (edital.nomeMateria.get(s.materia_id) ?? "Matéria excluída") : "Sem matéria"}
                    </span>
                    {(s.topico_id || s.observacao) && (
                      <span className="block truncate text-xs text-texto-2">
                        {[s.topico_id && edital.nomeTopico.get(s.topico_id), s.observacao].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="col-span-2 row-start-3 flex flex-wrap items-center gap-x-3 text-[12.5px] text-texto-2 lg:contents">
                    <span className="lg:text-[13px]">{ROTULO_ATIVIDADE[s.atividade]}</span>
                    <span className="tabular lg:text-right lg:text-[13px] lg:text-texto">{formatarMinutos(s.minutos)}</span>
                    <span className="tabular lg:text-right lg:text-[13px] lg:text-texto">
                      {s.questoes}
                      <span className="lg:hidden"> questões</span>
                    </span>
                    <span className="tabular lg:text-right lg:text-[13px] lg:text-texto">
                      {s.acertos}
                      <span className="lg:hidden"> acertos</span>
                    </span>
                    <span>
                      <PillAcerto pct={pctAcerto(s.acertos, s.questoes)} />
                    </span>
                  </span>
                  <span className="col-start-2 row-start-1 flex justify-end gap-0.5 opacity-100 transition-opacity lg:col-start-auto lg:row-start-auto lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                    <BotaoIcone rotulo="Editar sessão" onClick={() => setModal({ sessao: s })}>
                      <Pencil size={15} />
                    </BotaoIcone>
                    <BotaoIcone rotulo="Excluir sessão" onClick={() => excluir(s)} className="hover:text-erro">
                      <Trash2 size={15} />
                    </BotaoIcone>
                  </span>
                </li>
              ))}
            </ul>
            {limite < sessoes.length && (
              <div className="mt-5 flex justify-center">
                <Botao onClick={() => setLimite((l) => l + POR_PAGINA)}>Mostrar mais</Botao>
              </div>
            )}
          </>
        ) : aba === "materias" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b border-borda text-xs font-semibold text-texto-2">
                  <th className="py-2.5 pr-4 pl-2 font-semibold">Matéria</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Tempo</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Questões</th>
                  <th className="py-2.5 pr-2 font-semibold">Acerto</th>
                </tr>
              </thead>
              <tbody>
                {materias.map((m) => (
                  <tr key={m.id ?? "sem"} className="border-b border-borda hover:bg-hover">
                    <td className="py-3 pr-4 pl-2 text-[13.5px] font-semibold">{m.nome}</td>
                    <td className="tabular py-3 pr-4 text-right text-[13px]">{formatarMinutos(m.minutos)}</td>
                    <td className="tabular py-3 pr-4 text-right text-[13px]">{m.questoes}</td>
                    <td className="py-3 pr-2">
                      <PillAcerto pct={m.pct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-texto-2">Verde a partir de 75%, amarelo de 60% a 74% e vermelho abaixo de 60%.</p>
          </div>
        ) : evolucao.length === 0 ? (
          <EstadoVazio icone={TrendingUp} titulo="Ainda sem questões registradas" texto="O gráfico aparece quando você registrar sessões com questões." />
        ) : (
          <section aria-label="Evolução do acerto por semana" className="rounded-lg border border-borda p-4">
            <h2 className="text-[14px] font-extrabold">% de acerto por semana</h2>
            <p className="text-[12.5px] text-texto-2">Cada ponto é uma semana, de segunda a domingo.</p>
            <div className="mt-4">
              <GraficoLinhaPct
                titulo="Percentual de acerto por semana"
                guias={[
                  { valor: 75, rotulo: "75%" },
                  { valor: 60, rotulo: "60%" },
                ]}
                pontos={evolucao.map((s) => ({
                  chave: s.semana,
                  rotulo: formatarData(s.semana).slice(0, 5),
                  valor: s.pct ?? 0,
                  dica: (
                    <>
                      <strong className="tabular">{formatarPct(s.pct)}</strong>{" "}
                      <span className="text-texto-2">
                        semana de {formatarData(s.semana)} · {s.acertos} de {s.questoes}
                      </span>
                    </>
                  ),
                }))}
              />
            </div>
          </section>
        )}
      </div>

      {modal && (
        <ModalSessao
          sessao={modal.sessao}
          minutosIniciais={modal.minutos}
          materias={edital.materias}
          topicos={edital.topicos}
          fechar={() => setModal(null)}
          aoSalvar={(s, nova) => {
            setDados(nova ? [s, ...sessoes].sort((a, b) => b.data.localeCompare(a.data)) : sessoes.map((x) => (x.id === s.id ? s : x)));
            setModal(null);
            avisar({ texto: nova ? "Sessão registrada" : "Sessão atualizada" });
          }}
        />
      )}
    </div>
  );
}
