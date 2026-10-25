"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, FileQuestion, ListTree, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { exigir, useConsulta } from "@/lib/useConsulta";
import type { Materia, StatusTopico, Topico } from "@/lib/tipos";
import { Abas, CabecalhoPagina } from "@/components/ui/Cabecalho";
import { Botao, BotaoIcone } from "@/components/ui/Botao";
import { MenuAcoes } from "@/components/ui/Menu";
import { EstadoErro, EstadoVazio, EsqueletoLista } from "@/components/ui/Estados";
import { Pill } from "@/components/ui/Selos";
import { BarraProgresso } from "@/components/ui/Barra";
import { AlcaArrastar, ItemArrastavel, ListaArrastavel } from "@/components/ui/Arrastavel";
import { useToast } from "@/components/ui/Toast";
import { ModalFormulario } from "@/components/ui/Modal";
import { Campo, estiloInput } from "@/components/ui/Campo";
import { ORDEM_STATUS, ROTULO_STATUS, calcularProgresso, ordensAlteradas, proximoStatus, reordenar } from "./status";
import { ModalMateria } from "./ModalMateria";

type Filtro = "todos" | "nao_visto" | "andamento" | "revisado";

async function carregarMateria(id: string) {
  const sb = supabase();
  const [materia, topicos] = await Promise.all([
    sb.from("materias").select("*").eq("id", id).maybeSingle(),
    sb.from("topicos").select("*").eq("materia_id", id).order("ordem").order("created_at"),
  ]);
  return { materia: exigir(materia) as Materia | null, topicos: exigir(topicos) as Topico[] };
}

export function PillStatus({ status }: { status: StatusTopico }) {
  if (status === "revisado") return <Pill tipo="concluido">Revisado</Pill>;
  if (status === "nao_visto") return <Pill>Não visto</Pill>;
  return <Pill tipo="andamento">{ROTULO_STATUS[status]}</Pill>;
}

export function MateriaPagina({ id }: { id: string }) {
  const router = useRouter();
  const { avisar, excluirComDesfazer } = useToast();
  const { dados, setDados, carregando, erro, recarregar } = useConsulta(() => carregarMateria(id), id);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [modalTopico, setModalTopico] = useState<{ topico?: Topico } | null>(null);
  const [renomeandoMateria, setRenomeandoMateria] = useState(false);

  const topicos = useMemo(() => dados?.topicos ?? [], [dados]);
  const progresso = useMemo(() => calcularProgresso(topicos), [topicos]);
  const visiveis = useMemo(
    () =>
      topicos.filter((t) => {
        if (filtro === "andamento") return t.status === "teoria" || t.status === "questoes";
        if (filtro === "todos") return true;
        return t.status === filtro;
      }),
    [topicos, filtro],
  );

  function trocarTopicos(novos: Topico[]) {
    if (dados) setDados({ ...dados, topicos: novos });
  }

  async function mudarStatus(topico: Topico, status: StatusTopico) {
    const antes = topicos;
    trocarTopicos(topicos.map((t) => (t.id === topico.id ? { ...t, status } : t)));
    const { error } = await supabase().from("topicos").update({ status }).eq("id", topico.id);
    if (error) {
      trocarTopicos(antes);
      avisar({ texto: "Não deu para mudar o status.", tipo: "erro" });
    }
  }

  async function mover(de: number, para: number) {
    const antes = topicos;
    const depois = reordenar(antes, de, para);
    trocarTopicos(depois);
    const sb = supabase();
    const resultados = await Promise.all(
      ordensAlteradas(antes, depois).map((t) => sb.from("topicos").update({ ordem: t.ordem }).eq("id", t.id)),
    );
    if (resultados.some((r) => r.error)) {
      trocarTopicos(antes);
      avisar({ texto: "Não deu para salvar a nova ordem.", tipo: "erro" });
    }
  }

  function excluirTopico(topico: Topico) {
    const copia = topicos;
    excluirComDesfazer({
      texto: "Tópico excluído",
      esconder: () => trocarTopicos(copia.filter((t) => t.id !== topico.id)),
      restaurar: () => trocarTopicos(copia),
      apagar: async () => exigir(await supabase().from("topicos").delete().eq("id", topico.id).select("id")),
    });
  }

  function excluirMateria() {
    if (!dados?.materia) return;
    const materia = dados.materia;
    excluirComDesfazer({
      texto: `"${materia.nome}" excluída`,
      esconder: () => router.push("/edital"),
      restaurar: () => router.push(`/edital/${materia.id}`),
      apagar: async () => exigir(await supabase().from("materias").delete().eq("id", materia.id).select("id")),
    });
  }

  if (erro) return <EstadoErro texto="Não deu para carregar a matéria." tentarDeNovo={recarregar} />;

  if (!carregando && dados && !dados.materia) {
    return (
      <div className="flex flex-col gap-6">
        <CabecalhoPagina titulo="Matéria não encontrada" voltarPara="/edital" />
        <EstadoVazio icone={FileQuestion} titulo="Esta matéria não existe mais" texto="Ela pode ter sido excluída." />
      </div>
    );
  }

  const materia = dados?.materia;

  return (
    <div className="flex flex-col">
      <CabecalhoPagina
        titulo={materia?.nome ?? "Carregando…"}
        voltarPara="/edital"
        subtitulo={
          materia && (
            <span className="tabular">
              {progresso.estudados} de {progresso.total} estudados · {Math.round(progresso.pctRevisado)}% revisado
            </span>
          )
        }
        acoes={
          materia && (
            <>
              <MenuAcoes
                rotulo="Ações da matéria"
                itens={[
                  { rotulo: "Renomear matéria", icone: <Pencil size={15} />, aoClicar: () => setRenomeandoMateria(true) },
                  "separador",
                  { rotulo: "Excluir matéria", icone: <Trash2 size={15} />, aoClicar: excluirMateria, perigo: true },
                ]}
              />
              <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setModalTopico({})}>
                Adicionar tópico
              </Botao>
            </>
          )
        }
      />

      {materia && (
        <div className="mt-4 max-w-md">
          <BarraProgresso valor={progresso.pctEstudado} rotulo={`${Math.round(progresso.pctEstudado)}% estudado`} />
        </div>
      )}

      <Abas<Filtro>
        abas={[
          { id: "todos", rotulo: "Todos", icone: ListTree, contagem: topicos.length },
          { id: "nao_visto", rotulo: "Não vistos", contagem: topicos.filter((t) => t.status === "nao_visto").length },
          {
            id: "andamento",
            rotulo: "Em andamento",
            contagem: topicos.filter((t) => t.status === "teoria" || t.status === "questoes").length,
          },
          { id: "revisado", rotulo: "Revisados", contagem: topicos.filter((t) => t.status === "revisado").length },
        ]}
        ativa={filtro}
        aoTrocar={setFiltro}
      />

      <div className="mt-4">
        {carregando && !dados ? (
          <EsqueletoLista />
        ) : topicos.length === 0 ? (
          <EstadoVazio
            icone={ListTree}
            titulo="Nenhum tópico nesta matéria"
            texto="Adicione os tópicos do edital. Dá para colar vários de uma vez, um por linha."
            acao={
              <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setModalTopico({})}>
                Adicionar tópico
              </Botao>
            }
          />
        ) : visiveis.length === 0 ? (
          <EstadoVazio icone={ListTree} titulo="Nenhum tópico nesta aba" />
        ) : (
          <>
            <div className="hidden grid-cols-[28px_minmax(0,1fr)_170px_76px] gap-3 border-b border-borda px-2 pb-2.5 text-xs font-semibold text-texto-2 md:grid">
              <span />
              <span>Tópico</span>
              <span>Status</span>
              <span />
            </div>
            <ListaArrastavel ids={visiveis.map((t) => t.id)} aoMover={mover}>
              <ul>
                {visiveis.map((t) => (
                  <ItemArrastavel key={t.id} id={t.id} as="li" desativado={filtro !== "todos"} className="border-b border-borda">
                    {(alca) => (
                      <div className="group grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 bg-fundo px-2 py-2.5 transition-colors hover:bg-hover md:grid-cols-[28px_minmax(0,1fr)_170px_76px]">
                        <span>{filtro === "todos" && <AlcaArrastar alca={alca} />}</span>
                        <span className="min-w-0 text-[13.5px] leading-snug font-semibold">{t.nome}</span>
                        <span className="col-start-2 flex items-center gap-0.5 md:col-start-auto">
                          <button
                            type="button"
                            onClick={() => mudarStatus(t, proximoStatus(t.status))}
                            className="rounded-full"
                            title={`Mudar para ${ROTULO_STATUS[proximoStatus(t.status)]}`}
                            aria-label={`Status: ${ROTULO_STATUS[t.status]}. Clique para mudar para ${ROTULO_STATUS[proximoStatus(t.status)]}`}
                          >
                            <PillStatus status={t.status} />
                          </button>
                          <MenuAcoes
                            rotulo="Escolher status"
                            gatilho={<ChevronDown size={15} />}
                            itens={ORDEM_STATUS.map((s) => ({
                              rotulo: ROTULO_STATUS[s],
                              marcado: t.status === s,
                              icone: <Check size={15} className={t.status === s ? "" : "invisible"} />,
                              aoClicar: () => mudarStatus(t, s),
                            }))}
                          />
                        </span>
                        <span className="col-start-3 row-start-1 flex justify-end gap-0.5 opacity-100 transition-opacity md:col-start-auto md:row-start-auto md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                          <BotaoIcone rotulo={`Renomear ${t.nome}`} onClick={() => setModalTopico({ topico: t })}>
                            <Pencil size={15} />
                          </BotaoIcone>
                          <BotaoIcone rotulo={`Excluir ${t.nome}`} onClick={() => excluirTopico(t)} className="hover:text-erro">
                            <Trash2 size={15} />
                          </BotaoIcone>
                        </span>
                      </div>
                    )}
                  </ItemArrastavel>
                ))}
              </ul>
            </ListaArrastavel>
            {filtro !== "todos" && <p className="mt-4 text-xs text-texto-2">Para arrastar, volte para a aba &quot;Todos&quot;.</p>}
          </>
        )}
      </div>

      {modalTopico && materia && (
        <ModalTopico
          materiaId={materia.id}
          topico={modalTopico.topico}
          proximaOrdem={topicos.length}
          fechar={() => setModalTopico(null)}
          aoSalvar={(salvos, editado) => {
            trocarTopicos(editado ? topicos.map((t) => (t.id === salvos[0].id ? salvos[0] : t)) : [...topicos, ...salvos]);
            setModalTopico(null);
            avisar({ texto: editado ? "Tópico renomeado" : salvos.length > 1 ? `${salvos.length} tópicos adicionados` : "Tópico adicionado" });
          }}
        />
      )}

      {renomeandoMateria && materia && (
        <ModalMateria
          materia={materia}
          proximaOrdem={0}
          fechar={() => setRenomeandoMateria(false)}
          aoSalvar={(m) => {
            if (dados) setDados({ ...dados, materia: m });
            setRenomeandoMateria(false);
            avisar({ texto: "Matéria renomeada" });
          }}
        />
      )}
    </div>
  );
}

function ModalTopico({
  materiaId,
  topico,
  proximaOrdem,
  fechar,
  aoSalvar,
}: {
  materiaId: string;
  topico?: Topico;
  proximaOrdem: number;
  fechar: () => void;
  aoSalvar: (salvos: Topico[], editado: boolean) => void;
}) {
  const [texto, setTexto] = useState(topico?.nome ?? "");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    const nomes = topico
      ? [texto.trim()].filter(Boolean)
      : texto
          .split("\n")
          .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "").trim())
          .filter(Boolean);
    if (nomes.length === 0) {
      setErro("Escreva o nome do tópico.");
      return;
    }
    setEnviando(true);
    const sb = supabase();
    const { data, error } = topico
      ? await sb.from("topicos").update({ nome: nomes[0] }).eq("id", topico.id).select()
      : await sb
          .from("topicos")
          .insert(nomes.map((nome, i) => ({ nome, materia_id: materiaId, ordem: proximaOrdem + i })))
          .select();
    setEnviando(false);
    if (error || !data?.length) {
      setErro("Não deu para salvar. Tente de novo.");
      return;
    }
    aoSalvar(data as Topico[], Boolean(topico));
  }

  return (
    <ModalFormulario
      titulo={topico ? "Renomear tópico" : "Adicionar tópico"}
      fechar={fechar}
      aoEnviar={salvar}
      rotuloAcao={topico ? "Guardar nome" : "Adicionar"}
      enviando={enviando}
    >
      {topico ? (
        <Campo id="topico-nome" rotulo="Nome do tópico" erro={erro}>
          <input
            id="topico-nome"
            className={estiloInput}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setErro("");
            }}
            aria-invalid={Boolean(erro)}
          />
        </Campo>
      ) : (
        <Campo id="topico-nomes" rotulo="Tópicos" erro={erro} dica="Um por linha. Dá para colar a lista direto do edital.">
          <textarea
            id="topico-nomes"
            rows={6}
            className={`${estiloInput} resize-y leading-relaxed`}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setErro("");
            }}
            placeholder={"Ex.:\nAtos administrativos\nPoderes administrativos"}
            aria-invalid={Boolean(erro)}
          />
        </Campo>
      )}
    </ModalFormulario>
  );
}
