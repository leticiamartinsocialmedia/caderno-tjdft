"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, BookX, CheckCircle2, Circle, ExternalLink, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useConsulta } from "@/lib/useConsulta";
import { useTempoReal } from "@/lib/tempoReal";
import { buscarTodos, useEditalBasico } from "@/lib/useEditalBasico";
import { contem } from "@/lib/grifo";
import { dataSP, formatarData } from "@/lib/datas";
import { motivoMaisComum } from "@/lib/desempenho";
import { porNaRevisao, tirarDaRevisao } from "@/lib/filaRevisao";
import type { Erro, MotivoErro } from "@/lib/tipos";
import { Abas, CabecalhoPagina } from "@/components/ui/Cabecalho";
import { Botao } from "@/components/ui/Botao";
import { EstadoErro, EstadoVazio, EsqueletoLista } from "@/components/ui/Estados";
import { Badge, Pill } from "@/components/ui/Selos";
import { MenuAcoes } from "@/components/ui/Menu";
import { estiloInput } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/components/shell/AppContext";
import { ROTULO_GABARITO } from "@/features/revisoes/dados";
import { DICA_MOTIVO, MOTIVOS, ROTULO_MOTIVO } from "./motivos";
import { ModalErro } from "./ModalErro";

type Aba = "pendentes" | "revisados" | "analise";
const POR_PAGINA = 30;

export function ErrosPagina() {
  const router = useRouter();
  const params = useSearchParams();
  const { usuario } = useApp();
  const { avisar, excluirComDesfazer } = useToast();
  const edital = useEditalBasico();
  const { dados, setDados, carregando, erro, recarregar, atualizar } = useConsulta(() =>
    buscarTodos<Erro>((de, ate) => supabase().from("erros").select("*").order("created_at", { ascending: false }).range(de, ate)),
  );
  useTempoReal(["erros"], atualizar);
  const [aba, setAba] = useState<Aba>("pendentes");
  const [materia, setMateria] = useState("");
  const [motivo, setMotivo] = useState<"" | MotivoErro>("");
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);
  const [modal, setModal] = useState<{ erro?: Erro } | null>(null);

  const erros = useMemo(() => dados ?? [], [dados]);

  // Link vindo da revisão ou da busca: /erros?abrir=<id> abre o erro para editar.
  const abrir = params.get("abrir");
  useEffect(() => {
    if (!abrir || !dados) return;
    const alvo = dados.find((e) => e.id === abrir);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (alvo) setModal({ erro: alvo });
    router.replace("/erros");
  }, [abrir, dados, router]);

  const visiveis = useMemo(
    () =>
      erros.filter(
        (e) =>
          (aba === "analise" || (aba === "pendentes" ? !e.revisado : e.revisado)) &&
          (!materia || e.materia_id === materia) &&
          (!motivo || e.motivo === motivo) &&
          (!busca.trim() || contem(e.assertiva, busca) || contem(e.regra, busca)),
      ),
    [erros, aba, materia, motivo, busca],
  );

  function trocar(novo: Erro) {
    setDados(erros.map((e) => (e.id === novo.id ? novo : e)));
  }

  async function alternarRevisado(e: Erro) {
    const novo = { ...e, revisado: !e.revisado };
    trocar(novo);
    const { error } = await supabase().from("erros").update({ revisado: novo.revisado }).eq("id", e.id);
    if (error) {
      trocar(e);
      avisar({ texto: "Não deu para salvar.", tipo: "erro" });
      return;
    }
    avisar({ texto: novo.revisado ? "Marcado como revisado" : "Voltou para revisar" });
  }

  async function revisar(e: Erro) {
    try {
      const data = await porNaRevisao(usuario.id, "erro", e.id);
      avisar({ texto: `Na fila de revisões: ${formatarData(data)}` });
    } catch {
      avisar({ texto: "Não deu para pôr na revisão.", tipo: "erro" });
    }
  }

  function excluir(e: Erro) {
    const copia = erros;
    excluirComDesfazer({
      texto: "Erro excluído",
      esconder: () => setDados(copia.filter((x) => x.id !== e.id)),
      restaurar: () => setDados(copia),
      apagar: async () => {
        await tirarDaRevisao("erro", e.id);
        const { error } = await supabase().from("erros").delete().eq("id", e.id);
        if (error) throw error;
      },
    });
  }

  // Análise: motivo mais comum no geral e por matéria.
  const analise = useMemo(() => {
    const base = erros.filter((e) => !materia || e.materia_id === materia);
    const contagem = MOTIVOS.map((m) => ({ ...m, quantidade: base.filter((e) => e.motivo === m.id).length }));
    const grupos = new Map<string, Erro[]>();
    for (const e of erros) grupos.set(e.materia_id ?? "", [...(grupos.get(e.materia_id ?? "") ?? []), e]);
    const porMateria = [...grupos]
      .map(([id, lista]) => ({
        id,
        nome: id ? (edital.nomeMateria.get(id) ?? "Matéria excluída") : "Sem matéria",
        total: lista.length,
        principal: motivoMaisComum(lista),
      }))
      .sort((a, b) => b.total - a.total);
    return { total: base.length, geral: motivoMaisComum(base), contagem, porMateria };
  }, [erros, materia, edital.nomeMateria]);

  const maxMotivo = Math.max(1, ...analise.contagem.map((c) => c.quantidade));

  return (
    <div className="flex flex-col">
      <CabecalhoPagina
        titulo="Caderno de erros"
        subtitulo="Cada erro anotado é uma questão a menos errada na prova."
        acoes={
          <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setModal({})} disabled={!edital.materias.length}>
            Adicionar erro
          </Botao>
        }
      />
      <Abas<Aba>
        abas={[
          { id: "pendentes", rotulo: "Para revisar", icone: BookX, contagem: erros.filter((e) => !e.revisado).length },
          { id: "revisados", rotulo: "Revisados", icone: CheckCircle2, contagem: erros.filter((e) => e.revisado).length },
          { id: "analise", rotulo: "Análise", icone: BarChart3 },
        ]}
        ativa={aba}
        aoTrocar={(a) => {
          setAba(a);
          setLimite(POR_PAGINA);
        }}
      />

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_200px_200px]">
        {aba !== "analise" ? (
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-2" />
            <input
              id="busca-erros"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar na assertiva ou na regra"
              aria-label="Buscar erros"
              className={`${estiloInput} pl-9`}
            />
          </div>
        ) : (
          <span />
        )}
        <select id="filtro-materia-erro" aria-label="Matéria" className={estiloInput} value={materia} onChange={(e) => setMateria(e.target.value)}>
          <option value="">Todas as matérias</option>
          {edital.materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
        {aba !== "analise" && (
          <select id="filtro-motivo" aria-label="Motivo" className={estiloInput} value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoErro | "")}>
            <option value="">Todos os motivos</option>
            {MOTIVOS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.rotulo}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4">
        {erro ? (
          <EstadoErro texto="Não deu para carregar os erros." tentarDeNovo={recarregar} />
        ) : carregando && !dados ? (
          <EsqueletoLista />
        ) : erros.length === 0 ? (
          <EstadoVazio
            icone={BookX}
            titulo="Nenhum erro anotado"
            texto="Errou uma questão no TEC? Guarde a assertiva, o gabarito, o motivo e a regra certa."
            acao={
              <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setModal({})}>
                Adicionar erro
              </Botao>
            }
          />
        ) : aba === "analise" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-borda p-4">
              <h2 className="text-[14px] font-extrabold">Motivo mais comum{materia ? ` em ${edital.nomeMateria.get(materia)}` : ""}</h2>
              {analise.geral ? (
                <>
                  <p className="mt-2 text-[22px] font-extrabold">{ROTULO_MOTIVO[analise.geral.motivo]}</p>
                  <p className="tabular text-[13px] text-texto-2">
                    {analise.geral.quantidade} de {analise.total} erros ({Math.round((analise.geral.quantidade / analise.total) * 100)}%)
                  </p>
                  <p className="mt-2 rounded-md bg-hover px-3 py-2 text-[13px]">{DICA_MOTIVO[analise.geral.motivo]}</p>
                </>
              ) : (
                <p className="mt-2 text-[13px] text-texto-2">Sem erros nesta matéria.</p>
              )}
              <ul className="mt-5 flex flex-col gap-2.5">
                {analise.contagem.map((c) => (
                  <li key={c.id} className="grid grid-cols-[150px_1fr_28px] items-center gap-3 text-[13px] sm:grid-cols-[190px_1fr_28px]">
                    <span className="truncate">{c.rotulo}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-hover">
                      <span className="block h-full rounded-full bg-rosa" style={{ width: `${(c.quantidade / maxMotivo) * 100}%` }} />
                    </span>
                    <span className="tabular text-right font-bold">{c.quantidade}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-lg border border-borda p-4">
              <h2 className="text-[14px] font-extrabold">Por matéria</h2>
              <table className="mt-3 w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-borda text-xs font-semibold text-texto-2">
                    <th className="py-2 pr-3 font-semibold">Matéria</th>
                    <th className="py-2 pr-3 text-right font-semibold">Erros</th>
                    <th className="py-2 font-semibold">Motivo mais comum</th>
                  </tr>
                </thead>
                <tbody>
                  {analise.porMateria.map((m) => (
                    <tr key={m.id} className="border-b border-borda text-[13px]">
                      <td className="py-2.5 pr-3 font-semibold">{m.nome}</td>
                      <td className="tabular py-2.5 pr-3 text-right">{m.total}</td>
                      <td className="py-2.5 text-texto-2">{m.principal ? ROTULO_MOTIVO[m.principal.motivo] : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        ) : visiveis.length === 0 ? (
          <EstadoVazio
            icone={aba === "pendentes" ? CheckCircle2 : Search}
            titulo={aba === "pendentes" && !busca && !materia && !motivo ? "Nenhum erro para revisar" : "Nenhum erro encontrado"}
          />
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {visiveis.slice(0, limite).map((e) => (
                <li key={e.id} className="flex flex-col rounded-lg border border-borda-card bg-superficie p-4">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => alternarRevisado(e)}
                      aria-pressed={e.revisado}
                      title={e.revisado ? "Desmarcar revisado" : "Marcar como revisado"}
                      aria-label={e.revisado ? "Desmarcar revisado" : "Marcar como revisado"}
                      className="mt-0.5 shrink-0 rounded-full"
                    >
                      {e.revisado ? <CheckCircle2 size={22} className="text-sucesso" /> : <Circle size={22} className="text-texto-2" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-texto-2">
                        {e.materia_id ? edital.nomeMateria.get(e.materia_id) : "Sem matéria"}
                        {e.topico_id && edital.nomeTopico.get(e.topico_id) ? ` · ${edital.nomeTopico.get(e.topico_id)}` : ""}
                      </p>
                      <p className="mt-1 text-[14px] leading-relaxed">{e.assertiva}</p>
                    </div>
                    <MenuAcoes
                      rotulo="Ações do erro"
                      itens={[
                        { rotulo: "Editar", icone: <Pencil size={15} />, aoClicar: () => setModal({ erro: e }) },
                        { rotulo: "Pôr na revisão", icone: <RotateCcw size={15} />, aoClicar: () => revisar(e) },
                        "separador",
                        { rotulo: "Excluir", icone: <Trash2 size={15} />, aoClicar: () => excluir(e), perigo: true },
                      ]}
                    />
                  </div>
                  {e.regra && <p className="mt-3 rounded-md bg-hover px-3 py-2 text-[13px] leading-relaxed">{e.regra}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-texto-2">
                    <Badge cor={e.gabarito === "certo" ? "verde" : e.gabarito === "errado" ? "rosa" : "amarelo"}>
                      Gabarito: {ROTULO_GABARITO[e.gabarito]}
                    </Badge>
                    <Pill>{ROTULO_MOTIVO[e.motivo]}</Pill>
                    <span className="tabular">{formatarData(dataSP(e.created_at))}</span>
                    {e.link_tec && (
                      <a href={e.link_tec} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-semibold text-rosa-texto hover:underline">
                        Ver no TEC <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
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
        <ModalErro
          erro={modal.erro}
          materias={edital.materias}
          topicos={edital.topicos}
          fechar={() => setModal(null)}
          aoSalvar={(e, novo) => {
            setDados(novo ? [e, ...erros] : erros.map((x) => (x.id === e.id ? e : x)));
            setModal(null);
            avisar({ texto: novo ? "Erro guardado" : "Erro atualizado" });
          }}
        />
      )}
    </div>
  );
}
