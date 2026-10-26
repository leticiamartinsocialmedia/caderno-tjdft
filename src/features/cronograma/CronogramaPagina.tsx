"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Circle,
  ExternalLink,
  FolderOpen,
  ListTodo,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useConsulta } from "@/lib/useConsulta";
import { useTempoReal } from "@/lib/tempoReal";
import {
  buscarTodos,
  useEditalBasico,
  type MateriaBasica,
  type TopicoBasico,
} from "@/lib/useEditalBasico";
import { formatarData, hojeSP, somarDias } from "@/lib/datas";
import { normalizarLink } from "@/features/bisus/fontes";
import type { ItemCronograma, TipoAula } from "@/lib/tipos";
import { Abas, CabecalhoPagina } from "@/components/ui/Cabecalho";
import { Botao } from "@/components/ui/Botao";
import { MenuAcoes } from "@/components/ui/Menu";
import {
  EstadoErro,
  EstadoVazio,
  EsqueletoLista,
} from "@/components/ui/Estados";
import { Pill } from "@/components/ui/Selos";
import { BarraProgresso } from "@/components/ui/Barra";
import { Modal, ModalFormulario } from "@/components/ui/Modal";
import { Campo, estiloInput } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import { ModalSessao } from "@/features/questoes/ModalSessao";
import { lerCronogramaGran, materiaDaDisciplina, nomeCurto } from "./gran";
import {
  TIPO_AULA,
  importarAulas,
  rotuloDia,
  situacao,
  tituloDia,
} from "./dados";

type Aba = "agenda" | "concluidas" | "todas";

async function carregar() {
  const sb = supabase();
  try {
    const itens = await buscarTodos<ItemCronograma>((de, ate) =>
      sb
        .from("cronograma")
        .select("*")
        .order("data")
        .order("ordem")
        .range(de, ate),
    );
    itens.sort((a, b) => a.data.localeCompare(b.data) || a.ordem - b.ordem);
    return { itens, semTabela: false };
  } catch (e) {
    // Antes do SQL 0004 a tabela não existe: a página explica o que fazer em vez de dar erro.
    if (["42P01", "PGRST205"].includes(String((e as { code?: string })?.code)))
      return { itens: [], semTabela: true };
    throw e;
  }
}

export function CronogramaPagina() {
  const { avisar, excluirComDesfazer } = useToast();
  const edital = useEditalBasico();
  const hoje = hojeSP();
  const { dados, setDados, carregando, erro, recarregar, atualizar } =
    useConsulta(carregar);
  useTempoReal(["cronograma"], atualizar);
  const [aba, setAba] = useState<Aba>("agenda");
  const [materiaFiltro, setMateriaFiltro] = useState("");
  const [modal, setModal] = useState<
    null | "importar" | { item?: ItemCronograma }
  >(null);
  const [sessao, setSessao] = useState<ItemCronograma | null>(null);
  // Com o cronograma inteiro (centenas de dias), a lista mostra 14 dias por vez.
  const [limiteDias, setLimiteDias] = useState(14);

  const itens = useMemo(() => dados?.itens ?? [], [dados]);
  const contas = useMemo(() => {
    const c = { atrasadas: 0, hoje: 0, semana: 0, concluidas: 0 };
    const fimSemana = somarDias(hoje, 7);
    for (const i of itens) {
      const s = situacao(i, hoje);
      if (s === "concluida") c.concluidas++;
      else if (s === "atrasada") c.atrasadas++;
      else if (s === "hoje") c.hoje++;
      else if (i.data <= fimSemana) c.semana++;
    }
    return c;
  }, [itens, hoje]);

  const disciplinas = useMemo(
    () =>
      [...new Set(itens.map((i) => i.disciplina))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [itens],
  );

  const visiveis = useMemo(
    () =>
      itens.filter((i) => {
        if (materiaFiltro && i.disciplina !== materiaFiltro) return false;
        if (aba === "agenda") return !i.concluido;
        if (aba === "concluidas") return i.concluido;
        return true;
      }),
    [itens, aba, materiaFiltro],
  );

  // Agrupa por dia; na agenda, as atrasadas ficam em cima, no dia original delas.
  const dias = useMemo(() => {
    const mapa = new Map<string, ItemCronograma[]>();
    for (const i of visiveis)
      mapa.set(i.data, [...(mapa.get(i.data) ?? []), i]);
    const lista = [...mapa.entries()].map(([data, aulas]) => ({ data, aulas }));
    return aba === "concluidas" ? lista.reverse() : lista;
  }, [visiveis, aba]);

  function trocar(novos: ItemCronograma[]) {
    if (dados) setDados({ ...dados, itens: novos });
  }

  async function alternar(item: ItemCronograma) {
    const antes = itens;
    const concluido = !item.concluido;
    const concluido_em = concluido ? new Date().toISOString() : null;
    trocar(
      itens.map((i) =>
        i.id === item.id ? { ...i, concluido, concluido_em } : i,
      ),
    );
    const { error } = await supabase()
      .from("cronograma")
      .update({ concluido, concluido_em })
      .eq("id", item.id);
    if (error) {
      trocar(antes);
      avisar({ texto: "Não deu para salvar. Tente de novo.", tipo: "erro" });
      return;
    }
    if (concluido && item.tipo !== "revisao") {
      avisar({
        texto: "Aula concluída",
        acao: { rotulo: "Registrar sessão", fn: () => setSessao(item) },
        duracao: 6000,
      });
    }
  }

  function excluir(item: ItemCronograma) {
    const copia = itens;
    excluirComDesfazer({
      texto: "Aula tirada do cronograma",
      esconder: () => trocar(copia.filter((i) => i.id !== item.id)),
      restaurar: () => trocar(copia),
      apagar: async () => {
        const { error } = await supabase()
          .from("cronograma")
          .delete()
          .eq("id", item.id);
        if (error) throw error;
      },
    });
  }

  if (erro)
    return (
      <EstadoErro
        texto="Não deu para carregar o cronograma."
        tentarDeNovo={recarregar}
      />
    );

  const total = itens.length;
  const pct = total ? (contas.concluidas / total) * 100 : 0;
  const nomeMateria = new Map(edital.materias.map((m) => [m.id, m.nome]));
  const materiaDoTopico = new Map(edital.topicos.map((t) => [t.id, t]));

  return (
    <div className="flex flex-col">
      <CabecalhoPagina
        titulo="Cronograma"
        subtitulo={
          total > 0 && (
            <span className="tabular">
              {total} aulas · {Math.round(pct)}% concluído
            </span>
          )
        }
        acoes={
          <>
            <Botao
              icone={<Upload size={15} />}
              onClick={() => setModal("importar")}
              disabled={dados?.semTabela}
            >
              Importar do Gran
            </Botao>
            <Botao
              variante="primario"
              icone={<Plus size={15} />}
              onClick={() => setModal({})}
              disabled={dados?.semTabela}
            >
              Adicionar aula
            </Botao>
          </>
        }
      />

      {dados?.semTabela && (
        <p
          className="mt-4 rounded-md border border-alerta bg-alerta-suave px-3 py-2 text-[13px]"
          role="alert"
        >
          O cronograma fica disponível depois que o SQL 0004 for rodado no
          Supabase.
        </p>
      )}

      {total > 0 && (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {
                r: "Atrasadas",
                v: contas.atrasadas,
                cor: contas.atrasadas ? "text-erro" : "",
                d: contas.atrasadas ? "para pôr em dia" : "nada atrasado",
              },
              {
                r: "Hoje",
                v: contas.hoje,
                cor: "",
                d: contas.hoje === 1 ? "aula" : "aulas",
              },
              {
                r: "Próximos 7 dias",
                v: contas.semana,
                cor: "",
                d: "depois de hoje",
              },
              {
                r: "Concluídas",
                v: contas.concluidas,
                cor: "text-sucesso",
                d: `de ${total}`,
              },
            ].map((x) => (
              <div
                key={x.r}
                className="rounded-lg border border-borda-card p-3"
              >
                <dt className="text-xs font-semibold text-texto-2">{x.r}</dt>
                <dd
                  className={`tabular mt-1 text-[22px] leading-none font-extrabold ${x.cor}`}
                >
                  {x.v}
                </dd>
                <dd className="mt-1 text-xs text-texto-2">{x.d}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 max-w-md">
            <BarraProgresso
              valor={pct}
              cor="verde"
              rotulo={`${Math.round(pct)}% do cronograma concluído`}
            />
          </div>
        </>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-4">
        <Abas<Aba>
          abas={[
            {
              id: "agenda",
              rotulo: "A fazer",
              icone: ListTodo,
              contagem: total - contas.concluidas,
            },
            {
              id: "concluidas",
              rotulo: "Concluídas",
              icone: CalendarCheck2,
              contagem: contas.concluidas,
            },
            {
              id: "todas",
              rotulo: "Tudo",
              icone: CalendarDays,
              contagem: total,
            },
          ]}
          ativa={aba}
          aoTrocar={(a) => {
            setAba(a);
            setLimiteDias(14);
          }}
        />
        {disciplinas.length > 1 && (
          <div className="mt-3 w-full sm:w-64">
            <label htmlFor="filtro-disciplina" className="sr-only">
              Filtrar por disciplina
            </label>
            <select
              id="filtro-disciplina"
              className={estiloInput}
              value={materiaFiltro}
              onChange={(e) => {
                setMateriaFiltro(e.target.value);
                setLimiteDias(14);
              }}
            >
              <option value="">Todas as disciplinas</option>
              {disciplinas.map((d) => (
                <option key={d} value={d}>
                  {nomeCurto(d)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-4">
        {carregando && !dados ? (
          <EsqueletoLista />
        ) : total === 0 ? (
          <EstadoVazio
            icone={CalendarDays}
            titulo="Seu cronograma está vazio"
            texto="Abra o cronograma no Gran, copie a página inteira e cole aqui. As aulas entram com a data, a matéria e o que você já concluiu."
            acao={
              !dados?.semTabela && (
                <Botao
                  variante="primario"
                  icone={<Upload size={15} />}
                  onClick={() => setModal("importar")}
                >
                  Importar do Gran
                </Botao>
              )
            }
          />
        ) : dias.length === 0 ? (
          <EstadoVazio
            icone={CheckCircle2}
            titulo={aba === "agenda" ? "Tudo em dia" : "Nada aqui"}
            texto={
              aba === "agenda"
                ? "Não há aulas pendentes com esse filtro."
                : "Troque a aba ou o filtro."
            }
          />
        ) : (
          <>
            <ol className="flex flex-col gap-5">
              {dias.slice(0, limiteDias).map(({ data, aulas }) => {
                const atrasado = data < hoje && aulas.some((a) => !a.concluido);
                const feitas = aulas.filter((a) => a.concluido).length;
                return (
                  <li key={data}>
                    <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <h2 className="text-[14px] font-extrabold first-letter:uppercase">
                        {tituloDia(data)}
                      </h2>
                      {data === hoje ? (
                        <Pill tipo="andamento">Hoje</Pill>
                      ) : atrasado ? (
                        <Pill tipo="vermelho">
                          Atrasado · {rotuloDia(data, hoje).toLowerCase()}
                        </Pill>
                      ) : (
                        <span className="text-xs text-texto-2">
                          {rotuloDia(data, hoje)}
                        </span>
                      )}
                      {aba === "todas" && (
                        <span className="tabular ml-auto text-xs text-texto-2">
                          {feitas} de {aulas.length}
                        </span>
                      )}
                    </div>
                    <ul className="rounded-lg border border-borda-card bg-superficie">
                      {aulas.map((a) => {
                        const Tipo = TIPO_AULA[a.tipo];
                        const topico = a.topico_id
                          ? materiaDoTopico.get(a.topico_id)
                          : undefined;
                        return (
                          <li
                            key={a.id}
                            className="flex items-start gap-3 border-b border-borda px-3 py-2.5 last:border-b-0"
                          >
                            <button
                              type="button"
                              onClick={() => alternar(a)}
                              aria-pressed={a.concluido}
                              aria-label={
                                a.concluido
                                  ? `Desmarcar ${a.aula}`
                                  : `Concluir ${a.aula}`
                              }
                              title={
                                a.concluido
                                  ? "Desmarcar"
                                  : "Marcar como concluída"
                              }
                              className="-m-1.5 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-hover"
                            >
                              {a.concluido ? (
                                <CheckCircle2
                                  size={22}
                                  className="text-sucesso"
                                />
                              ) : (
                                <Circle
                                  size={22}
                                  className={
                                    atrasado ? "text-erro" : "text-texto-2"
                                  }
                                />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setModal({ item: a })}
                              className="min-w-0 flex-1 py-0.5 text-left"
                            >
                              <span className="block text-xs font-bold text-texto-2">
                                {a.tipo === "revisao" &&
                                a.disciplina === "Revisão"
                                  ? "Revisão"
                                  : nomeCurto(a.disciplina)}
                                {!a.materia_id && a.tipo !== "revisao" && (
                                  <span className="font-semibold">
                                    {" "}
                                    · fora do edital
                                  </span>
                                )}
                              </span>
                              <span
                                className={`block text-[14px] leading-snug font-semibold ${a.concluido ? "text-texto-2 line-through decoration-texto-2/50" : ""}`}
                              >
                                {a.aula}
                              </span>
                            </button>
                            <span className="flex shrink-0 items-center gap-1 self-center">
                              <span className="hidden items-center gap-1 text-xs text-texto-2 sm:inline-flex">
                                <Tipo.icone size={14} aria-hidden />{" "}
                                {Tipo.rotulo}
                              </span>
                              {a.link && (
                                <a
                                  href={a.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex size-9 items-center justify-center rounded-md text-texto-2 hover:bg-hover hover:text-texto"
                                  title="Abrir a aula"
                                >
                                  <ExternalLink size={15} />
                                  <span className="sr-only">Abrir a aula</span>
                                </a>
                              )}
                              {(topico || a.materia_id) && (
                                <Link
                                  href={
                                    topico
                                      ? `/edital/${topico.materia_id}/${topico.id}`
                                      : `/edital/${a.materia_id}`
                                  }
                                  className="flex size-9 items-center justify-center rounded-md text-texto-2 hover:bg-hover hover:text-texto"
                                  title={
                                    topico
                                      ? `Abrir o tópico: ${topico.nome}`
                                      : `Abrir a matéria: ${nomeMateria.get(a.materia_id!) ?? ""}`
                                  }
                                >
                                  <FolderOpen size={15} />
                                  <span className="sr-only">
                                    Abrir no edital
                                  </span>
                                </Link>
                              )}
                              <MenuAcoes
                                rotulo={`Ações de ${a.aula}`}
                                itens={[
                                  {
                                    rotulo: "Editar",
                                    icone: <Pencil size={15} />,
                                    aoClicar: () => setModal({ item: a }),
                                  },
                                  "separador",
                                  {
                                    rotulo: "Tirar do cronograma",
                                    icone: <Trash2 size={15} />,
                                    aoClicar: () => excluir(a),
                                    perigo: true,
                                  },
                                ]}
                              />
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ol>
            {dias.length > limiteDias && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Botao onClick={() => setLimiteDias((n) => n + 14)}>
                  Mostrar mais dias
                </Botao>
                <span className="tabular text-xs text-texto-2">
                  {limiteDias} de {dias.length} dias
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {modal === "importar" && (
        <ModalImportar
          hoje={hoje}
          existentes={itens.length}
          materias={edital.materias}
          fechar={() => setModal(null)}
          aoImportar={(texto) => {
            setModal(null);
            avisar({ texto, duracao: 6000 });
            void atualizar();
          }}
        />
      )}
      {modal && modal !== "importar" && (
        <ModalAula
          item={modal.item}
          hoje={hoje}
          disciplinas={disciplinas}
          materias={edital.materias}
          topicos={edital.topicos}
          proximaOrdem={(d) => itens.filter((i) => i.data === d).length}
          fechar={() => setModal(null)}
          aoSalvar={(salvo, novo) => {
            const lista = novo
              ? [...itens, salvo]
              : itens.map((i) => (i.id === salvo.id ? salvo : i));
            trocar(
              lista.sort(
                (a, b) => a.data.localeCompare(b.data) || a.ordem - b.ordem,
              ),
            );
            setModal(null);
            avisar({ texto: novo ? "Aula adicionada" : "Aula atualizada" });
          }}
        />
      )}
      {sessao && (
        <ModalSessao
          materias={edital.materias}
          topicos={edital.topicos}
          materiaInicial={sessao.materia_id ?? undefined}
          topicoInicial={sessao.topico_id ?? undefined}
          fechar={() => setSessao(null)}
          aoSalvar={() => {
            setSessao(null);
            avisar({ texto: "Sessão registrada" });
          }}
        />
      )}
    </div>
  );
}

function ModalImportar({
  hoje,
  existentes,
  materias,
  fechar,
  aoImportar,
}: {
  hoje: string;
  existentes: number;
  materias: MateriaBasica[];
  fechar: () => void;
  aoImportar: (resumo: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [modo, setModo] = useState<"juntar" | "limpar">(
    existentes > 0 ? "limpar" : "juntar",
  );
  const leitura = useMemo(
    () => (texto.trim() ? lerCronogramaGran(texto, hoje) : null),
    [texto, hoje],
  );
  const aulas = useMemo(() => leitura?.aulas ?? [], [leitura]);
  const resumo = useMemo(() => {
    if (!aulas.length) return null;
    const datas = aulas.map((a) => a.data).sort();
    const feitas = aulas.filter((a) => a.concluido).length;
    const atrasadas = aulas.filter((a) => !a.concluido && a.data < hoje).length;
    const semMateria = [
      ...new Set(
        aulas
          .filter(
            (a) =>
              a.tipo !== "revisao" &&
              !materiaDaDisciplina(a.disciplina, materias),
          )
          .map((a) => a.disciplina),
      ),
    ];
    return { de: datas[0], ate: datas.at(-1)!, feitas, atrasadas, semMateria };
  }, [aulas, hoje, materias]);

  async function importar() {
    setEnviando(true);
    setErro("");
    try {
      const r = await importarAulas(aulas, materias, modo);
      if (modo === "limpar") {
        aoImportar(`Cronograma substituído: ${r.novas} aulas, iguais ao Gran`);
        return;
      }
      const partes = [
        `${r.novas} ${r.novas === 1 ? "aula nova" : "aulas novas"}`,
      ];
      if (r.concluidas) partes.push(`${r.concluidas} marcadas como concluídas`);
      aoImportar(
        r.novas || r.concluidas
          ? `Cronograma importado: ${partes.join(", ")}`
          : "Nada novo: essas aulas já estavam no cronograma",
      );
    } catch {
      setErro(
        "Não deu para importar. Confira se o SQL 0004 foi rodado no Supabase e tente de novo.",
      );
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo="Importar cronograma do Gran"
      fechar={fechar}
      largura="max-w-2xl"
      rodape={
        <>
          <Botao onClick={fechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            onClick={importar}
            disabled={!aulas.length || enviando}
          >
            {aulas.length
              ? modo === "limpar"
                ? `Substituir por ${aulas.length} aulas`
                : `Importar ${aulas.length} aulas`
              : "Importar"}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13.5px] leading-relaxed">
          <li>
            No Gran, abra o seu cronograma (a página com a tabela &quot;Dia de
            estudo, Aula, Tipo, Concluído&quot;).
          </li>
          <li>
            Aperte <b>Ctrl+A</b> e depois <b>Ctrl+C</b> (no Mac, <b>⌘A</b> e{" "}
            <b>⌘C</b>).
          </li>
          <li>
            Cole aqui embaixo. Pode colar o mês inteiro ou vários meses de uma
            vez.
          </li>
        </ol>
        <Campo id="cronograma-texto" rotulo="Cronograma copiado" erro={erro}>
          <textarea
            id="cronograma-texto"
            rows={8}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className={`${estiloInput} resize-y font-mono text-xs sm:text-xs`}
            placeholder={
              "Outubro/2026\nDia de estudo\tAula\tTipo\tConcluído\n13 - Terça-feira\tNoções de Direito Constitucional | 1 - Teoria da Constituição\tVideoaula\tSim"
            }
          />
        </Campo>
        {existentes > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] font-semibold">
              O que fazer com as {existentes} aulas que já estão no cronograma?
            </legend>
            {(
              [
                [
                  "limpar",
                  "Limpar tudo e substituir pelo que colei",
                  "Apaga o cronograma atual, inclusive aulas adicionadas à mão, e grava exatamente o que veio do Gran: datas, ordem e o que está concluído.",
                ],
                [
                  "juntar",
                  "Juntar ao que já está",
                  "Só entram as aulas que faltam. O que você concluiu no app continua concluído.",
                ],
              ] as const
            ).map(([id, titulo, texto]) => (
              <label
                key={id}
                className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px] leading-relaxed ${modo === id ? "border-texto" : "border-borda"}`}
              >
                <input
                  type="radio"
                  name="modo-importar"
                  checked={modo === id}
                  onChange={() => setModo(id)}
                  className="mt-0.5 size-5 shrink-0 accent-rosa"
                />
                <span>
                  <b className="block text-[13.5px]">{titulo}</b>
                  {texto}
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {leitura && (
          <div
            className="rounded-md border border-borda bg-hover/50 px-3 py-2.5 text-[13px] leading-relaxed"
            aria-live="polite"
          >
            {resumo ? (
              <>
                <p className="font-bold">
                  {aulas.length} aulas de {formatarData(resumo.de)} a{" "}
                  {formatarData(resumo.ate)}
                </p>
                <p className="text-texto-2">
                  {resumo.feitas} já concluídas · {resumo.atrasadas} atrasadas ·{" "}
                  {aulas.length - resumo.feitas - resumo.atrasadas} para frente
                </p>
                {resumo.semMateria.length > 0 && (
                  <p className="mt-1 text-texto-2">
                    Fora do edital (entram sem matéria):{" "}
                    {resumo.semMateria.join(", ")}.
                  </p>
                )}
                {modo === "juntar" && (
                  <p className="mt-1 text-texto-2">
                    Aulas que já estão aqui não se repetem, e nada que você
                    concluiu volta a ficar pendente.
                  </p>
                )}
              </>
            ) : (
              <p className="font-semibold text-erro">
                Não achei nenhuma aula nesse texto. Copie a página inteira do
                cronograma e cole de novo.
              </p>
            )}
            {leitura.avisos.slice(0, 3).map((a) => (
              <p key={a} className="mt-1 text-alerta">
                {a}
              </p>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ModalAula({
  item,
  hoje,
  disciplinas,
  materias,
  topicos,
  proximaOrdem,
  fechar,
  aoSalvar,
}: {
  item?: ItemCronograma;
  hoje: string;
  disciplinas: string[];
  materias: MateriaBasica[];
  topicos: TopicoBasico[];
  proximaOrdem: (data: string) => number;
  fechar: () => void;
  aoSalvar: (item: ItemCronograma, novo: boolean) => void;
}) {
  const [data, setData] = useState(item?.data ?? hoje);
  const [disciplina, setDisciplina] = useState(item?.disciplina ?? "");
  const [aula, setAula] = useState(item?.aula ?? "");
  const [tipo, setTipo] = useState<TipoAula>(item?.tipo ?? "videoaula");
  const [materiaId, setMateriaId] = useState(item?.materia_id ?? "");
  const [topicoId, setTopicoId] = useState(item?.topico_id ?? "");
  const [link, setLink] = useState(item?.link ?? "");
  const [concluido, setConcluido] = useState(item?.concluido ?? false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const opcoesDisciplina = useMemo(
    () => [...new Set([...disciplinas, ...materias.map((m) => m.nome)])],
    [disciplinas, materias],
  );

  function mudarDisciplina(v: string) {
    setDisciplina(v);
    // Escolheu uma disciplina com o nome de uma matéria do edital: já liga as duas.
    const m = materiaDaDisciplina(v, materias);
    if (m && !materiaId) setMateriaId(m.id);
  }

  async function salvar() {
    const e: Record<string, string> = {};
    if (!data) e.data = "Escolha a data.";
    if (!disciplina.trim()) e.disciplina = "Escreva a disciplina.";
    if (!aula.trim()) e.aula = "Escreva o nome da aula.";
    const linkOk = link.trim() ? normalizarLink(link) : null;
    if (link.trim() && !linkOk) e.link = "Esse link não parece válido.";
    setErros(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    const registro = {
      data,
      disciplina: disciplina.trim(),
      aula: aula.trim(),
      tipo,
      materia_id: materiaId || null,
      topico_id: materiaId ? topicoId || null : null,
      link: linkOk,
      concluido,
      concluido_em: concluido
        ? (item?.concluido_em ?? new Date().toISOString())
        : null,
    };
    const sb = supabase();
    const { data: salvo, error } = item
      ? await sb
          .from("cronograma")
          .update(registro)
          .eq("id", item.id)
          .select()
          .single()
      : await sb
          .from("cronograma")
          .insert({ ...registro, ordem: proximaOrdem(data), origem: "manual" })
          .select()
          .single();
    if (error || !salvo) {
      setErros({
        geral:
          error?.code === "23505"
            ? "Essa aula já está nesse dia."
            : "Não deu para guardar. Tente de novo.",
      });
      setEnviando(false);
      return;
    }
    aoSalvar(salvo as ItemCronograma, !item);
  }

  return (
    <ModalFormulario
      titulo={item ? "Editar aula" : "Adicionar aula"}
      fechar={fechar}
      aoEnviar={salvar}
      rotuloAcao="Guardar"
      enviando={enviando}
      largura="max-w-xl"
    >
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <Campo id="aula-data" rotulo="Dia" erro={erros.data}>
          <input
            id="aula-data"
            type="date"
            className={estiloInput}
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </Campo>
        <Campo id="aula-disciplina" rotulo="Disciplina" erro={erros.disciplina}>
          <input
            id="aula-disciplina"
            list="aula-disciplinas"
            className={estiloInput}
            value={disciplina}
            onChange={(e) => mudarDisciplina(e.target.value)}
            placeholder="Ex.: Noções de Direito Penal"
          />
          <datalist id="aula-disciplinas">
            {opcoesDisciplina.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Campo>
      </div>
      <Campo id="aula-nome" rotulo="Aula" erro={erros.aula}>
        <input
          id="aula-nome"
          className={estiloInput}
          value={aula}
          onChange={(e) => setAula(e.target.value)}
          placeholder="Ex.: 3 - Princípios do Direito Penal - Legalidade"
        />
      </Campo>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TIPO_AULA) as TipoAula[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tipo === t}
              onClick={() => setTipo(t)}
              className={`h-9 rounded-full border px-3 text-[12.5px] font-semibold ${tipo === t ? "border-texto bg-texto text-fundo" : "border-borda text-texto-2 hover:bg-hover"}`}
            >
              {TIPO_AULA[t].rotulo}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="aula-materia"
          rotulo="Matéria do edital"
          dica="Liga a aula ao edital."
        >
          <select
            id="aula-materia"
            className={estiloInput}
            value={materiaId}
            onChange={(e) => {
              setMateriaId(e.target.value);
              setTopicoId("");
            }}
          >
            <option value="">Nenhuma</option>
            {materias.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="aula-topico" rotulo="Tópico (opcional)">
          <select
            id="aula-topico"
            className={estiloInput}
            value={topicoId}
            onChange={(e) => setTopicoId(e.target.value)}
            disabled={!materiaId}
          >
            <option value="">Nenhum</option>
            {topicos
              .filter((t) => t.materia_id === materiaId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
          </select>
        </Campo>
      </div>
      <Campo id="aula-link" rotulo="Link da aula (opcional)" erro={erros.link}>
        <input
          id="aula-link"
          type="url"
          inputMode="url"
          className={estiloInput}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://www.grancursosonline.com.br/..."
        />
      </Campo>
      <label className="flex min-h-10 items-center gap-2.5 text-[13.5px] font-semibold">
        <input
          type="checkbox"
          checked={concluido}
          onChange={(e) => setConcluido(e.target.checked)}
          className="size-5 accent-rosa"
        />
        Já concluí esta aula
      </label>
      {erros.geral && (
        <p
          className="rounded-md bg-erro-suave px-3 py-2 text-[13px] font-medium text-erro"
          role="alert"
        >
          {erros.geral}
        </p>
      )}
    </ModalFormulario>
  );
}
