// Gera supabase/migrations/0003_edital_2022_e_estudo_por_topico.sql a partir dos dados em supabase/dados.
// Uso: node scripts/gerar-sql-edital.mjs
// Valida: todo termo aponta para tópicos que existem, sem termos repetidos e sem ligações quebradas.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (f) => JSON.parse(readFileSync(path.join(raiz, f), "utf8"));

const edital = ler("supabase/dados/edital_tjdft_2022.json");
const termosNovos = [
  ...ler("supabase/dados/termos_2022_a.json"),
  ...ler("supabase/dados/termos_2022_b.json"),
  ...ler("supabase/dados/termos_2022_c.json"),
];
const ligacoes = ler("supabase/dados/ligacoes_2022.json");

const APELIDOS = {
  LP: "Língua Portuguesa",
  ET: "Ética no Serviço Público",
  RI: "Regimento Interno do TJDFT",
  LOJ: "Lei de Organização Judiciária do DF e dos Territórios",
  PGC: "Provimento Geral da Corregedoria",
  PJE: "Provimento Judicial aplicado ao PJe",
  ADM: "Noções de Administração de Recursos Humanos e Gestão Pública",
  CON: "Noções de Direito Constitucional",
  ADV: "Noções de Direito Administrativo",
  CIV: "Noções de Direito Civil",
  PC: "Noções de Direito Processual Civil",
  PEN: "Noções de Direito Penal",
  PP: "Noções de Direito Processual Penal",
  RED: "Redação (prova discursiva)",
};

const erros = [];
const materiaPorNome = new Map(edital.materias.map((m) => [m.nome, m]));
for (const nome of Object.values(APELIDOS)) if (!materiaPorNome.has(nome)) erros.push(`Apelido aponta para matéria inexistente: ${nome}`);

/** "CON|Princípios" → ["Noções de Direito Constitucional", "Princípios fundamentais"]; "CON|" → só a matéria. */
function resolver(ref, onde) {
  const [apelido, prefixo = ""] = ref.split("|");
  const materia = APELIDOS[apelido];
  if (!materia) {
    erros.push(`${onde}: apelido desconhecido "${apelido}"`);
    return null;
  }
  if (!prefixo) return [materia, null];
  const candidatos = materiaPorNome.get(materia).topicos.filter((t) => t.startsWith(prefixo));
  if (candidatos.length !== 1) {
    erros.push(`${onde}: "${ref}" casa com ${candidatos.length} tópicos (${candidatos.join(" / ")})`);
    return null;
  }
  return [materia, candidatos[0]];
}

function montar(item, onde) {
  const refs = (item.tp ?? []).map((r) => resolver(r, onde)).filter(Boolean);
  return {
    materias: [...new Set(refs.map(([m]) => m))],
    topicos: refs.filter(([, t]) => t).map(([m, t]) => [m, t]),
  };
}

const vistos = new Set(ligacoes.termos_existentes.map((v) => v.t.toLowerCase()));
const termos = termosNovos.map((t) => {
  const chave = t.t.toLowerCase();
  if (vistos.has(chave)) erros.push(`Termo repetido: ${t.t}`);
  vistos.add(chave);
  if (!t.p || !t.c) erros.push(`Termo sem as duas explicações: ${t.t}`);
  return { termo: t.t, extenso: t.e ?? null, pratica: t.p, tecnica: t.c, dispositivo: t.d ?? null, tags: t.g ?? [], ...montar(t, t.t) };
});

const vinculos = ligacoes.termos_existentes.map((v) => ({ termo: v.t, ...montar(v, `vínculo ${v.t}`) }));
const todosNomes = new Set([...vistos]);
for (const [a, b] of ligacoes.pares) {
  for (const n of [a, b]) if (!todosNomes.has(n.toLowerCase())) erros.push(`Par com termo inexistente: ${n}`);
}

if (erros.length) {
  console.error(`Encontrei ${erros.length} problema(s):\n- ${erros.join("\n- ")}`);
  process.exit(1);
}

// Dollar-quoting: garante que o delimitador não aparece no conteúdo.
const json = (v, tag) => {
  const s = JSON.stringify(v);
  if (s.includes(`$${tag}$`)) throw new Error(`Delimitador ${tag} aparece no conteúdo`);
  return `$${tag}$${s}$${tag}$::jsonb`;
};

const editalSql = edital.materias.map(({ nome, grupo, antigos, topicos }) => ({ nome, grupo, antigos, topicos }));
const modelo = readFileSync(path.join(raiz, "scripts/modelo-0003.sql"), "utf8");
const sql = modelo
  .replace("/*EDITAL*/", json(editalSql, "edital"))
  .replace("/*TERMOS*/", json(termos, "termos"))
  .replace("/*VINCULOS*/", json(vinculos, "vinculos"))
  .replace("/*PARES*/", json(ligacoes.pares, "pares"));

const saida = "supabase/migrations/0003_edital_2022_e_estudo_por_topico.sql";
writeFileSync(path.join(raiz, saida), sql);
console.log(
  `OK: ${editalSql.length} matérias, ${editalSql.reduce((s, m) => s + m.topicos.length, 0)} tópicos, ${termos.length} termos novos, ${vinculos.length} termos antigos ligados, ${ligacoes.pares.length} pares "Não confundir". Gerado ${saida}`,
);
