"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, FileCheck2, History, PlayCircle, RotateCcw, Timer } from "lucide-react";
import { useConsulta } from "@/lib/useConsulta";
import { useTempoReal } from "@/lib/tempoReal";
import { dataSP, formatarData } from "@/lib/datas";
import type { RespostaQuestao, SimuladoProva } from "@/lib/tipos";
import { CabecalhoPagina } from "@/components/ui/Cabecalho";
import { Botao } from "@/components/ui/Botao";
import { EstadoErro, EstadoVazio, EsqueletoCards } from "@/components/ui/Estados";
import { Pill } from "@/components/ui/Selos";
import { estiloInput } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import { carregarBanco, criarTentativa, type QuestaoResumo } from "./dados";
import { placar, situacaoDa } from "./correcao";

const ESTILO: Record<SimuladoProva["estilo"], string> = {
  multipla: "Múltipla escolha (A a E)",
  certo_errado: "Certo ou errado",
};

function horas(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function SimuladosPagina() {
  const router = useRouter();
  const { avisar } = useToast();
  const { dados, carregando, erro, recarregar, atualizar } = useConsulta(carregarBanco);
  useTempoReal(["simulado_tentativas", "simulado_respostas", "simulado_provas", "simulado_questoes"], atualizar);
  const [banca, setBanca] = useState("");
  const [provaId, setProvaId] = useState("");
  const [materia, setMateria] = useState("");
  const [assunto, setAssunto] = useState("");
  const [so, setSo] = useState<"todas" | "nao_feitas" | "erradas">("todas");
  const [quantas, setQuantas] = useState("20");
  const [criando, setCriando] = useState(false);

  const provas = useMemo(() => dados?.provas ?? [], [dados]);
  const questoes = useMemo(() => dados?.questoes ?? [], [dados]);
  const provaPorId = useMemo(() => new Map(provas.map((p) => [p.id, p])), [provas]);

  // Última resposta dada a cada questão, em qualquer tentativa: serve para "não feitas" e "que errei".
  const ultima = useMemo(() => {
    const ordem = new Map((dados?.tentativas ?? []).map((t, i) => [t.id, i])); // 0 = mais recente
    const m = new Map<string, { resposta: string | null; pos: number }>();
    for (const r of dados?.respostas ?? []) {
      const pos = ordem.get(r.tentativa_id) ?? 1e9;
      const atual = m.get(r.questao_id);
      if (!atual || pos < atual.pos) m.set(r.questao_id, { resposta: r.resposta, pos });
    }
    return m;
  }, [dados]);

  const bancas = useMemo(() => [...new Set(provas.map((p) => p.banca))], [provas]);
  const doFiltroBase = useMemo(
    () => questoes.filter((q) => (!banca || provaPorId.get(q.prova_id)?.banca === banca) && (!provaId || q.prova_id === provaId)),
    [questoes, banca, provaId, provaPorId],
  );
  const materias = useMemo(() => [...new Set(doFiltroBase.map((q) => q.materia))], [doFiltroBase]);
  const assuntos = useMemo(() => [...new Set(doFiltroBase.filter((q) => !materia || q.materia === materia).map((q) => q.assunto))], [doFiltroBase, materia]);

  const filtradas = useMemo(
    () =>
      doFiltroBase.filter((q) => {
        if (materia && q.materia !== materia) return false;
        if (assunto && q.assunto !== assunto) return false;
        if (q.anulada) return false; // anulada não serve para treinar
        const u = ultima.get(q.id);
        if (so === "nao_feitas") return !u?.resposta;
        if (so === "erradas") {
          return Boolean(u?.resposta) && situacaoDa(q, u!.resposta as RespostaQuestao) === "errada";
        }
        return true;
      }),
    [doFiltroBase, materia, assunto, so, ultima],
  );
  const questaoPorId = useMemo(() => new Map(questoes.map((q) => [q.id, q])), [questoes]);

  async function comecar(modo: "prova" | "treino", prova?: SimuladoProva) {
    setCriando(true);
    try {
      const lista = modo === "prova" ? questoes.filter((q) => q.prova_id === prova!.id) : quantas === "todas" ? filtradas : filtradas.slice(0, Number(quantas));
      if (!lista.length) {
        avisar({ texto: "Nenhuma questão com esses filtros.", tipo: "erro" });
        setCriando(false);
        return;
      }
      const partes = [banca, provaId && provaPorId.get(provaId) ? `${provaPorId.get(provaId)!.ano}` : "", materia, assunto].filter(Boolean);
      const t = await criarTentativa({
        modo,
        prova_id: modo === "prova" ? prova!.id : null,
        titulo: modo === "prova" ? `${prova!.orgao} ${prova!.ano} · ${prova!.banca} · prova completa` : `Treino${partes.length ? `: ${partes.join(" · ")}` : ""}`,
        questao_ids: lista.map((q) => q.id),
      });
      router.push(`/simulados/${t.id}`);
    } catch {
      avisar({ texto: "Não deu para começar. Tente de novo.", tipo: "erro" });
      setCriando(false);
    }
  }

  if (erro) return <EstadoErro texto="Não deu para carregar os simulados." tentarDeNovo={recarregar} />;

  const emAndamento = (dados?.tentativas ?? []).filter((t) => !t.finalizada_em);
  const feitas = (dados?.tentativas ?? []).filter((t) => t.finalizada_em);

  return (
    <div className="flex flex-col">
      <CabecalhoPagina titulo="Simulados" subtitulo="Provas anteriores do TJDFT, na estrutura original do caderno" />

      {dados?.semTabela && (
        <p className="mt-4 rounded-md border border-alerta bg-alerta-suave px-3 py-2 text-[13px]" role="alert">
          Os simulados ficam disponíveis depois que o SQL 0005 for rodado no Supabase.
        </p>
      )}

      {carregando && !dados ? (
        <div className="mt-6">
          <EsqueletoCards />
        </div>
      ) : !provas.length ? (
        <div className="mt-6">
          <EstadoVazio
            icone={ClipboardList}
            titulo="As provas ainda não foram carregadas"
            texto="As provas de Técnico Judiciário – Área Administrativa do TJDFT (2022 FGV e 2015 Cebraspe) entram aqui transcritas dos cadernos e gabaritos definitivos oficiais. Assim que forem carregadas, aparecem nesta tela sozinhas, em todos os aparelhos."
            acao={
              <Link href="/configuracoes" className="text-[13px] font-bold text-rosa-texto underline underline-offset-4">
                Ver a situação do banco
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {emAndamento.length > 0 && (
            <section className="mt-6 rounded-lg border border-rosa/40 bg-rosa-suave/50 p-4">
              <h2 className="text-[14px] font-extrabold">Em andamento</h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {emAndamento.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="min-w-0 flex-1 text-[13.5px] font-semibold">{t.titulo}</span>
                    <span className="tabular text-xs text-texto-2">começado em {formatarData(dataSP(t.iniciada_em))}</span>
                    <Link href={`/simulados/${t.id}`} className="rounded-md bg-rosa px-3 py-1.5 text-xs font-bold text-white hover:brightness-95">
                      Continuar
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Provas completas */}
          <section aria-labelledby="titulo-provas" className="mt-6">
            <h2 id="titulo-provas" className="text-[15px] font-extrabold">
              Provas completas
            </h2>
            <p className="mt-0.5 text-[13px] text-texto-2">Mesma ordem, blocos, tempo e regra de pontuação do dia da prova.</p>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {provas.map((p) => {
                const qs = questoes.filter((q) => q.prova_id === p.id);
                const ultimaFeita = feitas.find((t) => t.prova_id === p.id);
                return (
                  <li key={p.id} className="flex flex-col gap-3 rounded-lg border border-borda-card bg-superficie p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[16px] font-extrabold">
                          {p.orgao} {p.ano} · {p.banca}
                        </p>
                        <p className="text-[13px] text-texto-2">{p.cargo}</p>
                      </div>
                      <Pill>{ESTILO[p.estilo]}</Pill>
                    </div>
                    <p className="tabular flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                      <span className="inline-flex items-center gap-1.5">
                        <FileCheck2 size={15} className="text-texto-2" /> {qs.length} {p.estilo === "certo_errado" ? "itens" : "questões"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Timer size={15} className="text-texto-2" /> {horas(p.duracao_min)}
                      </span>
                      {p.errada_desconta && <span className="font-semibold text-erro">Errada desconta uma certa</span>}
                    </p>
                    {p.estrutura.length > 0 && (
                      <ol className="flex flex-col gap-0.5 text-[12.5px] text-texto-2">
                        {p.estrutura.map((b) => (
                          <li key={b.nome} className="tabular">
                            <span className="font-semibold text-texto">{b.nome}</span> · {b.de} a {b.ate}
                          </li>
                        ))}
                        {p.discursiva && <li className="font-semibold text-texto">Prova discursiva (redação)</li>}
                      </ol>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-2">
                      <Botao variante="primario" icone={<PlayCircle size={15} />} onClick={() => comecar("prova", p)} disabled={criando || !qs.length}>
                        Fazer a prova
                      </Botao>
                      {ultimaFeita && (
                        <Link href={`/simulados/${ultimaFeita.id}`} className="text-[13px] font-bold text-rosa-texto underline underline-offset-4">
                          Ver último resultado
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Treino com filtros */}
          <section aria-labelledby="titulo-treino" className="mt-8 rounded-lg border border-borda-card bg-superficie p-4 sm:p-5">
            <h2 id="titulo-treino" className="text-[15px] font-extrabold">
              Treinar por filtro
            </h2>
            <p className="mt-0.5 text-[13px] text-texto-2">As questões vêm na ordem do caderno, com o texto de apoio. No treino, o gabarito aparece assim que você responde.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { id: "f-banca", rotulo: "Banca", valor: banca, opcoes: bancas.map((b) => [b, b]), mudar: (v: string) => (setBanca(v), setProvaId(""), setMateria(""), setAssunto("")) },
                {
                  id: "f-prova",
                  rotulo: "Prova",
                  valor: provaId,
                  opcoes: provas.filter((p) => !banca || p.banca === banca).map((p) => [p.id, `${p.ano} · ${p.banca}`]),
                  mudar: (v: string) => (setProvaId(v), setMateria(""), setAssunto("")),
                },
                { id: "f-materia", rotulo: "Matéria", valor: materia, opcoes: materias.map((m) => [m, m]), mudar: (v: string) => (setMateria(v), setAssunto("")) },
                { id: "f-assunto", rotulo: "Assunto", valor: assunto, opcoes: assuntos.map((a) => [a, a]), mudar: (v: string) => setAssunto(v) },
              ].map((f) => (
                <div key={f.id} className="flex flex-col gap-1.5">
                  <label htmlFor={f.id} className="text-[13px] font-semibold">
                    {f.rotulo}
                  </label>
                  <select id={f.id} className={estiloInput} value={f.valor} onChange={(e) => f.mudar(e.target.value)}>
                    <option value="">Todas</option>
                    {f.opcoes.map(([v, r]) => (
                      <option key={v} value={v}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">Quais questões</legend>
                {(
                  [
                    ["todas", "Todas"],
                    ["nao_feitas", "Que ainda não fiz"],
                    ["erradas", "Que errei"],
                  ] as const
                ).map(([v, r]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={so === v}
                    onClick={() => setSo(v)}
                    className={`h-9 rounded-full border px-3 text-[12.5px] font-semibold ${so === v ? "border-texto bg-texto text-fundo" : "border-borda text-texto-2 hover:bg-hover"}`}
                  >
                    {r}
                  </button>
                ))}
              </fieldset>
              <div className="flex items-center gap-2">
                <label htmlFor="f-quantas" className="text-[13px] font-semibold">
                  Quantas
                </label>
                <select id="f-quantas" className={`${estiloInput} w-28`} value={quantas} onChange={(e) => setQuantas(e.target.value)}>
                  {["10", "20", "30", "todas"].map((n) => (
                    <option key={n} value={n}>
                      {n === "todas" ? "Todas" : n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <span className="tabular text-[13px] text-texto-2">{filtradas.length} questões no filtro</span>
                <Botao variante="primario" icone={<RotateCcw size={15} />} onClick={() => comecar("treino")} disabled={criando || !filtradas.length}>
                  Começar treino
                </Botao>
              </div>
            </div>
          </section>

          {/* Histórico */}
          {feitas.length > 0 && (
            <section aria-labelledby="titulo-historico" className="mt-8">
              <h2 id="titulo-historico" className="flex items-center gap-2 text-[15px] font-extrabold">
                <History size={16} /> Histórico
              </h2>
              <ul className="mt-2 flex flex-col">
                {feitas.map((t) => {
                  const resp = (dados?.respostas ?? []).filter((r) => r.tentativa_id === t.id);
                  const porQ = new Map(resp.map((r) => [r.questao_id, r.resposta]));
                  const p = t.prova_id ? provaPorId.get(t.prova_id) : undefined;
                  const itens = t.questao_ids
                    .map((id) => questaoPorId.get(id))
                    .filter((q): q is QuestaoResumo => Boolean(q))
                    .map((q) => ({ situacao: situacaoDa(q, porQ.get(q.id) as RespostaQuestao | null) }));
                  const pl = placar(itens, p?.errada_desconta ?? false);
                  return (
                    <li key={t.id} className="border-b border-borda">
                      <Link href={`/simulados/${t.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 hover:bg-hover sm:px-2">
                        <span className="min-w-0 flex-1 text-[13.5px] font-semibold">{t.titulo}</span>
                        <span className="tabular text-[13px]">
                          {pl.certas + pl.anuladas} de {pl.total}
                        </span>
                        <Pill tipo={pl.pct === null ? "neutro" : pl.pct >= 75 ? "verde" : pl.pct >= 60 ? "amarelo" : "vermelho"}>{pl.pct === null ? "–" : `${Math.round(pl.pct)}%`}</Pill>
                        <span className="tabular text-xs text-texto-2">{formatarData(dataSP(t.finalizada_em!))}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
