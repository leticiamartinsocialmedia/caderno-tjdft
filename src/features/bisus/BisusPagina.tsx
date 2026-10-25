"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Check, Copy, ExternalLink, Filter, Flame, Lightbulb, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { exigir, useConsulta } from "@/lib/useConsulta";
import { buscarTodos, useEditalBasico } from "@/lib/useEditalBasico";
import { usePreferencia } from "@/lib/preferencias";
import { contem, TextoGrifado } from "@/lib/grifo";
import { dataSP, formatarData } from "@/lib/datas";
import type { Bisu, FonteBisu } from "@/lib/tipos";
import { Abas, CabecalhoPagina, SeletorVisualizacao, type Visualizacao } from "@/components/ui/Cabecalho";
import { Botao, BotaoIcone } from "@/components/ui/Botao";
import { MenuAcoes } from "@/components/ui/Menu";
import { EstadoErro, EstadoVazio, EsqueletoCards, EsqueletoLista } from "@/components/ui/Estados";
import { BadgeCaiMuito } from "@/components/ui/Selos";
import { estiloInput } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/components/shell/AppContext";
import { FONTES, ROTULO_FONTE } from "./fontes";
import { ModalBisu } from "./ModalBisu";

type Aba = "todos" | "cai_muito";
type Ordenacao = "recentes" | "antigos" | "materia" | "professor";
type Filtros = { materia: string; professor: string; fonte: "" | FonteBisu };

const POR_PAGINA = 30;
const SEM_FILTROS: Filtros = { materia: "", professor: "", fonte: "" };

async function carregarBisus(usuarioId: string) {
  const sb = supabase();
  const [bisus, cfg] = await Promise.all([
    buscarTodos<Bisu>((de, ate) => sb.from("bisus").select("*").order("created_at", { ascending: false }).range(de, ate)),
    sb.from("configuracoes").select("ultimo_professor").eq("user_id", usuarioId).maybeSingle(),
  ]);
  return { bisus, ultimoProfessor: (exigir(cfg) as { ultimo_professor: string | null } | null)?.ultimo_professor ?? "" };
}

export function BisusPagina() {
  const { usuario } = useApp();
  const { avisar, excluirComDesfazer } = useToast();
  const edital = useEditalBasico();
  const { dados, setDados, carregando, erro, recarregar } = useConsulta(() => carregarBisus(usuario.id));
  const [visualizacao, setVisualizacao] = usePreferencia<Visualizacao>("bisus:vis", "lista");
  const [ordenacao, setOrdenacao] = usePreferencia<Ordenacao>("bisus:ordem", "recentes");
  const [aba, setAba] = useState<Aba>("todos");
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS);
  const [painelFiltros, setPainelFiltros] = useState(false);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [modal, setModal] = useState<{ bisu?: Bisu } | null>(null);

  const bisus = useMemo(() => dados?.bisus ?? [], [dados]);
  const professores = useMemo(
    () => [...new Set(bisus.map((b) => b.professor).filter((p): p is string => Boolean(p)))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [bisus],
  );
  const filtrosAtivos = Object.values(filtros).filter(Boolean).length;

  const visiveis = useMemo(() => {
    const lista = bisus.filter(
      (b) =>
        (aba === "todos" || b.cai_muito) &&
        (!filtros.materia || b.materia_id === filtros.materia) &&
        (!filtros.professor || b.professor === filtros.professor) &&
        (!filtros.fonte || b.fonte === filtros.fonte) &&
        (!busca.trim() ||
          contem(b.texto, busca) ||
          contem(b.professor, busca) ||
          contem(edital.nomeMateria.get(b.materia_id), busca) ||
          contem(b.topico_id ? edital.nomeTopico.get(b.topico_id) : "", busca)),
    );
    const nome = (id: string) => edital.nomeMateria.get(id) ?? "";
    const ordenadores: Record<Ordenacao, (a: Bisu, b: Bisu) => number> = {
      recentes: (a, b) => b.created_at.localeCompare(a.created_at),
      antigos: (a, b) => a.created_at.localeCompare(b.created_at),
      materia: (a, b) => nome(a.materia_id).localeCompare(nome(b.materia_id), "pt-BR"),
      professor: (a, b) => (a.professor ?? "~").localeCompare(b.professor ?? "~", "pt-BR"),
    };
    return lista.sort(ordenadores[ordenacao]);
  }, [bisus, aba, filtros, busca, ordenacao, edital.nomeMateria, edital.nomeTopico]);

  function trocarBisus(novos: Bisu[]) {
    if (dados) setDados({ ...dados, bisus: novos });
  }

  function excluir(bisu: Bisu) {
    const copia = bisus;
    excluirComDesfazer({
      esconder: () => trocarBisus(copia.filter((b) => b.id !== bisu.id)),
      restaurar: () => trocarBisus(copia),
      apagar: async () => exigir(await supabase().from("bisus").delete().eq("id", bisu.id).select("id")),
    });
  }

  async function duplicar(bisu: Bisu) {
    const { materia_id, topico_id, texto, professor, fonte, link, cai_muito } = bisu;
    const { data, error } = await supabase()
      .from("bisus")
      .insert({ materia_id, topico_id, texto, professor, fonte, link, cai_muito })
      .select()
      .single();
    if (error || !data) {
      avisar({ texto: "Não deu para duplicar.", tipo: "erro" });
      return;
    }
    trocarBisus([data as Bisu, ...bisus]);
    setModal({ bisu: data as Bisu });
    avisar({ texto: "Bisu duplicado. Ajuste o que precisar." });
  }

  function aoSalvar(bisu: Bisu, novo: boolean) {
    if (!dados) return;
    setDados({
      bisus: novo ? [bisu, ...bisus] : bisus.map((b) => (b.id === bisu.id ? bisu : b)),
      ultimoProfessor: bisu.professor ?? dados.ultimoProfessor,
    });
    setModal(null);
    avisar({ texto: novo ? "Bisu guardado" : "Bisu atualizado" });
  }

  const acoes = (b: Bisu) => ({
    editar: () => setModal({ bisu: b }),
    duplicar: () => duplicar(b),
    excluir: () => excluir(b),
  });

  const semEdital = !edital.carregando && edital.materias.length === 0;
  const opcoesOrdem: { id: Ordenacao; rotulo: string }[] = [
    { id: "recentes", rotulo: "Mais recentes" },
    { id: "antigos", rotulo: "Mais antigos" },
    { id: "materia", rotulo: "Matéria" },
    { id: "professor", rotulo: "Professor" },
  ];

  return (
    <div className="flex flex-col">
      <CabecalhoPagina
        titulo="Bisus"
        subtitulo="As dicas dos professores, num lugar só."
        acoes={
          <>
            <Botao
              icone={<Filter size={15} />}
              onClick={() => setPainelFiltros((v) => !v)}
              aria-expanded={painelFiltros}
              aria-controls="painel-filtros"
            >
              Filtrar
              {filtrosAtivos > 0 && (
                <span className="tabular rounded bg-texto px-1.5 text-[11px] leading-[18px] text-fundo">{filtrosAtivos}</span>
              )}
            </Botao>
            <MenuAcoes
              rotulo="Ordenar"
              gatilho={
                <span className="inline-flex h-10 sm:h-9 items-center gap-2 rounded-md border border-borda bg-superficie px-3.5 text-[13px] font-bold text-texto hover:bg-hover">
                  <ArrowUpDown size={15} /> Ordenar
                </span>
              }
              itens={opcoesOrdem.map((o) => ({
                rotulo: o.rotulo,
                marcado: ordenacao === o.id,
                icone: <Check size={15} className={ordenacao === o.id ? "" : "invisible"} />,
                aoClicar: () => setOrdenacao(o.id),
              }))}
            />
            <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setModal({})} disabled={semEdital}>
              Adicionar bisu
            </Botao>
          </>
        }
      />

      {painelFiltros && (
        <div id="painel-filtros" className="mt-5 grid gap-3 rounded-lg border border-borda p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <FiltroSelect
            id="filtro-materia"
            rotulo="Matéria"
            valor={filtros.materia}
            opcoes={edital.materias.map((m) => ({ id: m.id, rotulo: m.nome }))}
            aoMudar={(v) => setFiltros({ ...filtros, materia: v })}
          />
          <FiltroSelect
            id="filtro-professor"
            rotulo="Professor"
            valor={filtros.professor}
            opcoes={professores.map((p) => ({ id: p, rotulo: p }))}
            aoMudar={(v) => setFiltros({ ...filtros, professor: v })}
          />
          <FiltroSelect
            id="filtro-fonte"
            rotulo="Onde ouvi"
            valor={filtros.fonte}
            opcoes={FONTES.map((f) => ({ id: f.id, rotulo: f.rotulo }))}
            aoMudar={(v) => setFiltros({ ...filtros, fonte: v as Filtros["fonte"] })}
          />
          <Botao variante="fantasma" icone={<X size={15} />} onClick={() => setFiltros(SEM_FILTROS)} disabled={!filtrosAtivos}>
            Limpar
          </Botao>
        </div>
      )}

      <Abas<Aba>
        abas={[
          { id: "todos", rotulo: "Todos", icone: Lightbulb, contagem: bisus.length },
          { id: "cai_muito", rotulo: "Cai muito", icone: Flame, contagem: bisus.filter((b) => b.cai_muito).length },
        ]}
        ativa={aba}
        aoTrocar={(a) => {
          setAba(a);
          setLimite(POR_PAGINA);
        }}
        direita={<SeletorVisualizacao valor={visualizacao} aoTrocar={setVisualizacao} />}
      />

      <div className="relative mt-4 max-w-md">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-2" />
        <input
          id="busca-bisus"
          type="search"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setLimite(POR_PAGINA);
          }}
          placeholder="Buscar no texto, professor ou matéria"
          className={`${estiloInput} pl-9`}
          aria-label="Buscar bisus"
        />
      </div>

      <div className="mt-4">
        {erro ? (
          <EstadoErro texto="Não deu para carregar os bisus." tentarDeNovo={recarregar} />
        ) : carregando && !dados ? (
          visualizacao === "cards" ? <EsqueletoCards quantidade={6} /> : <EsqueletoLista />
        ) : bisus.length === 0 ? (
          <EstadoVazio
            icone={Lightbulb}
            titulo="Nenhum bisu guardado"
            texto={
              semEdital
                ? "Crie uma matéria no Edital primeiro. Todo bisu fica ligado a uma matéria."
                : "Ouviu uma dica boa na aula? Guarde aqui com o nome do professor e onde ouviu."
            }
            acao={
              semEdital ? (
                <Link href="/edital" className="text-[13px] font-bold text-rosa-texto underline underline-offset-4">
                  Ir para o Edital
                </Link>
              ) : (
                <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setModal({})}>
                  Adicionar bisu
                </Botao>
              )
            }
          />
        ) : visiveis.length === 0 ? (
          <EstadoVazio
            icone={Search}
            titulo="Nenhum bisu encontrado"
            texto="Tente outra palavra ou limpe os filtros."
            acao={
              <Botao
                onClick={() => {
                  setBusca("");
                  setFiltros(SEM_FILTROS);
                  setAba("todos");
                }}
              >
                Limpar busca e filtros
              </Botao>
            }
          />
        ) : (
          <>
            {visualizacao === "cards" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visiveis.slice(0, limite).map((b) => (
                  <CardBisu key={b.id} bisu={b} busca={busca} nomeMateria={edital.nomeMateria} nomeTopico={edital.nomeTopico} {...acoes(b)} />
                ))}
              </div>
            ) : (
              <TabelaBisus
                bisus={visiveis.slice(0, limite)}
                busca={busca}
                nomeMateria={edital.nomeMateria}
                nomeTopico={edital.nomeTopico}
                acoes={acoes}
              />
            )}
            <div className="mt-5 flex items-center justify-between gap-3 text-[12.5px] text-texto-2">
              <span className="tabular">
                Mostrando {Math.min(limite, visiveis.length)} de {visiveis.length}
              </span>
              {limite < visiveis.length && <Botao onClick={() => setLimite((l) => l + POR_PAGINA)}>Mostrar mais</Botao>}
            </div>
          </>
        )}
      </div>

      {modal && (
        <ModalBisu
          bisu={modal.bisu}
          materias={edital.materias}
          topicos={edital.topicos}
          professores={professores}
          ultimoProfessor={dados?.ultimoProfessor ?? ""}
          materiaInicial={filtros.materia || undefined}
          fechar={() => setModal(null)}
          aoSalvar={aoSalvar}
        />
      )}
    </div>
  );
}

function FiltroSelect({
  id,
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  id: string;
  rotulo: string;
  valor: string;
  opcoes: { id: string; rotulo: string }[];
  aoMudar: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-texto-2">
        {rotulo}
      </label>
      <select id={id} className={estiloInput} value={valor} onChange={(e) => aoMudar(e.target.value)}>
        <option value="">Todos</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}

type PropsItem = {
  bisu: Bisu;
  busca: string;
  nomeMateria: Map<string, string>;
  nomeTopico: Map<string, string>;
  editar: () => void;
  duplicar: () => void;
  excluir: () => void;
};

function MenuBisu({ editar, duplicar, excluir }: Pick<PropsItem, "editar" | "duplicar" | "excluir">) {
  return (
    <MenuAcoes
      rotulo="Ações do bisu"
      itens={[
        { rotulo: "Editar", icone: <Pencil size={15} />, aoClicar: editar },
        { rotulo: "Duplicar", icone: <Copy size={15} />, aoClicar: duplicar },
        "separador",
        { rotulo: "Excluir", icone: <Trash2 size={15} />, aoClicar: excluir, perigo: true },
      ]}
    />
  );
}

function LinkMateria({ id, nome }: { id: string; nome?: string }) {
  return (
    <Link href={`/edital/${id}`} className="underline decoration-borda underline-offset-4 hover:decoration-texto">
      {nome ?? "Matéria"}
    </Link>
  );
}

function CardBisu({ bisu, busca, nomeMateria, nomeTopico, editar, duplicar, excluir }: PropsItem) {
  return (
    <article className="group flex flex-col rounded-lg border border-borda-card bg-superficie p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold text-texto-2">
          <LinkMateria id={bisu.materia_id} nome={nomeMateria.get(bisu.materia_id)} />
          {bisu.topico_id && nomeTopico.get(bisu.topico_id) && <span>· {nomeTopico.get(bisu.topico_id)}</span>}
        </div>
        <MenuBisu editar={editar} duplicar={duplicar} excluir={excluir} />
      </div>
      <p className="mt-2 flex-1 text-[14px] leading-relaxed whitespace-pre-line">
        <TextoGrifado texto={bisu.texto} busca={busca} />
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-texto-2">
        {bisu.cai_muito && <BadgeCaiMuito />}
        <span className="tabular">
          <span className="font-semibold text-texto">{bisu.professor || "Sem professor"}</span> · {ROTULO_FONTE[bisu.fonte]} ·{" "}
          {formatarData(dataSP(bisu.created_at))}
        </span>
        {bisu.link && (
          <a href={bisu.link} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-semibold text-rosa-texto hover:underline">
            Abrir link <ExternalLink size={12} />
          </a>
        )}
      </div>
    </article>
  );
}

function TabelaBisus({
  bisus,
  busca,
  nomeMateria,
  nomeTopico,
  acoes,
}: {
  bisus: Bisu[];
  busca: string;
  nomeMateria: Map<string, string>;
  nomeTopico: Map<string, string>;
  acoes: (b: Bisu) => { editar: () => void; duplicar: () => void; excluir: () => void };
}) {
  return (
    <>
      {/* Celular: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {bisus.map((b) => (
          <CardBisu key={b.id} bisu={b} busca={busca} nomeMateria={nomeMateria} nomeTopico={nomeTopico} {...acoes(b)} />
        ))}
      </div>
      {/* Computador: tabela */}
      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-borda text-xs font-semibold text-texto-2">
              <th className="py-2.5 pr-4 pl-2 font-semibold">Bisu</th>
              <th className="w-[19%] py-2.5 pr-4 font-semibold">Matéria e tópico</th>
              <th className="w-[13%] py-2.5 pr-4 font-semibold">Professor</th>
              <th className="w-[12%] py-2.5 pr-4 font-semibold">Onde ouvi</th>
              <th className="w-[96px] py-2.5 pr-2 font-semibold">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bisus.map((b) => {
              const a = acoes(b);
              const topico = b.topico_id ? nomeTopico.get(b.topico_id) : undefined;
              return (
                <tr key={b.id} className="group border-b border-borda align-top transition-colors hover:bg-hover">
                  <td className="py-3 pr-4 pl-2">
                    <p className="line-clamp-3 text-[13.5px] leading-relaxed">
                      <TextoGrifado texto={b.texto} busca={busca} />
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-texto-2">
                      {b.cai_muito && <BadgeCaiMuito />}
                      <span className="tabular">{formatarData(dataSP(b.created_at))}</span>
                      {b.link && (
                        <a href={b.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-rosa-texto hover:underline">
                          Link <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-[13px]">
                    <LinkMateria id={b.materia_id} nome={nomeMateria.get(b.materia_id)} />
                    {topico && <span className="mt-0.5 block text-xs text-texto-2">{topico}</span>}
                  </td>
                  <td className="py-3 pr-4 text-[13px]">{b.professor || <span className="text-texto-2">—</span>}</td>
                  <td className="py-3 pr-4 text-[13px] text-texto-2">{ROTULO_FONTE[b.fonte]}</td>
                  <td className="py-2 pr-2">
                    <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      <BotaoIcone rotulo="Editar bisu" onClick={a.editar}>
                        <Pencil size={15} />
                      </BotaoIcone>
                      <BotaoIcone rotulo="Duplicar bisu" onClick={a.duplicar}>
                        <Copy size={15} />
                      </BotaoIcone>
                      <BotaoIcone rotulo="Excluir bisu" onClick={a.excluir} className="hover:text-erro">
                        <Trash2 size={15} />
                      </BotaoIcone>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
