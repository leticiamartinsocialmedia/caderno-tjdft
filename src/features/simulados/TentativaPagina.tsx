"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookX, CheckCircle2, ChevronLeft, ChevronRight, Flag, FileQuestion, PenLine, Timer, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useConsulta } from "@/lib/useConsulta";
import { useEditalBasico } from "@/lib/useEditalBasico";
import type { Erro, RespostaQuestao, SimuladoQuestao, SimuladoResposta } from "@/lib/tipos";
import { CabecalhoPagina } from "@/components/ui/Cabecalho";
import { Botao } from "@/components/ui/Botao";
import { EstadoErro, EstadoVazio, Esqueleto } from "@/components/ui/Estados";
import { Pill } from "@/components/ui/Selos";
import { BarraProgresso } from "@/components/ui/Barra";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ModalErro } from "@/features/erros/ModalErro";
import { materiaDaDisciplina } from "@/features/cronograma/gran";
import { carregarTentativa, salvarResposta } from "./dados";
import { ROTULO_RESPOSTA, formatarRelogio, placar, placarPor, situacaoDa, type Situacao } from "./correcao";

type Dados = NonNullable<Awaited<ReturnType<typeof carregarTentativa>>>;

export function TentativaPagina({ id }: { id: string }) {
  const { dados, setDados, carregando, erro, recarregar } = useConsulta(() => carregarTentativa(id), id);

  if (erro) return <EstadoErro texto="Não deu para abrir o simulado." tentarDeNovo={recarregar} />;
  if (carregando && !dados) {
    return (
      <div className="flex flex-col gap-4">
        <Esqueleto className="h-10 w-2/3" />
        <Esqueleto className="h-80" />
      </div>
    );
  }
  if (!dados) {
    return (
      <div className="flex flex-col gap-6">
        <CabecalhoPagina titulo="Simulado não encontrado" voltarPara="/simulados" />
        <EstadoVazio icone={FileQuestion} titulo="Este simulado não existe mais" texto="Ele pode ter sido apagado em outro aparelho." />
      </div>
    );
  }
  return dados.tentativa.finalizada_em ? <Resultado dados={dados} /> : <Resolver dados={dados} aoFinalizar={(d) => setDados(d)} />;
}

/* ------------------------------------------------------------------ */
/* Resolver                                                            */
/* ------------------------------------------------------------------ */

function Resolver({ dados, aoFinalizar }: { dados: Dados; aoFinalizar: (d: Dados) => void }) {
  const { avisar } = useToast();
  const { tentativa, prova, questoes, textos, provas } = dados;
  const treino = tentativa.modo === "treino";
  const [respostas, setRespostas] = useState(dados.respostas);
  const [indice, setIndice] = useState(() => {
    const primeiraEmBranco = questoes.findIndex((q) => !dados.respostas.get(q.id)?.resposta);
    return primeiraEmBranco < 0 ? 0 : primeiraEmBranco;
  });
  const [segundos, setSegundos] = useState(tentativa.segundos ?? 0);
  const [confirmar, setConfirmar] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const segundosRef = useRef(tentativa.segundos ?? 0);

  const q = questoes[indice];
  const limite = !treino && prova ? prova.duracao_min * 60 : null;

  const guardarTempo = useCallback(() => {
    void supabase().from("simulado_tentativas").update({ segundos: segundosRef.current }).eq("id", tentativa.id);
  }, [tentativa.id]);

  const finalizar = useCallback(async () => {
    setFinalizando(true);
    const finalizada_em = new Date().toISOString();
    const { error } = await supabase().from("simulado_tentativas").update({ finalizada_em, segundos: segundosRef.current }).eq("id", tentativa.id);
    if (error) {
      setFinalizando(false);
      avisar({ texto: "Não deu para finalizar. Tente de novo.", tipo: "erro" });
      return;
    }
    aoFinalizar({ ...dados, respostas, tentativa: { ...tentativa, finalizada_em, segundos: segundosRef.current } });
    window.scrollTo({ top: 0 });
  }, [aoFinalizar, avisar, dados, respostas, tentativa]);

  // O relógio chama a versão mais recente de finalizar quando o tempo da prova acaba.
  const finalizarRef = useRef(finalizar);
  useEffect(() => {
    finalizarRef.current = finalizar;
  }, [finalizar]);

  // Relógio: conta só com a aba aberta; guarda a cada 30 s e ao sair. Na prova, quando o tempo
  // acaba, entrega como no dia.
  useEffect(() => {
    let entregue = false;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible" || entregue) return;
      segundosRef.current += 1;
      setSegundos(segundosRef.current);
      if (limite !== null && segundosRef.current >= limite) {
        entregue = true;
        void finalizarRef.current();
        return;
      }
      if (segundosRef.current % 30 === 0) guardarTempo();
    }, 1000);
    const aoEsconder = () => document.visibilityState === "hidden" && guardarTempo();
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoEsconder);
      guardarTempo();
    };
  }, [guardarTempo, limite]);

  async function responder(questao: SimuladoQuestao, campos: Partial<Pick<SimuladoResposta, "resposta" | "marcada_para_revisar">>) {
    const antes = respostas.get(questao.id);
    const otimista = { id: antes?.id ?? "", tentativa_id: tentativa.id, questao_id: questao.id, resposta: antes?.resposta ?? null, marcada_para_revisar: antes?.marcada_para_revisar ?? false, ...campos };
    setRespostas(new Map(respostas).set(questao.id, otimista));
    try {
      const salvo = await salvarResposta(tentativa.id, questao.id, campos);
      setRespostas((m) => new Map(m).set(questao.id, salvo));
    } catch {
      setRespostas((m) => {
        const n = new Map(m);
        if (antes) n.set(questao.id, antes);
        else n.delete(questao.id);
        return n;
      });
      avisar({ texto: "Não deu para salvar a resposta. Confira a internet.", tipo: "erro" });
    }
  }

  const resposta = respostas.get(q.id)?.resposta ?? null;
  const travada = treino && Boolean(resposta); // no treino, respondeu = viu o gabarito
  const estiloDaQuestao = provas.get(q.prova_id)?.estilo ?? (q.alternativas ? "multipla" : "certo_errado");
  const texto = q.texto_id ? textos.get(q.texto_id) : undefined;
  const respondidas = questoes.filter((x) => respostas.get(x.id)?.resposta).length;
  const blocoAnterior = indice > 0 ? questoes[indice - 1].bloco : null;

  function escolher(letra: RespostaQuestao) {
    if (travada) return;
    void responder(q, { resposta: !treino && resposta === letra ? null : letra });
  }

  const situacao: Situacao | null = treino && resposta ? situacaoDa(q, resposta) : null;

  return (
    <div className="flex flex-col">
      <CabecalhoPagina
        titulo={tentativa.titulo}
        voltarPara="/simulados"
        subtitulo={
          <span className="tabular">
            {respondidas} de {questoes.length} respondidas
          </span>
        }
        acoes={
          <>
            <span
              className={`tabular inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-[14px] font-extrabold sm:h-9 ${
                limite !== null && limite - segundos < 15 * 60 ? "border-erro text-erro" : "border-borda"
              }`}
              title={limite !== null ? "Tempo restante" : "Tempo de treino"}
            >
              <Timer size={15} /> {formatarRelogio(limite !== null ? limite - segundos : segundos)}
            </span>
            <Botao variante="primario" onClick={() => setConfirmar(true)}>
              Finalizar
            </Botao>
          </>
        }
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="min-w-0">
          {(indice === 0 || blocoAnterior !== q.bloco) && (
            <p className="mb-3 rounded-md bg-texto px-3 py-2 text-[12.5px] font-extrabold tracking-wide text-fundo uppercase">{q.bloco}</p>
          )}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[17px] font-extrabold">{treino ? `${provas.get(q.prova_id)?.ano ?? ""} · Questão ${q.numero}` : `Questão ${q.numero}`}</h2>
            <span className="text-[13px] text-texto-2">
              {q.materia} · {q.assunto}
            </span>
            {treino && <span className="text-xs text-texto-2">{provas.get(q.prova_id)?.banca}</span>}
          </div>

          {texto && (
            <details className="mt-3 rounded-lg border border-borda-card bg-superficie" open>
              <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-bold">{texto.titulo ?? "Texto de apoio"}</summary>
              <div className="max-h-[50vh] overflow-y-auto border-t border-borda px-4 py-3 font-serif text-[15.5px] leading-relaxed whitespace-pre-line">{texto.conteudo}</div>
            </details>
          )}

          <p className="mt-4 text-[15.5px] leading-relaxed whitespace-pre-line">{q.enunciado}</p>

          {q.anulada && treino && <p className="mt-3 rounded-md bg-alerta-suave px-3 py-2 text-[13px] font-semibold text-alerta">Questão anulada pela banca.</p>}

          {estiloDaQuestao === "multipla" ? (
            <ul className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label={`Alternativas da questão ${q.numero}`}>
              {(q.alternativas ?? []).map((a) => {
                const marcada = resposta === a.letra;
                const correta = travada && a.letra === q.gabarito;
                const errada = travada && marcada && a.letra !== q.gabarito;
                return (
                  <li key={a.letra}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={marcada}
                      onClick={() => escolher(a.letra as RespostaQuestao)}
                      disabled={travada}
                      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left text-[15px] leading-relaxed transition-colors ${
                        correta ? "border-sucesso bg-sucesso-suave" : errada ? "border-erro bg-erro-suave" : marcada ? "border-texto bg-hover" : "border-borda hover:bg-hover"
                      }`}
                    >
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-extrabold ${
                          marcada ? "border-texto bg-texto text-fundo" : "border-borda"
                        }`}
                      >
                        {a.letra}
                      </span>
                      <span className="min-w-0 pt-0.5">{a.texto}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label={`Julgue o item ${q.numero}`}>
              {(["CERTO", "ERRADO"] as const).map((v) => {
                const marcada = resposta === v;
                const correta = travada && v === q.gabarito;
                const errada = travada && marcada && v !== q.gabarito;
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={marcada}
                    onClick={() => escolher(v)}
                    disabled={travada}
                    className={`h-12 min-w-32 rounded-lg border px-5 text-[15px] font-extrabold ${
                      correta ? "border-sucesso bg-sucesso-suave text-sucesso" : errada ? "border-erro bg-erro-suave text-erro" : marcada ? "border-texto bg-texto text-fundo" : "border-borda hover:bg-hover"
                    }`}
                  >
                    {ROTULO_RESPOSTA[v]}
                  </button>
                );
              })}
              {!treino && (
                <span className="self-center text-[12.5px] text-texto-2">Toque de novo para deixar em branco. Aqui, errar desconta um acerto.</span>
              )}
            </div>
          )}

          {situacao && (
            <p
              className={`mt-4 flex items-center gap-2 rounded-md px-3 py-2.5 text-[14px] font-bold ${
                situacao === "certa" || situacao === "anulada" ? "bg-sucesso-suave text-sucesso" : "bg-erro-suave text-erro"
              }`}
              role="status"
            >
              {situacao === "errada" ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
              {situacao === "certa" ? "Você acertou." : situacao === "anulada" ? "Questão anulada: conta como acerto." : `Gabarito: ${ROTULO_RESPOSTA[q.gabarito]}.`}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-borda pt-4">
            <Botao icone={<ChevronLeft size={15} />} onClick={() => setIndice((i) => Math.max(0, i - 1))} disabled={indice === 0}>
              Anterior
            </Botao>
            <Botao
              icone={<Flag size={15} />}
              onClick={() => void responder(q, { marcada_para_revisar: !respostas.get(q.id)?.marcada_para_revisar })}
              aria-pressed={Boolean(respostas.get(q.id)?.marcada_para_revisar)}
            >
              {respostas.get(q.id)?.marcada_para_revisar ? "Desmarcar" : "Marcar para revisar"}
            </Botao>
            <span className="ml-auto" />
            {indice < questoes.length - 1 ? (
              <Botao variante="primario" onClick={() => setIndice((i) => i + 1)}>
                Próxima <ChevronRight size={15} />
              </Botao>
            ) : (
              <Botao variante="primario" onClick={() => setConfirmar(true)}>
                Finalizar
              </Botao>
            )}
          </div>
        </article>

        {/* Folha de respostas */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-lg border border-borda-card bg-superficie p-3">
            <h2 className="text-[13px] font-extrabold">Folha de respostas</h2>
            <div className="mt-2">
              <BarraProgresso valor={(respondidas / questoes.length) * 100} rotulo={`${respondidas} de ${questoes.length} respondidas`} />
            </div>
            <ol className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(38px,1fr))] gap-1.5">
              {questoes.map((x, i) => {
                const r = respostas.get(x.id);
                const s = treino && r?.resposta ? situacaoDa(x, r.resposta) : null;
                return (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => setIndice(i)}
                      aria-current={i === indice ? "step" : undefined}
                      aria-label={`Questão ${x.numero}${r?.resposta ? `, respondida ${ROTULO_RESPOSTA[r.resposta]}` : ", em branco"}${r?.marcada_para_revisar ? ", marcada para revisar" : ""}`}
                      className={`tabular relative flex h-10 w-full flex-col items-center justify-center rounded-md border text-[12px] leading-none font-bold ${
                        s === "certa" || s === "anulada"
                          ? "border-sucesso bg-sucesso-suave text-sucesso"
                          : s === "errada"
                            ? "border-erro bg-erro-suave text-erro"
                            : r?.resposta
                              ? "border-texto bg-texto text-fundo"
                              : "border-borda hover:bg-hover"
                      } ${i === indice ? "outline-2 outline-offset-1 outline-rosa" : ""}`}
                    >
                      {x.numero}
                      {r?.resposta && !treino && <span className="mt-0.5 text-[10px] font-semibold">{r.resposta === "CERTO" ? "C" : r.resposta === "ERRADO" ? "E" : r.resposta}</span>}
                      {r?.marcada_para_revisar && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-rosa" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-texto-2">
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-texto" /> Respondida
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-rosa" /> Revisar
              </span>
            </p>
          </div>
        </aside>
      </div>

      {confirmar && (
        <Modal
          titulo="Finalizar o simulado?"
          fechar={() => setConfirmar(false)}
          rodape={
            <>
              <Botao onClick={() => setConfirmar(false)}>Continuar resolvendo</Botao>
              <Botao variante="primario" onClick={() => void finalizar()} disabled={finalizando}>
                Finalizar e ver o resultado
              </Botao>
            </>
          }
        >
          <p className="text-[14px] leading-relaxed">
            {questoes.length - respondidas === 0
              ? "Todas as questões foram respondidas."
              : `${questoes.length - respondidas} ${questoes.length - respondidas === 1 ? "questão ficou" : "questões ficaram"} em branco.`}{" "}
            {questoes.filter((x) => respostas.get(x.id)?.marcada_para_revisar).length > 0 &&
              `${questoes.filter((x) => respostas.get(x.id)?.marcada_para_revisar).length} marcadas para revisar.`}
          </p>
          <p className="mt-2 text-[13px] text-texto-2">Depois de finalizar, as respostas não mudam mais.</p>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Resultado                                                           */
/* ------------------------------------------------------------------ */

function Resultado({ dados }: { dados: Dados }) {
  const { avisar } = useToast();
  const edital = useEditalBasico();
  const { tentativa, prova, questoes, respostas, provas } = dados;
  const [filtro, setFiltro] = useState<"erradas" | "branco" | "todas">("erradas");
  const [anotar, setAnotar] = useState<SimuladoQuestao | null>(null);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());

  const itens = useMemo(
    () => questoes.map((q) => ({ q, resposta: respostas.get(q.id)?.resposta ?? null, situacao: situacaoDa(q, respostas.get(q.id)?.resposta), desconta: provas.get(q.prova_id)?.errada_desconta ?? false })),
    [questoes, respostas, provas],
  );
  // Treino pode misturar bancas: a nota soma cada questão pela regra da banca dela.
  const geral = useMemo(() => {
    const base = placar(itens, false);
    const descontos = itens.filter((i) => i.desconta && i.situacao === "errada").length;
    const nota = base.nota - descontos;
    return { ...base, nota, pct: base.total ? (nota / base.total) * 100 : null };
  }, [itens]);
  const descontaAlguma = itens.some((i) => i.desconta);
  const porBloco = useMemo(() => placarPor(itens, (i) => i.q.bloco, descontaAlguma), [itens, descontaAlguma]);
  const porMateria = useMemo(() => placarPor(itens, (i) => i.q.materia, descontaAlguma), [itens, descontaAlguma]);
  const porAssunto = useMemo(() => placarPor(itens, (i) => `${i.q.materia} · ${i.q.assunto}`, descontaAlguma).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0)), [itens, descontaAlguma]);

  const lista = itens.filter((i) => (filtro === "erradas" ? i.situacao === "errada" : filtro === "branco" ? i.situacao === "branco" : true));
  const materiaRedacao = materiaDaDisciplina("Redação", edital.materias);

  function textoDoErro(q: SimuladoQuestao) {
    const origem = `${provas.get(q.prova_id)?.orgao ?? "TJDFT"} ${provas.get(q.prova_id)?.ano ?? ""} · ${provas.get(q.prova_id)?.banca ?? ""} · questão ${q.numero}`;
    if (!q.alternativas) return `${q.enunciado}\n\n(${origem})`;
    const certa = q.alternativas.find((a) => a.letra === q.gabarito);
    return `${q.enunciado}\n\n${q.alternativas.map((a) => `${a.letra}) ${a.texto}`).join("\n")}\n\nGabarito: ${q.gabarito}${certa ? `) ${certa.texto}` : ""}\n(${origem})`;
  }

  return (
    <div className="flex flex-col">
      <CabecalhoPagina titulo={tentativa.titulo} voltarPara="/simulados" subtitulo={<span className="tabular">Tempo: {formatarRelogio(tentativa.segundos ?? 0)}</span>} />

      {/* Nota */}
      <section className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr]" aria-label="Nota">
        <div className="rounded-lg border border-borda-card bg-superficie p-4 sm:min-w-56">
          <p className="text-xs font-semibold text-texto-2">{descontaAlguma ? "Nota líquida (certas − erradas)" : "Acertos"}</p>
          <p className="tabular mt-1 text-[40px] leading-none font-extrabold">
            {geral.nota}
            <span className="text-[18px] font-bold text-texto-2"> / {geral.total}</span>
          </p>
          <p className="tabular mt-1 text-[13px] font-bold">{geral.pct === null ? "–" : `${Math.round(geral.pct)}%`}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Certas", geral.certas, "text-sucesso"],
            ["Erradas", geral.erradas, "text-erro"],
            ["Em branco", geral.brancos, ""],
            ["Anuladas", geral.anuladas, "text-texto-2"],
          ].map(([r, v, cor]) => (
            <div key={r as string} className="rounded-lg border border-borda-card p-3">
              <dt className="text-xs font-semibold text-texto-2">{r}</dt>
              <dd className={`tabular mt-1 text-[22px] font-extrabold ${cor}`}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Por bloco e por matéria */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {[
          { titulo: tentativa.modo === "prova" ? "Por bloco da prova" : "Por prova e bloco", grupos: porBloco },
          { titulo: "Por matéria", grupos: porMateria },
        ].map(({ titulo, grupos }) => (
          <section key={titulo} className="rounded-lg border border-borda-card bg-superficie p-4">
            <h2 className="text-[14px] font-extrabold">{titulo}</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {grupos.map((g) => (
                <li key={g.nome} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                  <span className="truncate text-[13px] font-semibold">{g.nome}</span>
                  <span className="tabular text-[12.5px] text-texto-2">
                    {g.certas + g.anuladas}/{g.total}
                  </span>
                  <span className="col-span-2">
                    <BarraProgresso
                      valor={Math.max(0, g.pct ?? 0)}
                      cor={(g.pct ?? 0) >= 75 ? "verde" : "rosa"}
                      rotulo={`${g.nome}: ${g.pct === null ? "sem questões" : `${Math.round(g.pct)}%`}`}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {porAssunto.some((a) => a.erradas > 0) && (
        <section className="mt-4 rounded-lg border border-borda-card bg-superficie p-4">
          <h2 className="text-[14px] font-extrabold">O que revisar primeiro</h2>
          <p className="mt-0.5 text-[13px] text-texto-2">Assuntos com mais erros neste simulado.</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {porAssunto
              .filter((a) => a.erradas > 0)
              .slice(0, 8)
              .map((a) => (
                <li key={a.nome}>
                  <Pill tipo="vermelho">
                    {a.nome} · {a.erradas} {a.erradas === 1 ? "erro" : "erros"}
                  </Pill>
                </li>
              ))}
          </ul>
        </section>
      )}

      {prova?.discursiva && (
        <section className="mt-4 rounded-lg border border-borda-card bg-superficie p-4">
          <h2 className="text-[14px] font-extrabold">Prova discursiva</h2>
          <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-line">{prova.discursiva}</p>
          <Link
            href={`/escrita/nova?formato=folha_branca${materiaRedacao ? `&materia=${materiaRedacao.id}` : ""}`}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-rosa px-3.5 text-[13px] font-bold text-white hover:brightness-95 sm:h-9"
          >
            <PenLine size={15} /> Escrever a redação
          </Link>
        </section>
      )}

      {/* Questões */}
      <section className="mt-6" aria-labelledby="titulo-questoes">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="titulo-questoes" className="text-[15px] font-extrabold">
            Questões
          </h2>
          <div className="flex gap-1.5" role="group" aria-label="Mostrar">
            {(
              [
                ["erradas", `Erradas (${geral.erradas})`],
                ["branco", `Em branco (${geral.brancos})`],
                ["todas", "Todas"],
              ] as const
            ).map(([v, r]) => (
              <button
                key={v}
                type="button"
                aria-pressed={filtro === v}
                onClick={() => setFiltro(v)}
                className={`h-9 rounded-full border px-3 text-[12.5px] font-semibold ${filtro === v ? "border-texto bg-texto text-fundo" : "border-borda text-texto-2 hover:bg-hover"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {lista.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-borda px-3 py-6 text-center text-[13px] text-texto-2">Nenhuma questão aqui.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {lista.map(({ q, resposta, situacao }) => {
              const aberta = abertas.has(q.id);
              return (
                <li key={q.id} className="rounded-lg border border-borda-card bg-superficie p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[14px] font-extrabold">Questão {q.numero}</span>
                    <span className="text-xs text-texto-2">
                      {q.materia} · {q.assunto}
                    </span>
                    <span className="ml-auto">
                      {situacao === "certa" ? (
                        <Pill tipo="verde">Certa</Pill>
                      ) : situacao === "errada" ? (
                        <Pill tipo="vermelho">Errada</Pill>
                      ) : situacao === "anulada" ? (
                        <Pill tipo="amarelo">Anulada</Pill>
                      ) : (
                        <Pill>Em branco</Pill>
                      )}
                    </span>
                  </div>
                  <p className={`mt-2 text-[14px] leading-relaxed whitespace-pre-line ${aberta ? "" : "line-clamp-4"}`}>{q.enunciado}</p>
                  {aberta && q.alternativas && (
                    <ul className="mt-2 flex flex-col gap-1 text-[13.5px]">
                      {q.alternativas.map((a) => (
                        <li
                          key={a.letra}
                          className={`rounded px-2 py-1 ${a.letra === q.gabarito ? "bg-sucesso-suave font-semibold text-sucesso" : a.letra === resposta ? "bg-erro-suave text-erro" : ""}`}
                        >
                          {a.letra}) {a.texto}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="tabular mt-2 text-[13px]">
                    Sua resposta: <b>{resposta ? ROTULO_RESPOSTA[resposta] : "em branco"}</b> · Gabarito: <b>{ROTULO_RESPOSTA[q.gabarito]}</b>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setAbertas((s) => new Set(s.has(q.id) ? [...s].filter((x) => x !== q.id) : [...s, q.id]))}
                      className="text-[13px] font-bold text-rosa-texto underline underline-offset-4"
                    >
                      {aberta ? "Mostrar menos" : "Ver a questão inteira"}
                    </button>
                    {(situacao === "errada" || situacao === "branco") && (
                      <button type="button" onClick={() => setAnotar(q)} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-rosa-texto underline underline-offset-4">
                        <BookX size={14} /> Anotar no Caderno de erros
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {anotar && (
        <ModalErro
          materias={edital.materias}
          topicos={edital.topicos}
          materiaInicial={materiaDaDisciplina(anotar.materia, edital.materias)?.id}
          preenchido={{
            assertiva: textoDoErro(anotar),
            gabarito: (anotar.alternativas ? "multipla" : anotar.gabarito === "CERTO" ? "certo" : "errado") as Erro["gabarito"],
          }}
          fechar={() => setAnotar(null)}
          aoSalvar={() => {
            setAnotar(null);
            avisar({ texto: "Erro anotado no Caderno de erros" });
          }}
        />
      )}
    </div>
  );
}
