"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookA, CheckCircle2, GraduationCap, Layers, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { exigir, useConsulta } from "@/lib/useConsulta";
import { useTempoReal } from "@/lib/tempoReal";
import { buscarTodos, useEditalBasico } from "@/lib/useEditalBasico";
import { usePreferencia } from "@/lib/preferencias";
import { contem } from "@/lib/grifo";
import { formatarData } from "@/lib/datas";
import { porNaRevisao, tirarDaRevisao } from "@/lib/filaRevisao";
import type { Termo, TermoRelacionado } from "@/lib/tipos";
import { Abas, CabecalhoPagina, SeletorVisualizacao, type Visualizacao } from "@/components/ui/Cabecalho";
import { Botao, BotaoIcone } from "@/components/ui/Botao";
import { EstadoErro, EstadoVazio, EsqueletoCards, EsqueletoLista } from "@/components/ui/Estados";
import { Pill } from "@/components/ui/Selos";
import { Modal } from "@/components/ui/Modal";
import { estiloInput } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/components/shell/AppContext";
import { ModalTermo } from "./ModalTermo";
import { Flashcards } from "./Flashcards";

type Aba = "todos" | "aprendendo" | "ja_sei" | "flashcards";
const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function inicial(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase();
}

async function carregar() {
  const sb = supabase();
  const [termos, rel] = await Promise.all([
    buscarTodos<Termo>((de, ate) => sb.from("termos").select("*").order("termo").range(de, ate)),
    sb.from("termos_relacionados").select("termo_id, relacionado_id"),
  ]);
  return { termos, relacionados: exigir(rel) as TermoRelacionado[] };
}

function PillStatusTermo({ status }: { status: Termo["status"] }) {
  return status === "ja_sei" ? <Pill tipo="concluido">Já sei</Pill> : <Pill>Aprendendo</Pill>;
}

export function NomenclaturaPagina() {
  const router = useRouter();
  const params = useSearchParams();
  const { usuario } = useApp();
  const { avisar, excluirComDesfazer } = useToast();
  const edital = useEditalBasico();
  const { dados, setDados, carregando, erro, recarregar, atualizar } = useConsulta(carregar);
  useTempoReal(["termos", "termos_relacionados"], atualizar);
  const [vis, setVis] = usePreferencia<Visualizacao>("termos:vis", "lista");
  const [aba, setAba] = useState<Aba>("todos");
  const [letra, setLetra] = useState("");
  const [busca, setBusca] = useState("");
  const [materia, setMateria] = useState("");
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ termo?: Termo } | null>(null);

  const termos = useMemo(() => dados?.termos ?? [], [dados]);
  const porId = useMemo(() => new Map(termos.map((t) => [t.id, t])), [termos]);
  const relacionadosDe = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of dados?.relacionados ?? []) m.set(r.termo_id, [...(m.get(r.termo_id) ?? []), r.relacionado_id]);
    return m;
  }, [dados]);

  const abrir = params.get("abrir");
  useEffect(() => {
    if (!abrir) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetalhe(abrir);
    router.replace("/nomenclatura");
  }, [abrir, router]);

  const filtrados = useMemo(
    () =>
      termos.filter(
        (t) =>
          (aba === "todos" || aba === "flashcards" || t.status === aba) &&
          (!materia || t.materia_ids.includes(materia)) &&
          (!busca.trim() || contem(t.termo, busca) || contem(t.extenso, busca) || contem(t.pratica, busca) || contem(t.tecnica, busca) || t.tags.some((x) => contem(x, busca))),
      ),
    [termos, aba, materia, busca],
  );
  const letrasComTermo = useMemo(() => new Set(filtrados.map((t) => inicial(t.termo))), [filtrados]);
  const visiveis = useMemo(() => (letra ? filtrados.filter((t) => inicial(t.termo) === letra) : filtrados), [filtrados, letra]);

  async function marcar(t: Termo, status: Termo["status"]) {
    setDados(dados && { ...dados, termos: termos.map((x) => (x.id === t.id ? { ...x, status } : x)) });
    const { error } = await supabase().from("termos").update({ status }).eq("id", t.id);
    if (error) {
      recarregar();
      avisar({ texto: "Não deu para salvar.", tipo: "erro" });
    }
  }

  async function revisar(t: Termo) {
    try {
      const data = await porNaRevisao(usuario.id, "termo", t.id);
      avisar({ texto: `${t.termo} na fila de revisões: ${formatarData(data)}` });
    } catch {
      avisar({ texto: "Não deu para pôr na revisão.", tipo: "erro" });
    }
  }

  function excluir(t: Termo) {
    if (!dados) return;
    const copia = dados;
    setDetalhe(null);
    excluirComDesfazer({
      texto: `"${t.termo}" excluído`,
      esconder: () => setDados({ ...copia, termos: copia.termos.filter((x) => x.id !== t.id) }),
      restaurar: () => setDados(copia),
      apagar: async () => {
        await tirarDaRevisao("termo", t.id);
        const { error } = await supabase().from("termos").delete().eq("id", t.id);
        if (error) throw error;
      },
    });
  }

  const nomesMaterias = (t: Termo) => t.materia_ids.map((id) => edital.nomeMateria.get(id)).filter(Boolean) as string[];
  const termoDetalhe = detalhe ? porId.get(detalhe) : undefined;

  return (
    <div className="flex flex-col">
      <CabecalhoPagina
        titulo="Nomenclatura"
        subtitulo="O dicionário de siglas e termos, do jeito simples e do jeito da prova."
        acoes={
          <>
            <Botao icone={<Layers size={15} />} onClick={() => setAba("flashcards")}>
              Flashcards
            </Botao>
            <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setEditando({})}>
              Adicionar termo
            </Botao>
          </>
        }
      />

      <Abas<Aba>
        abas={[
          { id: "todos", rotulo: "Todos", icone: BookA, contagem: termos.length },
          { id: "aprendendo", rotulo: "Aprendendo", icone: GraduationCap, contagem: termos.filter((t) => t.status === "aprendendo").length },
          { id: "ja_sei", rotulo: "Já sei", icone: CheckCircle2, contagem: termos.filter((t) => t.status === "ja_sei").length },
          { id: "flashcards", rotulo: "Flashcards", icone: Layers },
        ]}
        ativa={aba}
        aoTrocar={setAba}
        direita={aba !== "flashcards" ? <SeletorVisualizacao valor={vis} aoTrocar={setVis} /> : undefined}
      />

      {aba !== "flashcards" && (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-2" />
              <input
                id="busca-termos"
                type="search"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setLetra("");
                }}
                placeholder="Buscar sigla, nome ou significado"
                aria-label="Buscar termos"
                className={`${estiloInput} pl-9`}
              />
            </div>
            <select id="filtro-materia-termo" aria-label="Matéria" className={estiloInput} value={materia} onChange={(e) => setMateria(e.target.value)}>
              <option value="">Todas as matérias</option>
              {edital.materias.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
          <nav aria-label="Índice de A a Z" className="mt-3 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setLetra("")}
              aria-pressed={!letra}
              className={`h-9 rounded-md px-2.5 text-[12.5px] font-bold ${!letra ? "bg-texto text-fundo" : "text-texto-2 hover:bg-hover"}`}
            >
              Todas
            </button>
            {LETRAS.map((l) => {
              const tem = letrasComTermo.has(l);
              return (
                <button
                  key={l}
                  type="button"
                  disabled={!tem}
                  onClick={() => setLetra(letra === l ? "" : l)}
                  aria-pressed={letra === l}
                  className={`h-9 w-9 rounded-md text-[12.5px] font-bold transition-colors ${
                    letra === l ? "bg-rosa text-white" : tem ? "text-texto hover:bg-hover" : "text-texto-2/35"
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </nav>
        </>
      )}

      <div className="mt-4">
        {erro ? (
          <EstadoErro texto="Não deu para carregar a nomenclatura." tentarDeNovo={recarregar} />
        ) : carregando && !dados ? (
          vis === "cards" ? <EsqueletoCards /> : <EsqueletoLista />
        ) : aba === "flashcards" ? (
          <Flashcards termos={termos} />
        ) : termos.length === 0 ? (
          <EstadoVazio
            icone={BookA}
            titulo="Dicionário vazio"
            texto="Adicione siglas como PAD, MS ou LDO com uma explicação simples e outra técnica."
            acao={
              <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setEditando({})}>
                Adicionar termo
              </Botao>
            }
          />
        ) : visiveis.length === 0 ? (
          <EstadoVazio icone={Search} titulo="Nenhum termo encontrado" texto="Tente outra palavra, outra letra ou limpe o filtro." />
        ) : (
          <>
            <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 ${vis === "lista" ? "md:hidden" : ""}`}>
              {visiveis.map((t) => (
                <article key={t.id} className="flex flex-col rounded-lg border border-borda-card bg-superficie">
                  <button type="button" onClick={() => setDetalhe(t.id)} className="flex flex-1 flex-col items-start gap-1.5 p-4 text-left">
                    <span className="text-[18px] leading-tight font-extrabold">{t.termo}</span>
                    {t.extenso && t.extenso !== t.termo && <span className="text-[13px] font-semibold text-texto-2">{t.extenso}</span>}
                    {t.pratica && <span className="line-clamp-3 text-[13.5px] leading-relaxed">{t.pratica}</span>}
                    <span className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                      <PillStatusTermo status={t.status} />
                      {(relacionadosDe.get(t.id) ?? []).slice(0, 2).map((r) => (
                        <span key={r} className="text-xs text-texto-2">
                          ≠ {porId.get(r)?.termo}
                        </span>
                      ))}
                    </span>
                  </button>
                </article>
              ))}
            </div>

            {vis === "lista" && (
              <table className="hidden w-full table-fixed border-collapse text-left md:table">
                <thead>
                  <tr className="border-b border-borda text-xs font-semibold text-texto-2">
                    <th className="w-[16%] py-2.5 pr-4 pl-2 font-semibold">Termo</th>
                    <th className="py-2.5 pr-4 font-semibold">Por extenso e explicação prática</th>
                    <th className="w-[20%] py-2.5 pr-4 font-semibold">Matérias</th>
                    <th className="w-[12%] py-2.5 pr-4 font-semibold">Status</th>
                    <th className="w-[96px] py-2.5 pr-2">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((t) => (
                    <tr key={t.id} className="group border-b border-borda align-top transition-colors hover:bg-hover">
                      <td className="py-3 pr-4 pl-2">
                        <button
                          type="button"
                          onClick={() => setDetalhe(t.id)}
                          className="text-left text-[14px] font-extrabold underline decoration-borda underline-offset-4 hover:decoration-texto"
                        >
                          {t.termo}
                        </button>
                      </td>
                      <td className="py-3 pr-4">
                        {t.extenso && t.extenso !== t.termo && <p className="text-[13px] font-semibold">{t.extenso}</p>}
                        <p className="line-clamp-2 text-[13px] text-texto-2">{t.pratica}</p>
                      </td>
                      <td className="py-3 pr-4 text-xs text-texto-2">{nomesMaterias(t).join(", ") || "—"}</td>
                      <td className="py-3 pr-4">
                        <PillStatusTermo status={t.status} />
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                          <BotaoIcone rotulo={`Editar ${t.termo}`} onClick={() => setEditando({ termo: t })}>
                            <Pencil size={15} />
                          </BotaoIcone>
                          <BotaoIcone rotulo={`Pôr ${t.termo} na revisão`} onClick={() => revisar(t)}>
                            <RotateCcw size={15} />
                          </BotaoIcone>
                          <BotaoIcone rotulo={`Excluir ${t.termo}`} onClick={() => excluir(t)} className="hover:text-erro">
                            <Trash2 size={15} />
                          </BotaoIcone>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="tabular mt-4 text-[12.5px] text-texto-2">
              {visiveis.length} {visiveis.length === 1 ? "termo" : "termos"}
            </p>
          </>
        )}
      </div>

      {termoDetalhe && (
        <Modal
          titulo={termoDetalhe.termo}
          fechar={() => setDetalhe(null)}
          largura="max-w-2xl"
          rodape={
            <>
              <Botao variante="fantasma" icone={<Trash2 size={15} />} onClick={() => excluir(termoDetalhe)} className="mr-auto text-erro">
                Excluir
              </Botao>
              <Botao icone={<RotateCcw size={15} />} onClick={() => revisar(termoDetalhe)}>
                Pôr na revisão
              </Botao>
              <Botao
                variante="primario"
                icone={<Pencil size={15} />}
                onClick={() => {
                  setEditando({ termo: termoDetalhe });
                  setDetalhe(null);
                }}
              >
                Editar
              </Botao>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            {termoDetalhe.extenso && <p className="text-[18px] leading-snug font-extrabold">{termoDetalhe.extenso}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => marcar(termoDetalhe, termoDetalhe.status === "ja_sei" ? "aprendendo" : "ja_sei")}
                className="rounded-full"
                title="Trocar status"
              >
                <PillStatusTermo status={termoDetalhe.status} />
              </button>
              {nomesMaterias(termoDetalhe).map((n) => (
                <span key={n} className="rounded-full bg-hover px-2.5 py-0.5 text-xs font-semibold">
                  {n}
                </span>
              ))}
            </div>
            <section className="rounded-lg bg-hover p-4">
              <h3 className="text-xs font-bold tracking-wide text-texto-2 uppercase">Do jeito simples</h3>
              <p className="mt-1 text-[14.5px] leading-relaxed">{termoDetalhe.pratica || "—"}</p>
            </section>
            <section className="rounded-lg border border-borda p-4">
              <h3 className="text-xs font-bold tracking-wide text-texto-2 uppercase">Como a prova cobra</h3>
              <p className="mt-1 text-[14.5px] leading-relaxed">{termoDetalhe.tecnica || "—"}</p>
              {termoDetalhe.dispositivo && <p className="mt-2 text-[13px] font-semibold">{termoDetalhe.dispositivo}</p>}
            </section>
            {(relacionadosDe.get(termoDetalhe.id) ?? []).length > 0 && (
              <section>
                <h3 className="text-[13px] font-extrabold">Não confundir com</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(relacionadosDe.get(termoDetalhe.id) ?? []).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDetalhe(r)}
                      className="min-h-9 rounded-full border border-rosa px-3 py-1 text-[13px] font-bold text-rosa-texto hover:bg-rosa-suave"
                    >
                      {porId.get(r)?.termo}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {termoDetalhe.tags.length > 0 && <p className="text-xs text-texto-2">Tags: {termoDetalhe.tags.join(", ")}</p>}
          </div>
        </Modal>
      )}

      {editando && (
        <ModalTermo
          termo={editando.termo}
          relacionadosAtuais={editando.termo ? (relacionadosDe.get(editando.termo.id) ?? []) : []}
          todos={termos}
          materias={edital.materias}
          fechar={() => setEditando(null)}
          aoSalvar={(t, rel, novo) => {
            if (dados) {
              const outros = dados.relacionados.filter((r) => r.termo_id !== t.id && r.relacionado_id !== t.id);
              setDados({
                termos: (novo ? [...termos, t] : termos.map((x) => (x.id === t.id ? t : x))).sort((a, b) => a.termo.localeCompare(b.termo, "pt-BR")),
                relacionados: [...outros, ...rel.flatMap((r) => [
                  { termo_id: t.id, relacionado_id: r },
                  { termo_id: r, relacionado_id: t.id },
                ])],
              });
            }
            setEditando(null);
            avisar({ texto: novo ? "Termo guardado" : "Termo atualizado" });
          }}
        />
      )}
    </div>
  );
}
