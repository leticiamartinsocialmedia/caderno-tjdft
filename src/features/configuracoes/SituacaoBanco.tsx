"use client";

import { CheckCircle2, CircleAlert, Database, ExternalLink, Radio } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useConsulta } from "@/lib/useConsulta";
import { useStatusTempoReal, useTempoReal } from "@/lib/tempoReal";

const REPO = "https://github.com/leticiamartinsocialmedia/caderno-tjdft/blob/main/supabase/migrations";

/** Cada SQL deixa uma marca no banco; se a consulta da marca falha, aquele SQL ainda não foi rodado. */
const ETAPAS = [
  { arquivo: "0001_schema.sql", oQue: "Tabelas, segurança e o edital inicial", marca: () => supabase().from("materias").select("id").limit(1) },
  { arquivo: "0002_tempo_real_e_nomenclatura.sql", oQue: "Tempo real e os termos iniciais", marca: () => supabase().from("escrita_versoes").select("formato").limit(1) },
  { arquivo: "0003_edital_2022_e_estudo_por_topico.sql", oQue: "Edital 2022, resumos, materiais e anexos", marca: () => supabase().from("resumos").select("id").limit(1) },
  { arquivo: "0004_cronograma.sql", oQue: "Cronograma", marca: () => supabase().from("cronograma").select("id").limit(1) },
  { arquivo: "0005_simulados.sql", oQue: "Simulados", marca: () => supabase().from("simulado_provas").select("id").limit(1) },
  {
    arquivo: "0006_simulado_tjdft_2022_fgv.sql",
    oQue: "Prova TJDFT 2022 (FGV) nos simulados",
    // Aqui a marca é a prova estar no banco, não só a tabela existir.
    marca: async () => {
      const r = await supabase().from("simulado_provas").select("id").eq("id", "tjdft-2022-fgv-tecnico-adm");
      return { error: r.error ?? (r.data?.length ? null : { message: "sem a prova" }) };
    },
  },
  {
    arquivo: "0007_simulado_tjdft_2013_cebraspe.sql",
    oQue: "Prova TJDFT 2013 (Cebraspe) nos simulados",
    marca: async () => {
      const r = await supabase().from("simulado_provas").select("id").eq("id", "tjdft-2013-cebraspe-tecnico-adm");
      return { error: r.error ?? (r.data?.length ? null : { message: "sem a prova" }) };
    },
  },
  {
    arquivo: "0008_revisao_edital_e_nomenclatura.sql",
    oQue: "Edital revisado e mais termos na Nomenclatura",
    marca: () => supabase().from("configuracoes").select("termos_2022_b").limit(1),
  },
];

async function verificar() {
  const sb = supabase();
  const etapas = await Promise.all(ETAPAS.map(async (e) => ({ ...e, ok: !(await e.marca()).error })));
  const [provas, questoes] = await Promise.all([
    sb.from("simulado_provas").select("id", { count: "exact", head: true }),
    sb.from("simulado_questoes").select("id", { count: "exact", head: true }),
  ]);
  return { etapas, provas: provas.error ? null : (provas.count ?? 0), questoes: questoes.error ? null : (questoes.count ?? 0) };
}

export function SituacaoBanco() {
  const { dados, atualizar } = useConsulta(verificar);
  useTempoReal(["simulado_provas", "simulado_questoes"], atualizar);
  const aoVivo = useStatusTempoReal();
  const faltando = dados?.etapas.filter((e) => !e.ok) ?? [];

  return (
    <section className="rounded-lg border border-borda p-4 sm:p-5" aria-labelledby="titulo-banco">
      <h2 id="titulo-banco" className="flex items-center gap-2 text-[15px] font-extrabold">
        <Database size={17} /> Situação do banco
      </h2>
      <p className="mt-1 text-[13px] text-texto-2">
        {faltando.length
          ? `Falta rodar ${faltando.length === 1 ? "1 SQL" : `${faltando.length} SQLs`} no Supabase (SQL Editor → New query → colar → Run), nesta ordem.`
          : dados
            ? "Todos os SQLs foram rodados."
            : "Conferindo…"}
      </p>
      <ul className="mt-3 flex flex-col">
        {(dados?.etapas ?? ETAPAS.map((e) => ({ ...e, ok: null }))).map((e) => (
          <li key={e.arquivo} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-borda py-2 last:border-b-0">
            {e.ok === null ? (
              <span className="size-[18px] shrink-0 animate-pulse rounded-full bg-hover" />
            ) : e.ok ? (
              <CheckCircle2 size={18} className="shrink-0 text-sucesso" aria-label="Rodado" />
            ) : (
              <CircleAlert size={18} className="shrink-0 text-erro" aria-label="Falta rodar" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[12.5px] font-semibold break-all">{e.arquivo}</span>
              <span className="block text-xs text-texto-2">{e.oQue}</span>
            </span>
            {e.ok === false && (
              <a href={`${REPO}/${e.arquivo}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-bold text-rosa-texto underline underline-offset-4">
                Abrir o SQL <ExternalLink size={13} />
              </a>
            )}
          </li>
        ))}
      </ul>
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-hover px-3 py-2">
          <dt className="text-xs font-semibold text-texto-2">Tempo real</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 text-[13.5px] font-bold">
            <Radio size={15} className={aoVivo === "ao_vivo" ? "text-sucesso" : aoVivo === "offline" ? "text-erro" : "text-alerta"} />
            {aoVivo === "ao_vivo" ? "Ligado" : aoVivo === "offline" ? "Sem conexão" : "Conectando"}
          </dd>
        </div>
        <div className="rounded-md bg-hover px-3 py-2">
          <dt className="text-xs font-semibold text-texto-2">Provas nos simulados</dt>
          <dd className="tabular mt-0.5 text-[13.5px] font-bold">{dados?.provas ?? "–"}</dd>
        </div>
        <div className="rounded-md bg-hover px-3 py-2">
          <dt className="text-xs font-semibold text-texto-2">Questões nos simulados</dt>
          <dd className="tabular mt-0.5 text-[13.5px] font-bold">{dados?.questoes ?? "–"}</dd>
        </div>
      </dl>
    </section>
  );
}
