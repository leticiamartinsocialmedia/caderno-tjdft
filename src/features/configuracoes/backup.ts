"use client";

import { supabase } from "@/lib/supabase/client";
import { buscarTodos } from "@/lib/useEditalBasico";
import { hojeSP } from "@/lib/datas";

/** Ordem importa: quem é referenciado vem antes de quem referencia. */
export const TABELAS = [
  "materias",
  "topicos",
  "resumos",
  "materiais",
  "bisus",
  "escritas",
  "escrita_versoes",
  "revisoes",
  "revisao_historico",
  "sessoes",
  "erros",
  "termos",
  "termos_relacionados",
  "configuracoes",
] as const;

export type Tabela = (typeof TABELAS)[number];
export type Backup = { app: "caderno-tjdft"; versao: 1; exportado_em: string; dados: Record<Tabela, Record<string, unknown>[]> };

const CONFLITO: Partial<Record<Tabela, string>> = {
  termos_relacionados: "termo_id,relacionado_id",
  configuracoes: "user_id",
  revisoes: "user_id,item_tipo,item_id",
};

/** Tabelas criadas pelo SQL 0003: se ainda não existem, o backup sai sem elas em vez de falhar. */
const OPCIONAIS: Tabela[] = ["resumos", "materiais"];

export async function exportarTudo(): Promise<Backup> {
  const sb = supabase();
  const listas = await Promise.all(
    TABELAS.map((t) =>
      buscarTodos<Record<string, unknown>>((de, ate) => sb.from(t).select("*").range(de, ate)).catch((e) => {
        if (OPCIONAIS.includes(t)) return [];
        throw e;
      }),
    ),
  );
  return {
    app: "caderno-tjdft",
    versao: 1,
    exportado_em: new Date().toISOString(),
    dados: Object.fromEntries(TABELAS.map((t, i) => [t, listas[i]])) as Backup["dados"],
  };
}

export function lerBackup(texto: string): Backup {
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new Error("Esse arquivo não é um JSON válido.");
  }
  const b = json as Partial<Backup>;
  if (b?.app !== "caderno-tjdft" || !b.dados || typeof b.dados !== "object") {
    throw new Error("Esse arquivo não é um backup do Caderno TJDFT.");
  }
  for (const t of TABELAS) {
    if (b.dados[t] !== undefined && !Array.isArray(b.dados[t])) throw new Error(`O backup está com a parte "${t}" corrompida.`);
  }
  return b as Backup;
}

/** Importa mesclando: o que já existe (mesmo id) é atualizado; o resto é criado. */
export async function importar(backup: Backup, usuarioId: string, progresso: (texto: string) => void) {
  const sb = supabase();
  for (const t of TABELAS) {
    const linhas = (backup.dados[t] ?? []).map((l) => ({ ...l, user_id: usuarioId }));
    if (!linhas.length) continue;
    for (let i = 0; i < linhas.length; i += 500) {
      progresso(`Importando ${t.replace(/_/g, " ")} (${Math.min(i + 500, linhas.length)} de ${linhas.length})`);
      const { error } = await sb.from(t).upsert(linhas.slice(i, i + 500), { onConflict: CONFLITO[t] ?? "id" });
      if (error) throw new Error(`Parou em "${t.replace(/_/g, " ")}": ${error.message}`);
    }
  }
}

export function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function celula(v: unknown) {
  const s = Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV com ponto e vírgula e BOM, para abrir certo no Excel em português. */
export function paraCsv(colunas: { titulo: string; valor: (l: Record<string, unknown>) => unknown }[], linhas: Record<string, unknown>[]) {
  const corpo = [colunas.map((c) => celula(c.titulo)).join(";"), ...linhas.map((l) => colunas.map((c) => celula(c.valor(l))).join(";"))];
  return `﻿${corpo.join("\r\n")}`;
}

export function nomeArquivo(base: string, ext: string) {
  return `caderno-tjdft-${base}-${hojeSP()}.${ext}`;
}
