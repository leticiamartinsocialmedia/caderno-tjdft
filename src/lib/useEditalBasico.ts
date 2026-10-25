"use client";

import { useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { exigir, useConsulta } from "./useConsulta";
import { useTempoReal } from "./tempoReal";

export type MateriaBasica = { id: string; nome: string; ordem: number };
export type TopicoBasico = { id: string; nome: string; materia_id: string; ordem: number };

/** Matérias e tópicos para selects e rótulos (nome por id). */
export function useEditalBasico() {
  const consulta = useConsulta(async () => {
    const sb = supabase();
    const [m, t] = await Promise.all([
      sb.from("materias").select("id, nome, ordem").order("ordem"),
      sb.from("topicos").select("id, nome, materia_id, ordem").order("ordem"),
    ]);
    return { materias: exigir(m) as MateriaBasica[], topicos: exigir(t) as TopicoBasico[] };
  });
  useTempoReal(["materias", "topicos"], consulta.atualizar);
  const materias = useMemo(() => consulta.dados?.materias ?? [], [consulta.dados]);
  const topicos = useMemo(() => consulta.dados?.topicos ?? [], [consulta.dados]);
  const nomeMateria = useMemo(() => new Map(materias.map((m) => [m.id, m.nome])), [materias]);
  const nomeTopico = useMemo(() => new Map(topicos.map((t) => [t.id, t.nome])), [topicos]);
  return { materias, topicos, nomeMateria, nomeTopico, carregando: consulta.carregando, erro: consulta.erro };
}

/** Busca todas as linhas, de 1000 em 1000 (limite do Supabase por consulta). */
export async function buscarTodos<T>(
  montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const tamanho = 1000;
  const tudo: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const pagina = exigir(await montar(de, de + tamanho - 1)) ?? [];
    tudo.push(...pagina);
    if (pagina.length < tamanho) return tudo;
  }
}
