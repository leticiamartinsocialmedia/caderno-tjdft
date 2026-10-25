"use client";

import { supabase } from "@/lib/supabase/client";
import { hojeSP } from "./datas";
import { primeiraRevisao } from "./revisao";
import type { TipoItemRevisao } from "./tipos";

/**
 * Põe o item na fila de revisões (1º intervalo: amanhã).
 * Se já estiver na fila, reativa sem mexer no nível.
 * Devolve a data da próxima revisão.
 */
export async function porNaRevisao(usuarioId: string, tipo: TipoItemRevisao, itemId: string, recomecar = false) {
  const sb = supabase();
  const { data: existente, error: erroBusca } = await sb
    .from("revisoes")
    .select("id, ativa, proxima_data")
    .eq("item_tipo", tipo)
    .eq("item_id", itemId)
    .maybeSingle();
  if (erroBusca) throw erroBusca;

  const inicio = primeiraRevisao(hojeSP());
  if (existente && !recomecar) {
    if (!existente.ativa) {
      const { error } = await sb.from("revisoes").update({ ativa: true, proxima_data: inicio.proxima_data }).eq("id", existente.id);
      if (error) throw error;
      return inicio.proxima_data;
    }
    return existente.proxima_data as string;
  }
  if (existente) {
    const { error } = await sb.from("revisoes").update({ ativa: true, ...inicio }).eq("id", existente.id);
    if (error) throw error;
    return inicio.proxima_data;
  }
  const { error } = await sb.from("revisoes").insert({ user_id: usuarioId, item_tipo: tipo, item_id: itemId, ...inicio });
  if (error) throw error;
  return inicio.proxima_data;
}

/** Tira o item da fila (ao excluir o item). */
export async function tirarDaRevisao(tipo: TipoItemRevisao, itemId: string) {
  await supabase().from("revisoes").delete().eq("item_tipo", tipo).eq("item_id", itemId);
}
