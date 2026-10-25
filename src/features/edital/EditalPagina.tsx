"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Check, Folder, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { exigir, useConsulta } from "@/lib/useConsulta";
import { useTempoReal } from "@/lib/tempoReal";
import { usePreferencia } from "@/lib/preferencias";
import type { Materia, StatusTopico } from "@/lib/tipos";
import { Abas, CabecalhoPagina, SeletorVisualizacao, type Visualizacao } from "@/components/ui/Cabecalho";
import { Botao, BotaoIcone } from "@/components/ui/Botao";
import { MenuAcoes } from "@/components/ui/Menu";
import { EstadoErro, EstadoVazio, EsqueletoCards, EsqueletoLista } from "@/components/ui/Estados";
import { Pill } from "@/components/ui/Selos";
import { BarraProgresso } from "@/components/ui/Barra";
import { AlcaArrastar, ItemArrastavel, ListaArrastavel } from "@/components/ui/Arrastavel";
import { useToast } from "@/components/ui/Toast";
import { calcularProgresso, ordensAlteradas, reordenar, type Progresso } from "./status";
import { ModalMateria } from "./ModalMateria";

type Filtro = "todas" | "nao_comecadas" | "andamento" | "concluidas";
type Ordenacao = "minha" | "nome" | "menos_estudadas";
type MateriaComProgresso = Materia & { progresso: Progresso };

async function carregarEdital() {
  const sb = supabase();
  const [materias, topicos] = await Promise.all([
    sb.from("materias").select("*").order("ordem").order("created_at"),
    sb.from("topicos").select("materia_id, status"),
  ]);
  return {
    materias: exigir(materias) as Materia[],
    topicos: exigir(topicos) as { materia_id: string; status: StatusTopico }[],
  };
}

export function PillProgresso({ p }: { p: Progresso }) {
  if (p.total > 0 && p.revisados === p.total) return <Pill tipo="concluido">Revisado</Pill>;
  if (p.estudados === 0) return <Pill>Não começada</Pill>;
  return (
    <Pill tipo="andamento" percentual={p.pctEstudado}>
      Em andamento
    </Pill>
  );
}

export function EditalPagina() {
  const { avisar, excluirComDesfazer } = useToast();
  const { dados, setDados, carregando, erro, recarregar, atualizar } = useConsulta(carregarEdital);
  useTempoReal(["materias", "topicos"], atualizar);
  const [visualizacao, setVisualizacao] = usePreferencia<Visualizacao>("edital:vis", "cards");
  const [ordenacao, setOrdenacao] = usePreferencia<Ordenacao>("edital:ordem", "minha");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [modal, setModal] = useState<{ materia?: Materia } | null>(null);

  const materias: MateriaComProgresso[] = useMemo(() => {
    if (!dados) return [];
    return dados.materias.map((m) => ({
      ...m,
      progresso: calcularProgresso(dados.topicos.filter((t) => t.materia_id === m.id)),
    }));
  }, [dados]);

  const geral = useMemo(() => calcularProgresso(dados?.topicos ?? []), [dados]);

  const contagens = useMemo(
    () => ({
      todas: materias.length,
      nao_comecadas: materias.filter((m) => m.progresso.estudados === 0).length,
      andamento: materias.filter((m) => m.progresso.estudados > 0 && m.progresso.revisados < m.progresso.total).length,
      concluidas: materias.filter((m) => m.progresso.total > 0 && m.progresso.revisados === m.progresso.total).length,
    }),
    [materias],
  );

  const visiveis = useMemo(() => {
    let lista = materias.filter((m) => {
      const p = m.progresso;
      if (filtro === "nao_comecadas") return p.estudados === 0;
      if (filtro === "andamento") return p.estudados > 0 && p.revisados < p.total;
      if (filtro === "concluidas") return p.total > 0 && p.revisados === p.total;
      return true;
    });
    if (ordenacao === "nome") lista = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (ordenacao === "menos_estudadas") lista = [...lista].sort((a, b) => a.progresso.pctEstudado - b.progresso.pctEstudado);
    return lista;
  }, [materias, filtro, ordenacao]);

  const podeArrastar = ordenacao === "minha" && filtro === "todas";

  async function mover(de: number, para: number) {
    if (!dados) return;
    const antes = dados.materias;
    const depois = reordenar(antes, de, para);
    setDados({ ...dados, materias: depois });
    const sb = supabase();
    const resultados = await Promise.all(
      ordensAlteradas(antes, depois).map((m) => sb.from("materias").update({ ordem: m.ordem }).eq("id", m.id)),
    );
    if (resultados.some((r) => r.error)) {
      setDados({ ...dados, materias: antes });
      avisar({ texto: "Não deu para salvar a nova ordem.", tipo: "erro" });
    }
  }

  function excluir(materia: Materia) {
    if (!dados) return;
    const copia = dados;
    excluirComDesfazer({
      texto: `"${materia.nome}" excluída`,
      esconder: () => setDados({ ...copia, materias: copia.materias.filter((m) => m.id !== materia.id) }),
      restaurar: () => setDados(copia),
      apagar: async () => exigir(await supabase().from("materias").delete().eq("id", materia.id).select("id")),
    });
  }

  function aoSalvar(materia: Materia) {
    if (!dados) return;
    const existe = dados.materias.some((m) => m.id === materia.id);
    setDados({
      ...dados,
      materias: existe ? dados.materias.map((m) => (m.id === materia.id ? materia : m)) : [...dados.materias, materia],
    });
    setModal(null);
    avisar({ texto: existe ? "Matéria renomeada" : "Matéria criada" });
  }

  const opcoesOrdem: { id: Ordenacao; rotulo: string }[] = [
    { id: "minha", rotulo: "Minha ordem (arrastar)" },
    { id: "nome", rotulo: "Nome, de A a Z" },
    { id: "menos_estudadas", rotulo: "Menos estudadas primeiro" },
  ];

  return (
    <div className="flex flex-col">
      <CabecalhoPagina
        titulo="Edital"
        subtitulo={
          dados && `${materias.length} matérias · ${geral.total} tópicos · ${Math.round(geral.pctEstudado)}% estudado`
        }
        acoes={
          <>
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
            <Botao icone={<Plus size={15} />} onClick={() => setModal({})}>
              Nova matéria
            </Botao>
          </>
        }
      />

      <Abas<Filtro>
        abas={[
          { id: "todas", rotulo: "Todas", icone: FolderOpen, contagem: contagens.todas },
          { id: "nao_comecadas", rotulo: "Não começadas", contagem: contagens.nao_comecadas },
          { id: "andamento", rotulo: "Em andamento", contagem: contagens.andamento },
          { id: "concluidas", rotulo: "Revisadas", contagem: contagens.concluidas },
        ]}
        ativa={filtro}
        aoTrocar={setFiltro}
        direita={<SeletorVisualizacao valor={visualizacao} aoTrocar={setVisualizacao} />}
      />

      <div className="mt-6">
        {erro ? (
          <EstadoErro texto="Não deu para carregar o edital." tentarDeNovo={recarregar} />
        ) : carregando && !dados ? (
          visualizacao === "cards" ? <EsqueletoCards /> : <EsqueletoLista />
        ) : materias.length === 0 ? (
          <EstadoVazio
            icone={FolderOpen}
            titulo="Nenhuma matéria ainda"
            texto="Crie a primeira matéria do edital. Depois é só adicionar os tópicos."
            acao={
              <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setModal({})}>
                Nova matéria
              </Botao>
            }
          />
        ) : visiveis.length === 0 ? (
          <EstadoVazio icone={FolderOpen} titulo="Nenhuma matéria aqui" texto="Troque a aba para ver as outras matérias." />
        ) : (
          <ListaArrastavel ids={visiveis.map((m) => m.id)} aoMover={mover} grade={visualizacao === "cards"}>
            {visualizacao === "cards" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visiveis.map((m) => (
                  <CardMateria
                    key={m.id}
                    materia={m}
                    podeArrastar={podeArrastar}
                    renomear={() => setModal({ materia: m })}
                    excluir={() => excluir(m)}
                  />
                ))}
              </div>
            ) : (
              <TabelaMaterias
                materias={visiveis}
                podeArrastar={podeArrastar}
                renomear={(m) => setModal({ materia: m })}
                excluir={excluir}
              />
            )}
          </ListaArrastavel>
        )}
        {dados && materias.length > 0 && !podeArrastar && (
          <p className="mt-4 text-xs text-texto-2">Para arrastar, use a aba &quot;Todas&quot; e a ordem &quot;Minha ordem&quot;.</p>
        )}
      </div>

      {modal && (
        <ModalMateria
          materia={modal.materia}
          proximaOrdem={dados?.materias.length ?? 0}
          fechar={() => setModal(null)}
          aoSalvar={aoSalvar}
        />
      )}
    </div>
  );
}

function CardMateria({
  materia,
  podeArrastar,
  renomear,
  excluir,
}: {
  materia: MateriaComProgresso;
  podeArrastar: boolean;
  renomear: () => void;
  excluir: () => void;
}) {
  const p = materia.progresso;
  return (
    <ItemArrastavel id={materia.id} desativado={!podeArrastar} className="h-full">
      {(alca) => (
        <div className="group relative h-full rounded-lg border border-borda-card bg-superficie transition-colors hover:border-borda hover:bg-hover/60">
          <Link href={`/edital/${materia.id}`} className="flex h-full items-start gap-3 rounded-lg p-4 pr-11">
            <Folder size={22} className="mt-0.5 shrink-0 fill-texto text-texto" />
            <span className="flex min-w-0 flex-1 flex-col self-stretch">
              <span className="block text-[14px] leading-snug font-bold">{materia.nome}</span>
              <span className="tabular mt-0.5 block text-[12.5px] text-texto-2">
                {p.total} {p.total === 1 ? "tópico" : "tópicos"}
              </span>
              <span className="mt-auto flex items-center gap-2.5 pt-3">
                <BarraProgresso valor={p.pctEstudado} rotulo={`${materia.nome}: ${Math.round(p.pctEstudado)}% estudado`} />
                <span className="tabular w-9 shrink-0 text-right text-xs font-bold text-texto-2">{Math.round(p.pctEstudado)}%</span>
              </span>
            </span>
          </Link>
          <div className="absolute top-2.5 right-2 flex flex-col items-center opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <MenuAcoes
              rotulo={`Ações de ${materia.nome}`}
              itens={[
                { rotulo: "Renomear", icone: <Pencil size={15} />, aoClicar: renomear },
                "separador",
                { rotulo: "Excluir matéria", icone: <Trash2 size={15} />, aoClicar: excluir, perigo: true },
              ]}
            />
            {podeArrastar && <AlcaArrastar alca={alca} />}
          </div>
        </div>
      )}
    </ItemArrastavel>
  );
}

function TabelaMaterias({
  materias,
  podeArrastar,
  renomear,
  excluir,
}: {
  materias: MateriaComProgresso[];
  podeArrastar: boolean;
  renomear: (m: Materia) => void;
  excluir: (m: Materia) => void;
}) {
  return (
    <div>
      <div className="hidden grid-cols-[28px_minmax(0,1fr)_90px_170px_150px_76px] items-center gap-3 border-b border-borda px-2 pb-2.5 text-xs font-semibold text-texto-2 md:grid">
        <span />
        <span>Matéria</span>
        <span>Tópicos</span>
        <span>Estudado</span>
        <span>Revisado</span>
        <span />
      </div>
      <ul>
        {materias.map((m) => (
          <ItemArrastavel key={m.id} id={m.id} as="li" desativado={!podeArrastar} className="border-b border-borda">
            {(alca) => (
              <div className="group grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-2 py-3 transition-colors hover:bg-hover md:grid-cols-[28px_minmax(0,1fr)_90px_170px_150px_76px] md:py-2.5">
                <span>{podeArrastar && <AlcaArrastar alca={alca} />}</span>
                <Link href={`/edital/${m.id}`} className="min-w-0 truncate text-[13.5px] font-semibold underline decoration-borda underline-offset-4 hover:decoration-texto">
                  {m.nome}
                </Link>
                <span className="tabular hidden text-[13px] text-texto-2 md:block">{m.progresso.total}</span>
                <span className="col-start-2 md:col-start-auto">
                  <PillProgresso p={m.progresso} />
                </span>
                <span className="tabular hidden items-center gap-2 text-[12.5px] text-texto-2 md:flex">
                  <span className="w-16">
                    <BarraProgresso valor={m.progresso.pctRevisado} cor="verde" rotulo="Revisado" />
                  </span>
                  {Math.round(m.progresso.pctRevisado)}%
                </span>
                <span className="col-start-3 row-start-1 flex justify-end gap-0.5 opacity-100 transition-opacity md:col-start-auto md:row-start-auto md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                  <BotaoIcone rotulo={`Renomear ${m.nome}`} onClick={() => renomear(m)}>
                    <Pencil size={15} />
                  </BotaoIcone>
                  <BotaoIcone rotulo={`Excluir ${m.nome}`} onClick={() => excluir(m)} className="hover:text-erro">
                    <Trash2 size={15} />
                  </BotaoIcone>
                </span>
              </div>
            )}
          </ItemArrastavel>
        ))}
      </ul>
    </div>
  );
}
