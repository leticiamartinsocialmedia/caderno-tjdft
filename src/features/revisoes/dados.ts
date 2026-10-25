"use client";

import { BookA, BookX, PenLine, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { exigir } from "@/lib/useConsulta";
import { buscarTodos } from "@/lib/useEditalBasico";
import { textoCorrido, FORMATO_POR_ID } from "@/features/escrita/formatos";
import type { Erro, Escrita, Revisao, Termo, TipoItemRevisao } from "@/lib/tipos";

export const TIPO_ITEM: Record<TipoItemRevisao, { rotulo: string; icone: LucideIcon }> = {
  escrita: { rotulo: "Escrita", icone: PenLine },
  erro: { rotulo: "Erro", icone: BookX },
  termo: { rotulo: "Termo", icone: BookA },
};

export const ROTULO_GABARITO = { certo: "Certo", errado: "Errado", multipla: "Múltipla escolha" } as const;

/** O que a revisão mostra: a pergunta, o original para comparar e a matéria. */
export type ItemRevisao = {
  revisao: Revisao;
  titulo: string;
  pergunta: string;
  original: { rotulo: string; texto: string }[];
  materiaId: string | null;
  link: string;
};

export function montarItem(
  revisao: Revisao,
  escrita: Escrita | undefined,
  erro: Erro | undefined,
  termo: Termo | undefined,
  nomeTopico: Map<string, string>,
): ItemRevisao | null {
  if (revisao.item_tipo === "escrita" && escrita) {
    const topico = escrita.topico_id ? nomeTopico.get(escrita.topico_id) : undefined;
    const titulo = escrita.titulo || topico || "Escrita sem título";
    return {
      revisao,
      titulo,
      pergunta: `Escreva de memória o que você sabe sobre "${titulo}" (${FORMATO_POR_ID[escrita.formato].nome}).`,
      original: [
        { rotulo: "Sua escrita", texto: textoCorrido(escrita.formato, escrita.conteudo) },
        ...(escrita.lacunas ? [{ rotulo: "Lacunas que você anotou", texto: escrita.lacunas }] : []),
      ],
      materiaId: escrita.materia_id,
      link: `/escrita/${escrita.id}`,
    };
  }
  if (revisao.item_tipo === "erro" && erro) {
    return {
      revisao,
      titulo: erro.assertiva.length > 90 ? `${erro.assertiva.slice(0, 90)}…` : erro.assertiva,
      pergunta: `Assertiva: "${erro.assertiva}"\nQual é o gabarito e qual é a regra?`,
      original: [
        { rotulo: "Gabarito", texto: ROTULO_GABARITO[erro.gabarito] },
        { rotulo: "A regra certa", texto: erro.regra || "Você não escreveu a regra. Edite o erro para completar." },
      ],
      materiaId: erro.materia_id,
      link: `/erros?abrir=${erro.id}`,
    };
  }
  if (revisao.item_tipo === "termo" && termo) {
    return {
      revisao,
      titulo: termo.termo,
      pergunta: `O que é "${termo.termo}"? Escreva por extenso, o jeito simples e como a prova cobra.`,
      original: [
        { rotulo: "Por extenso", texto: termo.extenso ?? "" },
        { rotulo: "Explicação prática", texto: termo.pratica ?? "" },
        { rotulo: "Explicação técnica", texto: termo.tecnica ?? "" },
        ...(termo.dispositivo ? [{ rotulo: "Dispositivo", texto: termo.dispositivo }] : []),
      ].filter((x) => x.texto),
      materiaId: termo.materia_ids[0] ?? null,
      link: `/nomenclatura?abrir=${termo.id}`,
    };
  }
  return null;
}

/** Busca por lista de ids em lotes (endereços muito longos falham). */
export async function buscarPorIds<T>(tabela: string, ids: string[]): Promise<T[]> {
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) lotes.push(ids.slice(i, i + 100));
  const respostas = await Promise.all(lotes.map((lote) => supabase().from(tabela).select("*").in("id", lote)));
  return respostas.flatMap((r) => exigir(r) as T[]);
}

/** Carrega revisões ativas até `ate` (aaaa-mm-dd) e os itens ligados a elas. */
export async function carregarFila(ate: string, nomeTopico: Map<string, string>) {
  const sb = supabase();
  const revisoes = await buscarTodos<Revisao>((de, fim) =>
    sb.from("revisoes").select("*").eq("ativa", true).lte("proxima_data", ate).order("proxima_data").range(de, fim),
  );
  const ids = (tipo: TipoItemRevisao) => revisoes.filter((r) => r.item_tipo === tipo).map((r) => r.item_id);
  const [escritas, erros, termos] = await Promise.all([
    buscarPorIds<Escrita>("escritas", ids("escrita")),
    buscarPorIds<Erro>("erros", ids("erro")),
    buscarPorIds<Termo>("termos", ids("termo")),
  ]);
  const mapa = <T extends { id: string }>(lista: T[]) => new Map(lista.map((x) => [x.id, x]));
  const mE = mapa(escritas);
  const mR = mapa(erros);
  const mT = mapa(termos);
  return revisoes
    .map((r) => montarItem(r, mE.get(r.item_id), mR.get(r.item_id), mT.get(r.item_id), nomeTopico))
    .filter((x): x is ItemRevisao => x !== null);
}
