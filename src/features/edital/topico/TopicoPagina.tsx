"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookA,
  BookX,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileQuestion,
  Info,
  Layers,
  Lightbulb,
  ListChecks,
  NotebookText,
  PenLine,
  Plus,
  PlayCircle,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { exigir, useConsulta } from "@/lib/useConsulta";
import { useTempoReal } from "@/lib/tempoReal";
import { buscarTodos, useEditalBasico } from "@/lib/useEditalBasico";
import { dataSP, formatarData, hojeSP } from "@/lib/datas";
import { formatarMinutos, formatarPct, pctAcerto, somar } from "@/lib/desempenho";
import { TextoGrifado } from "@/lib/grifo";
import { porNaRevisao } from "@/lib/filaRevisao";
import type { Bisu, Erro, Escrita, Material, Materia, Resumo, Revisao, Sessao, StatusTopico, Termo, TermoRelacionado, Topico } from "@/lib/tipos";
import { Abas, CabecalhoPagina } from "@/components/ui/Cabecalho";
import { Botao } from "@/components/ui/Botao";
import { MenuAcoes } from "@/components/ui/Menu";
import { EstadoErro, EstadoVazio, Esqueleto } from "@/components/ui/Estados";
import { Badge, BadgeCaiMuito, Pill } from "@/components/ui/Selos";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/components/shell/AppContext";
import { ORDEM_STATUS, ROTULO_STATUS } from "@/features/edital/status";
import { PillStatus } from "@/features/edital/MateriaPagina";
import { diagnosticar, type Recomendacao } from "@/features/edital/diagnostico";
import { FORMATOS, FORMATO_POR_ID } from "@/features/escrita/formatos";
import { PontosDominio } from "@/features/escrita/Dominio";
import { ROTULO_FONTE } from "@/features/bisus/fontes";
import { ModalBisu } from "@/features/bisus/ModalBisu";
import { ModalErro } from "@/features/erros/ModalErro";
import { ROTULO_MOTIVO } from "@/features/erros/motivos";
import { ModalSessao } from "@/features/questoes/ModalSessao";
import { PillAcerto } from "@/features/questoes/QuestoesPagina";
import { ROTULO_ATIVIDADE } from "@/features/questoes/atividades";
import { ModalTermo } from "@/features/nomenclatura/ModalTermo";
import { Flashcards } from "@/features/nomenclatura/Flashcards";
import { ROTULO_GABARITO } from "@/features/revisoes/dados";
import { AbaMateriais } from "./AbaMateriais";
import { AbaResumos } from "./AbaResumos";

type Aba = "materiais" | "resumos" | "escritas" | "bisus" | "questoes" | "nomenclatura" | "flashcards" | "erros";

async function carregar(id: string) {
  const sb = supabase();
  const topico = exigir(await sb.from("topicos").select("*").eq("id", id).maybeSingle()) as Topico | null;
  if (!topico) return null;
  const [materia, materiais, resumos, escritas, bisus, sessoes, erros, termos, rel] = await Promise.all([
    sb.from("materias").select("*").eq("id", topico.materia_id).maybeSingle(),
    sb.from("materiais").select("*").eq("topico_id", id).order("ordem"),
    sb.from("resumos").select("*").eq("topico_id", id).order("updated_at", { ascending: false }),
    sb.from("escritas").select("*").eq("topico_id", id).order("updated_at", { ascending: false }),
    sb.from("bisus").select("*").eq("topico_id", id).order("created_at", { ascending: false }),
    sb.from("sessoes").select("*").eq("topico_id", id).order("data", { ascending: false }),
    sb.from("erros").select("*").eq("topico_id", id).order("created_at", { ascending: false }),
    buscarTodos<Termo>((de, ate) => sb.from("termos").select("*").order("termo").range(de, ate)),
    sb.from("termos_relacionados").select("termo_id, relacionado_id"),
  ]);
  const doTopico = termos.filter((t) => (t.topico_ids ?? []).includes(id));
  const itens = [...(exigir(escritas) as Escrita[]).map((e) => e.id), ...(exigir(erros) as Erro[]).map((e) => e.id), ...doTopico.map((t) => t.id)];
  const revisoes = itens.length
    ? (exigir(await sb.from("revisoes").select("*").eq("ativa", true).in("item_id", itens.slice(0, 150))) as Revisao[])
    : [];
  return {
    topico,
    materia: exigir(materia) as Materia | null,
    // As tabelas novas só existem depois do SQL 0003: sem elas, a página funciona com listas vazias.
    materiais: (materiais.error ? [] : materiais.data) as Material[],
    resumos: (resumos.error ? [] : resumos.data) as Resumo[],
    escritas: exigir(escritas) as Escrita[],
    bisus: exigir(bisus) as Bisu[],
    sessoes: exigir(sessoes) as Sessao[],
    erros: exigir(erros) as Erro[],
    termos: doTopico,
    todosTermos: termos,
    relacionados: exigir(rel) as TermoRelacionado[],
    revisoes,
    semTabelasNovas: Boolean(materiais.error || resumos.error),
  };
}

const ESTILO_NIVEL: Record<Recomendacao["nivel"], { borda: string; icone: typeof AlertTriangle; cor: string }> = {
  alerta: { borda: "border-erro/50 bg-erro-suave", icone: AlertTriangle, cor: "text-erro" },
  atencao: { borda: "border-alerta/50 bg-alerta-suave", icone: Info, cor: "text-alerta" },
  ok: { borda: "border-sucesso/40 bg-sucesso-suave", icone: CheckCircle2, cor: "text-sucesso" },
};

export function TopicoPagina({ id }: { id: string }) {
  const router = useRouter();
  const { usuario } = useApp();
  const { avisar } = useToast();
  const edital = useEditalBasico();
  const { dados, setDados, carregando, erro, recarregar, atualizar } = useConsulta(() => carregar(id), id);
  useTempoReal(
    ["topicos", "materiais", "resumos", "escritas", "bisus", "sessoes", "erros", "termos", "termos_relacionados", "revisoes"],
    atualizar,
  );
  const [aba, setAba] = useState<Aba>("materiais");
  const [modal, setModal] = useState<null | "bisu" | "erro" | "sessao" | "termo">(null);
  const [bisuEditando, setBisuEditando] = useState<Bisu | undefined>();
  const [erroEditando, setErroEditando] = useState<Erro | undefined>();

  const hoje = hojeSP();
  const revisoesHoje = useMemo(() => (dados?.revisoes ?? []).filter((r) => r.proxima_data <= hoje), [dados, hoje]);
  const recomendacoes = useMemo(
    () =>
      dados
        ? diagnosticar({
            status: dados.topico.status,
            sessoes: dados.sessoes,
            erros: dados.erros,
            escritas: dados.escritas,
            termosAprendendo: dados.termos.filter((t) => t.status === "aprendendo").length,
            revisoesHoje: revisoesHoje.length,
            materiais: dados.materiais.length,
          })
        : [],
    [dados, revisoesHoje],
  );

  if (erro) return <EstadoErro texto="Não deu para abrir o tópico." tentarDeNovo={recarregar} />;
  if (carregando && !dados) {
    return (
      <div className="flex flex-col gap-4">
        <Esqueleto className="h-10 w-2/3" />
        <Esqueleto className="h-32" />
        <Esqueleto className="h-64" />
      </div>
    );
  }
  if (!dados) {
    return (
      <div className="flex flex-col gap-6">
        <CabecalhoPagina titulo="Tópico não encontrado" voltarPara="/edital" />
        <EstadoVazio icone={FileQuestion} titulo="Este tópico não existe mais" texto="Ele pode ter sido excluído em outro aparelho." />
      </div>
    );
  }

  const { topico, materia } = dados;
  const query = `materia=${topico.materia_id}&topico=${topico.id}`;
  const totais = somar(dados.sessoes);
  const errosPendentes = dados.erros.filter((e) => !e.revisado);

  function trocar<K extends keyof NonNullable<typeof dados>>(chave: K, valor: NonNullable<typeof dados>[K]) {
    if (dados) setDados({ ...dados, [chave]: valor });
  }

  async function mudarStatus(status: StatusTopico) {
    const antes = topico.status;
    trocar("topico", { ...topico, status });
    const { error } = await supabase().from("topicos").update({ status }).eq("id", topico.id);
    if (error) {
      trocar("topico", { ...topico, status: antes });
      avisar({ texto: "Não deu para mudar o status.", tipo: "erro" });
    }
  }

  async function executar(r: Recomendacao) {
    switch (r.acao) {
      case "revisoes":
        router.push(revisoesHoje[0] ? `/revisoes/${revisoesHoje[0].id}` : "/revisoes");
        break;
      case "revisar-erros":
        try {
          await Promise.all(errosPendentes.map((e) => porNaRevisao(usuario.id, "erro", e.id)));
          avisar({ texto: `${errosPendentes.length} ${errosPendentes.length === 1 ? "erro entrou" : "erros entraram"} na fila de revisões` });
        } catch {
          avisar({ texto: "Não deu para pôr os erros na revisão.", tipo: "erro" });
        }
        break;
      case "escrita-feynman":
        router.push(`/escrita/nova?formato=feynman&${query}`);
        break;
      case "nova-escrita":
        router.push(`/escrita/nova?${query}`);
        break;
      case "registrar-sessao":
        setModal("sessao");
        break;
      case "flashcards":
        setAba("flashcards");
        break;
      case "materiais":
        setAba("materiais");
        break;
    }
  }

  async function alternarErro(e: Erro) {
    const lista = dados!.erros;
    trocar("erros", lista.map((x) => (x.id === e.id ? { ...x, revisado: !x.revisado } : x)));
    const { error } = await supabase().from("erros").update({ revisado: !e.revisado }).eq("id", e.id);
    if (error) {
      trocar("erros", lista);
      avisar({ texto: "Não deu para salvar.", tipo: "erro" });
    }
  }

  const abas: { id: Aba; rotulo: string; icone: typeof PlayCircle; contagem?: number }[] = [
    { id: "materiais", rotulo: "Materiais", icone: PlayCircle, contagem: dados.materiais.length },
    { id: "resumos", rotulo: "Resumos", icone: NotebookText, contagem: dados.resumos.length },
    { id: "escritas", rotulo: "Escritas", icone: PenLine, contagem: dados.escritas.length },
    { id: "bisus", rotulo: "Bisus", icone: Lightbulb, contagem: dados.bisus.length },
    { id: "questoes", rotulo: "Questões", icone: ListChecks, contagem: totais.questoes },
    { id: "nomenclatura", rotulo: "Nomenclatura", icone: BookA, contagem: dados.termos.length },
    { id: "flashcards", rotulo: "Flashcards", icone: Layers },
    { id: "erros", rotulo: "Erros", icone: BookX, contagem: errosPendentes.length },
  ];

  return (
    <div className="flex flex-col">
      <CabecalhoPagina
        titulo={topico.nome}
        voltarPara={`/edital/${topico.materia_id}`}
        subtitulo={materia?.nome}
        acoes={
          <>
            <div className="flex items-center gap-0.5 rounded-full">
              <PillStatus status={topico.status} />
              <MenuAcoes
                rotulo="Mudar status"
                gatilho={<ChevronDown size={15} />}
                itens={ORDEM_STATUS.map((s) => ({
                  rotulo: ROTULO_STATUS[s],
                  marcado: topico.status === s,
                  icone: <Check size={15} className={topico.status === s ? "" : "invisible"} />,
                  aoClicar: () => mudarStatus(s),
                }))}
              />
            </div>
            <MenuAcoes
              rotulo="Adicionar ao tópico"
              gatilho={
                <span className="inline-flex h-10 items-center gap-2 rounded-md border border-borda bg-superficie px-3.5 text-[13px] font-bold text-texto hover:bg-hover sm:h-9">
                  <Plus size={15} /> Adicionar
                </span>
              }
              itens={[
                { rotulo: "Bisu", icone: <Lightbulb size={15} />, aoClicar: () => { setBisuEditando(undefined); setModal("bisu"); } },
                { rotulo: "Erro de questão", icone: <BookX size={15} />, aoClicar: () => { setErroEditando(undefined); setModal("erro"); } },
                { rotulo: "Sessão de questões", icone: <ListChecks size={15} />, aoClicar: () => setModal("sessao") },
                { rotulo: "Termo da nomenclatura", icone: <BookA size={15} />, aoClicar: () => setModal("termo") },
                { rotulo: "Material ou resumo", icone: <PlayCircle size={15} />, aoClicar: () => setAba("materiais") },
              ]}
            />
            <Link
              href={`/escrita/nova?${query}`}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-rosa px-3.5 text-[13px] font-bold text-white hover:brightness-95 sm:h-9"
            >
              <PenLine size={15} /> Escrever
            </Link>
          </>
        }
      />

      {dados.semTabelasNovas && (
        <p className="mt-4 rounded-md border border-alerta bg-alerta-suave px-3 py-2 text-[13px]" role="alert">
          Materiais, resumos e anexos ficam disponíveis depois que o SQL 0003 for rodado no Supabase.
        </p>
      )}

      {/* Números do tópico */}
      <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { r: "Acerto nas questões", v: <PillAcerto pct={pctAcerto(totais.acertos, totais.questoes)} />, d: `${totais.questoes} questões` },
          { r: "Tempo estudado", v: formatarMinutos(totais.minutos), d: `${dados.sessoes.length} ${dados.sessoes.length === 1 ? "sessão" : "sessões"}` },
          { r: "Erros para revisar", v: String(errosPendentes.length), d: `${dados.erros.length} no total` },
          { r: "Revisões hoje", v: String(revisoesHoje.length), d: `${dados.revisoes.length} programadas` },
        ].map((x) => (
          <div key={x.r} className="rounded-lg border border-borda-card p-3">
            <dt className="text-xs font-semibold text-texto-2">{x.r}</dt>
            <dd className="tabular mt-1 text-[20px] font-extrabold">{x.v}</dd>
            <dd className="tabular text-xs text-texto-2">{x.d}</dd>
          </div>
        ))}
      </dl>

      {/* O que revisar */}
      <section aria-labelledby="titulo-revisar" className="mt-5">
        <h2 id="titulo-revisar" className="text-[15px] font-extrabold">
          O que revisar
        </h2>
        <ul className="mt-2 grid gap-2 md:grid-cols-2">
          {recomendacoes.map((r) => {
            const estilo = ESTILO_NIVEL[r.nivel];
            const Icone = estilo.icone;
            return (
              <li key={r.id} className={`flex gap-3 rounded-lg border p-3 ${estilo.borda}`}>
                <Icone size={18} className={`mt-0.5 shrink-0 ${estilo.cor}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-extrabold">{r.titulo}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed">{r.texto}</p>
                  {r.acao && r.rotuloAcao && (
                    <button type="button" onClick={() => executar(r)} className="mt-1.5 text-[13px] font-bold text-rosa-texto underline underline-offset-4">
                      {r.rotuloAcao}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <Abas<Aba> abas={abas} ativa={aba} aoTrocar={setAba} />

      <div className="mt-4">
        {aba === "materiais" && <AbaMateriais topicoId={topico.id} materiais={dados.materiais} aoMudar={(l) => trocar("materiais", l)} />}
        {aba === "resumos" && <AbaResumos topicoId={topico.id} resumos={dados.resumos} aoMudar={(l) => trocar("resumos", l)} />}

        {aba === "escritas" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {FORMATOS.map((f) => {
                const Icone = f.icone;
                return (
                  <Link
                    key={f.id}
                    href={`/escrita/nova?formato=${f.id}&${query}`}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-borda px-3 text-[13px] font-bold hover:bg-hover sm:h-9"
                  >
                    <Icone size={15} /> {f.nome}
                  </Link>
                );
              })}
            </div>
            {dados.escritas.length === 0 ? (
              <EstadoVazio icone={PenLine} titulo="Nenhuma escrita sobre este tópico" texto="Escolha um formato acima. Ao guardar, a escrita entra nas revisões." />
            ) : (
              <ul className="flex flex-col">
                {dados.escritas.map((e) => (
                  <li key={e.id} className="border-b border-borda">
                    <Link href={`/escrita/${e.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:bg-hover sm:px-2">
                      <span className="min-w-0 flex-1 text-[13.5px] font-semibold underline decoration-borda underline-offset-4">
                        {e.titulo || FORMATO_POR_ID[e.formato].nome}
                      </span>
                      <span className="text-xs text-texto-2">{FORMATO_POR_ID[e.formato].nome}</span>
                      <PontosDominio valor={e.dominio} />
                      {e.rascunho ? <Pill>Rascunho</Pill> : <Pill tipo="concluido">Guardada</Pill>}
                      <span className="tabular text-xs text-texto-2">{formatarData(dataSP(e.updated_at))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {aba === "bisus" && (
          <div className="flex flex-col gap-4">
            <div>
              <Botao variante="primario" icone={<Plus size={15} />} onClick={() => { setBisuEditando(undefined); setModal("bisu"); }}>
                Adicionar bisu
              </Botao>
            </div>
            {dados.bisus.length === 0 ? (
              <EstadoVazio icone={Lightbulb} titulo="Nenhum bisu neste tópico" texto="Guarde aqui as dicas que os professores deram sobre este assunto." />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {dados.bisus.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => { setBisuEditando(b); setModal("bisu"); }}
                      className="flex h-full w-full flex-col rounded-lg border border-borda-card bg-superficie p-4 text-left hover:bg-hover"
                    >
                      <span className="text-[14px] leading-relaxed whitespace-pre-line">
                        <TextoGrifado texto={b.texto} />
                      </span>
                      <span className="mt-3 flex flex-wrap items-center gap-2 text-xs text-texto-2">
                        {b.cai_muito && <BadgeCaiMuito />}
                        <span className="font-semibold text-texto">{b.professor || "Sem professor"}</span> · {ROTULO_FONTE[b.fonte]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {aba === "questoes" && (
          <div className="flex flex-col gap-4">
            <div>
              <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setModal("sessao")}>
                Registrar sessão
              </Botao>
            </div>
            {dados.sessoes.length === 0 ? (
              <EstadoVazio
                icone={ListChecks}
                titulo="Nenhuma sessão neste tópico"
                texto="Resolva questões da FGV sobre este assunto no Gran ou no TEC e registre quantas fez e quantas acertou."
              />
            ) : (
              <ul className="flex flex-col">
                {dados.sessoes.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-borda py-2.5 text-[13px]">
                    <span className="tabular font-semibold">{formatarData(s.data)}</span>
                    <span className="text-texto-2">{ROTULO_ATIVIDADE[s.atividade]}</span>
                    <span className="tabular">{formatarMinutos(s.minutos)}</span>
                    <span className="tabular">
                      {s.acertos} de {s.questoes}
                    </span>
                    <PillAcerto pct={pctAcerto(s.acertos, s.questoes)} />
                    {s.observacao && <span className="w-full text-xs text-texto-2">{s.observacao}</span>}
                  </li>
                ))}
              </ul>
            )}
            {totais.questoes > 0 && (
              <p className="tabular text-[13px] text-texto-2">
                Total: {totais.acertos} de {totais.questoes} questões ({formatarPct(totais.pct)})
              </p>
            )}
          </div>
        )}

        {aba === "nomenclatura" && (
          <div className="flex flex-col gap-4">
            <div>
              <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setModal("termo")}>
                Adicionar termo
              </Botao>
            </div>
            {dados.termos.length === 0 ? (
              <EstadoVazio icone={BookA} titulo="Nenhum termo ligado a este tópico" texto="Adicione siglas e nomes deste assunto. Na Nomenclatura, dá para ligar termos já existentes a este tópico." />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {dados.termos.map((t) => (
                  <li key={t.id}>
                    <Link href={`/nomenclatura?abrir=${t.id}`} className="flex h-full flex-col gap-1 rounded-lg border border-borda-card bg-superficie p-4 hover:bg-hover">
                      <span className="text-[16px] font-extrabold">{t.termo}</span>
                      {t.extenso && t.extenso !== t.termo && <span className="text-xs font-semibold text-texto-2">{t.extenso}</span>}
                      <span className="line-clamp-3 text-[13px] leading-relaxed">{t.pratica}</span>
                      <span className="mt-auto pt-2">{t.status === "ja_sei" ? <Pill tipo="concluido">Já sei</Pill> : <Pill>Aprendendo</Pill>}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {aba === "flashcards" &&
          (dados.termos.length ? (
            <Flashcards termos={dados.termos} />
          ) : (
            <EstadoVazio icone={Layers} titulo="Sem flashcards neste tópico" texto="Os flashcards saem dos termos da nomenclatura ligados a este tópico." />
          ))}

        {aba === "erros" && (
          <div className="flex flex-col gap-4">
            <div>
              <Botao variante="primario" icone={<Plus size={15} />} onClick={() => { setErroEditando(undefined); setModal("erro"); }}>
                Adicionar erro
              </Botao>
            </div>
            {dados.erros.length === 0 ? (
              <EstadoVazio icone={BookX} titulo="Nenhum erro anotado neste tópico" texto="Errou ou chutou uma questão deste assunto? Anote aqui com o motivo e a regra certa." />
            ) : (
              <ul className="flex flex-col gap-3">
                {dados.erros.map((e) => (
                  <li key={e.id} className="flex gap-3 rounded-lg border border-borda-card bg-superficie p-4">
                    <button
                      type="button"
                      onClick={() => alternarErro(e)}
                      aria-pressed={e.revisado}
                      aria-label={e.revisado ? "Desmarcar revisado" : "Marcar como revisado"}
                      title={e.revisado ? "Desmarcar revisado" : "Marcar como revisado"}
                      className="mt-0.5 shrink-0 self-start rounded-full"
                    >
                      {e.revisado ? <CheckCircle2 size={22} className="text-sucesso" /> : <Circle size={22} className="text-texto-2" />}
                    </button>
                    <button type="button" onClick={() => { setErroEditando(e); setModal("erro"); }} className="min-w-0 flex-1 text-left">
                      <span className="block text-[14px] leading-relaxed">{e.assertiva}</span>
                      {e.regra && <span className="mt-2 block rounded-md bg-hover px-3 py-2 text-[13px]">{e.regra}</span>}
                      <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <Badge cor={e.gabarito === "certo" ? "verde" : e.gabarito === "errado" ? "rosa" : "amarelo"}>Gabarito: {ROTULO_GABARITO[e.gabarito]}</Badge>
                        <Pill>{ROTULO_MOTIVO[e.motivo]}</Pill>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const d = await porNaRevisao(usuario.id, "erro", e.id);
                          avisar({ texto: `Na fila de revisões: ${formatarData(d)}` });
                        } catch {
                          avisar({ texto: "Não deu para pôr na revisão.", tipo: "erro" });
                        }
                      }}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-md border border-borda px-2.5 text-xs font-bold hover:bg-hover"
                      title="Pôr na revisão"
                    >
                      <RotateCcw size={14} /> <span className="hidden sm:inline">Revisar</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {modal === "bisu" && (
        <ModalBisu
          bisu={bisuEditando}
          materias={edital.materias}
          topicos={edital.topicos}
          professores={[...new Set(dados.bisus.map((b) => b.professor).filter((p): p is string => Boolean(p)))]}
          ultimoProfessor={dados.bisus[0]?.professor ?? ""}
          materiaInicial={topico.materia_id}
          topicoInicial={topico.id}
          fechar={() => setModal(null)}
          aoSalvar={(b, novo) => {
            trocar("bisus", novo ? [b, ...dados.bisus] : dados.bisus.map((x) => (x.id === b.id ? b : x)));
            setModal(null);
            avisar({ texto: novo ? "Bisu guardado" : "Bisu atualizado" });
          }}
        />
      )}
      {modal === "erro" && (
        <ModalErro
          erro={erroEditando}
          materias={edital.materias}
          topicos={edital.topicos}
          materiaInicial={topico.materia_id}
          topicoInicial={topico.id}
          fechar={() => setModal(null)}
          aoSalvar={(e, novo) => {
            trocar("erros", novo ? [e, ...dados.erros] : dados.erros.map((x) => (x.id === e.id ? e : x)));
            setModal(null);
            avisar({ texto: novo ? "Erro guardado" : "Erro atualizado" });
          }}
        />
      )}
      {modal === "sessao" && (
        <ModalSessao
          materias={edital.materias}
          topicos={edital.topicos}
          materiaInicial={topico.materia_id}
          topicoInicial={topico.id}
          fechar={() => setModal(null)}
          aoSalvar={(s) => {
            trocar("sessoes", [s, ...dados.sessoes]);
            setModal(null);
            avisar({ texto: "Sessão registrada" });
          }}
        />
      )}
      {modal === "termo" && (
        <ModalTermo
          relacionadosAtuais={[]}
          todos={dados.todosTermos}
          materias={edital.materias}
          topicos={edital.topicos}
          materiaInicial={topico.materia_id}
          topicoInicial={topico.id}
          fechar={() => setModal(null)}
          aoSalvar={(t) => {
            if ((t.topico_ids ?? []).includes(topico.id)) trocar("termos", [...dados.termos, t].sort((a, b) => a.termo.localeCompare(b.termo, "pt-BR")));
            setModal(null);
            avisar({ texto: "Termo guardado" });
          }}
        />
      )}
    </div>
  );
}
