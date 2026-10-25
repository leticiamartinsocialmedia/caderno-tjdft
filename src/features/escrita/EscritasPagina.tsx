"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileClock, PenLine, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useConsulta } from "@/lib/useConsulta";
import { useTempoReal } from "@/lib/tempoReal";
import { buscarTodos, useEditalBasico } from "@/lib/useEditalBasico";
import { usePreferencia } from "@/lib/preferencias";
import { contem } from "@/lib/grifo";
import { dataSP, formatarData } from "@/lib/datas";
import { tirarDaRevisao } from "@/lib/filaRevisao";
import type { Escrita, FormatoEscrita } from "@/lib/tipos";
import { Abas, CabecalhoPagina, SeletorVisualizacao, type Visualizacao } from "@/components/ui/Cabecalho";
import { Botao, BotaoIcone } from "@/components/ui/Botao";
import { EstadoErro, EstadoVazio, EsqueletoCards, EsqueletoLista } from "@/components/ui/Estados";
import { Pill } from "@/components/ui/Selos";
import { estiloInput } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import { FORMATOS, FORMATO_POR_ID, textoCorrido } from "./formatos";
import { PontosDominio } from "./Dominio";

type Aba = "todas" | "rascunhos" | "guardadas";
const POR_PAGINA = 30;

export function EscritasPagina() {
  const { excluirComDesfazer } = useToast();
  const edital = useEditalBasico();
  const { dados, setDados, carregando, erro, recarregar, atualizar } = useConsulta(() =>
    buscarTodos<Escrita>((de, ate) => supabase().from("escritas").select("*").order("updated_at", { ascending: false }).range(de, ate)),
  );
  useTempoReal(["escritas"], atualizar);
  const [vis, setVis] = usePreferencia<Visualizacao>("escritas:vis", "lista");
  const [aba, setAba] = useState<Aba>("todas");
  const [formato, setFormato] = useState<"" | FormatoEscrita>("");
  const [materia, setMateria] = useState("");
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  const escritas = useMemo(() => dados ?? [], [dados]);
  const visiveis = useMemo(
    () =>
      escritas.filter(
        (e) =>
          (aba === "todas" || (aba === "rascunhos" ? e.rascunho : !e.rascunho)) &&
          (!formato || e.formato === formato) &&
          (!materia || e.materia_id === materia) &&
          (!busca.trim() ||
            contem(e.titulo, busca) ||
            contem(e.topico_id ? edital.nomeTopico.get(e.topico_id) : "", busca) ||
            contem(textoCorrido(e.formato, e.conteudo), busca)),
      ),
    [escritas, aba, formato, materia, busca, edital.nomeTopico],
  );

  const titulo = (e: Escrita) => e.titulo || (e.topico_id && edital.nomeTopico.get(e.topico_id)) || "Escrita sem título";

  function excluir(e: Escrita) {
    const copia = escritas;
    excluirComDesfazer({
      texto: "Escrita excluída",
      esconder: () => setDados(copia.filter((x) => x.id !== e.id)),
      restaurar: () => setDados(copia),
      apagar: async () => {
        await tirarDaRevisao("escrita", e.id);
        const { error } = await supabase().from("escritas").delete().eq("id", e.id);
        if (error) throw error;
      },
    });
  }

  const status = (e: Escrita) => (e.rascunho ? <Pill>Rascunho</Pill> : <Pill tipo="concluido">Guardada</Pill>);

  return (
    <div className="flex flex-col">
      <CabecalhoPagina
        titulo="Escrita"
        subtitulo="Escrever com as suas palavras é o que fixa o conteúdo."
        acoes={
          <Link
            href="/escrita/nova"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-rosa px-3.5 text-[13px] font-bold text-white hover:brightness-95 sm:h-9"
          >
            <Plus size={15} /> Nova escrita
          </Link>
        }
      />

      {/* Atalhos para começar direto num formato */}
      <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {FORMATOS.map((f) => {
          const Icone = f.icone;
          return (
            <Link
              key={f.id}
              href={`/escrita/nova?formato=${f.id}`}
              className="flex flex-col gap-1.5 rounded-lg border border-borda-card bg-superficie p-3 transition-colors hover:bg-hover"
            >
              <Icone size={18} />
              <span className="text-[13px] leading-tight font-extrabold">{f.nome}</span>
              <span className="text-[12px] leading-snug text-texto-2">{f.resumo}</span>
            </Link>
          );
        })}
      </div>

      <Abas<Aba>
        abas={[
          { id: "todas", rotulo: "Todas", icone: PenLine, contagem: escritas.length },
          { id: "rascunhos", rotulo: "Rascunhos", contagem: escritas.filter((e) => e.rascunho).length },
          { id: "guardadas", rotulo: "Guardadas", contagem: escritas.filter((e) => !e.rascunho).length },
        ]}
        ativa={aba}
        aoTrocar={(a) => {
          setAba(a);
          setLimite(POR_PAGINA);
        }}
        direita={<SeletorVisualizacao valor={vis} aoTrocar={setVis} />}
      />

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_200px_200px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-2" />
          <input
            id="busca-escritas"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no texto, título ou tópico"
            aria-label="Buscar escritas"
            className={`${estiloInput} pl-9`}
          />
        </div>
        <select id="filtro-formato" aria-label="Formato" className={estiloInput} value={formato} onChange={(e) => setFormato(e.target.value as FormatoEscrita | "")}>
          <option value="">Todos os formatos</option>
          {FORMATOS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
        <select id="filtro-materia-escrita" aria-label="Matéria" className={estiloInput} value={materia} onChange={(e) => setMateria(e.target.value)}>
          <option value="">Todas as matérias</option>
          {edital.materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        {erro ? (
          <EstadoErro texto="Não deu para carregar as escritas." tentarDeNovo={recarregar} />
        ) : carregando && !dados ? (
          vis === "cards" ? <EsqueletoCards quantidade={6} /> : <EsqueletoLista />
        ) : escritas.length === 0 ? (
          <EstadoVazio
            icone={PenLine}
            titulo="Nenhuma escrita ainda"
            texto="Escolha um formato acima e escreva sobre o último tópico que você estudou. O texto salva sozinho."
            acao={
              <Link href="/escrita/nova" className="inline-flex h-10 items-center gap-2 rounded-md bg-rosa px-4 text-[13px] font-bold text-white">
                <Plus size={15} /> Nova escrita
              </Link>
            }
          />
        ) : visiveis.length === 0 ? (
          <EstadoVazio icone={Search} titulo="Nenhuma escrita encontrada" texto="Troque a aba, o filtro ou a busca." />
        ) : (
          <>
            {/* Cards (sempre no celular) */}
            <div className={`grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 ${vis === "lista" ? "md:hidden" : ""}`}>
              {visiveis.slice(0, limite).map((e) => (
                <article key={e.id} className="group relative flex flex-col rounded-lg border border-borda-card bg-superficie">
                  <Link href={`/escrita/${e.id}`} className="flex flex-1 flex-col gap-2 p-4 pr-12">
                    <span className="text-xs font-semibold text-texto-2">
                      {FORMATO_POR_ID[e.formato].nome} · {edital.nomeMateria.get(e.materia_id ?? "") ?? "Sem matéria"}
                    </span>
                    <span className="text-[14.5px] leading-snug font-extrabold">{titulo(e)}</span>
                    <span className="line-clamp-3 font-serif text-[14px] leading-relaxed text-texto-2">
                      {textoCorrido(e.formato, e.conteudo).replace(/^.*:\n/gm, "") || "Ainda em branco."}
                    </span>
                    <span className="mt-auto flex flex-wrap items-center gap-3 pt-2 text-xs text-texto-2">
                      {status(e)}
                      <PontosDominio valor={e.dominio} />
                      <span className="tabular">{e.palavras} palavras</span>
                      <span className="tabular">{formatarData(dataSP(e.updated_at))}</span>
                    </span>
                  </Link>
                  <BotaoIcone rotulo="Excluir escrita" onClick={() => excluir(e)} className="absolute top-2 right-2 hover:text-erro">
                    <Trash2 size={15} />
                  </BotaoIcone>
                </article>
              ))}
            </div>

            {/* Tabela (computador) */}
            {vis === "lista" && (
              <table className="hidden w-full table-fixed border-collapse text-left md:table">
                <thead>
                  <tr className="border-b border-borda text-xs font-semibold text-texto-2">
                    <th className="py-2.5 pr-4 pl-2 font-semibold">Escrita</th>
                    <th className="w-[17%] py-2.5 pr-4 font-semibold">Formato</th>
                    <th className="w-[12%] py-2.5 pr-4 font-semibold">Status</th>
                    <th className="w-[10%] py-2.5 pr-4 font-semibold">Domínio</th>
                    <th className="w-[11%] py-2.5 pr-4 font-semibold">Atualizada</th>
                    <th className="w-[52px] py-2.5 pr-2">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.slice(0, limite).map((e) => (
                    <tr key={e.id} className="group border-b border-borda transition-colors hover:bg-hover">
                      <td className="py-3 pr-4 pl-2">
                        <Link href={`/escrita/${e.id}`} className="text-[13.5px] font-semibold underline decoration-borda underline-offset-4 hover:decoration-texto">
                          {titulo(e)}
                        </Link>
                        <span className="mt-0.5 block truncate text-xs text-texto-2">
                          {edital.nomeMateria.get(e.materia_id ?? "") ?? "Sem matéria"} · <span className="tabular">{e.palavras} palavras</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-[13px] text-texto-2">{FORMATO_POR_ID[e.formato].nome}</td>
                      <td className="py-3 pr-4">{status(e)}</td>
                      <td className="py-3 pr-4">
                        <PontosDominio valor={e.dominio} />
                      </td>
                      <td className="tabular py-3 pr-4 text-[13px] text-texto-2">{formatarData(dataSP(e.updated_at))}</td>
                      <td className="py-2 pr-2">
                        <BotaoIcone rotulo="Excluir escrita" onClick={() => excluir(e)} className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-erro">
                          <Trash2 size={15} />
                        </BotaoIcone>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="mt-5 flex items-center justify-between gap-3 text-[12.5px] text-texto-2">
              <span className="tabular inline-flex items-center gap-1.5">
                <FileClock size={14} /> Mostrando {Math.min(limite, visiveis.length)} de {visiveis.length}
              </span>
              {limite < visiveis.length && <Botao onClick={() => setLimite((l) => l + POR_PAGINA)}>Mostrar mais</Botao>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
