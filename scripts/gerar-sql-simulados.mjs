// Gera o SQL que carrega uma prova no banco de questões dos simulados.
// Uso: node scripts/gerar-sql-simulados.mjs supabase/dados/simulado_tjdft_2022_fgv.json supabase/migrations/0006_simulado_tjdft_2022_fgv.sql
//
// O JSON é transcrito do caderno oficial (ver "fonte" dentro dele). Rodar o SQL de novo atualiza as
// questões (por exemplo, quando sair o gabarito definitivo) sem apagar tentativas já feitas.

import { readFileSync, writeFileSync } from "node:fs";

const [entrada, saida] = process.argv.slice(2);
if (!entrada || !saida) {
  console.error("Uso: node scripts/gerar-sql-simulados.mjs <dados.json> <saida.sql>");
  process.exit(1);
}

const { prova, questoes, textos = [] } = JSON.parse(readFileSync(entrada, "utf8"));

// Conferências: a numeração tem que ser contínua, cada questão com 5 alternativas A–E e gabarito válido.
const erros = [];
questoes.forEach((q, i) => {
  if (q.numero !== i + 1) erros.push(`numeração quebrada em ${q.numero}`);
  if (prova.estilo === "multipla") {
    const letras = (q.alternativas ?? []).map((a) => a.letra).join("");
    if (letras !== "ABCDE") erros.push(`questão ${q.numero}: alternativas ${letras}`);
    if (!/^[A-E]$/.test(q.gabarito)) erros.push(`questão ${q.numero}: gabarito ${q.gabarito}`);
  } else if (!["CERTO", "ERRADO"].includes(q.gabarito)) erros.push(`item ${q.numero}: gabarito ${q.gabarito}`);
  if (!q.enunciado?.trim() || !q.materia || !q.assunto || !q.bloco) erros.push(`questão ${q.numero}: campo vazio`);
});
const chaves = new Set(textos.map((t) => t.chave));
questoes.forEach((q) => q.texto && !chaves.has(q.texto) && erros.push(`questão ${q.numero}: texto ${q.texto} não existe`));
const ultima = prova.estrutura.at(-1)?.ate;
if (ultima !== questoes.length) erros.push(`estrutura termina em ${ultima}, mas há ${questoes.length} questões`);
if (erros.length) {
  console.error(erros.join("\n"));
  process.exit(1);
}

// Texto entre $t$...$t$ dispensa escapar aspas e barras.
const txt = (s) => {
  if (s === null || s === undefined) return "null";
  if (String(s).includes("$t$")) throw new Error("texto com $t$");
  return `$t$${s}$t$`;
};

const idTexto = (chave) => `${prova.id}/texto-${chave}`;
const linhas = questoes.map(
  (q) =>
    `  (${txt(`${prova.id}/${q.numero}`)}, ${txt(prova.id)}, ${q.numero}, ${txt(q.bloco)}, ${txt(q.materia)}, ${txt(q.assunto)}, ${q.texto ? txt(idTexto(q.texto)) : "null"}, ${txt(q.comando ?? null)}, ${txt(q.enunciado)}, ${
      q.alternativas ? `${txt(JSON.stringify(q.alternativas))}::jsonb` : "null"
    }, ${txt(q.gabarito)}, ${q.anulada ? "true" : "false"})`,
);

const sql = `-- Caderno TJDFT · simulado: ${prova.orgao} ${prova.ano} · ${prova.banca} · ${prova.cargo}
-- Gerado por scripts/gerar-sql-simulados.mjs a partir de ${entrada}. Não edite à mão.
-- Fonte: ${prova.fonte}
-- Rode depois do 0005. Pode rodar de novo: atualiza as questões sem apagar suas tentativas.

-- Campos usados pelas provas do Cebraspe (comando do grupo de itens e textos com linhas numeradas).
alter table public.simulado_questoes add column if not exists comando text;
alter table public.simulado_textos add column if not exists linhas_numeradas boolean not null default false;

insert into public.simulado_provas (id, orgao, ano, banca, cargo, estilo, duracao_min, errada_desconta, estrutura, discursiva, fonte, ordem)
values (${txt(prova.id)}, ${txt(prova.orgao)}, ${prova.ano}, ${txt(prova.banca)}, ${txt(prova.cargo)}, ${txt(prova.estilo)}, ${prova.duracao_min}, ${
  prova.errada_desconta ? "true" : "false"
}, ${txt(JSON.stringify(prova.estrutura))}::jsonb, ${txt(prova.discursiva)}, ${txt(prova.fonte)}, ${prova.ordem})
on conflict (id) do update set
  orgao = excluded.orgao, ano = excluded.ano, banca = excluded.banca, cargo = excluded.cargo, estilo = excluded.estilo,
  duracao_min = excluded.duracao_min, errada_desconta = excluded.errada_desconta, estrutura = excluded.estrutura,
  discursiva = excluded.discursiva, fonte = excluded.fonte, ordem = excluded.ordem;

${
  textos.length
    ? `insert into public.simulado_textos (id, prova_id, titulo, conteudo, linhas_numeradas)
values
${textos.map((t) => `  (${txt(idTexto(t.chave))}, ${txt(prova.id)}, ${txt(t.titulo)}, ${txt(t.conteudo)}, ${t.linhas_numeradas ? "true" : "false"})`).join(",\n")}
on conflict (id) do update set titulo = excluded.titulo, conteudo = excluded.conteudo, linhas_numeradas = excluded.linhas_numeradas;

`
    : ""
}insert into public.simulado_questoes (id, prova_id, numero, bloco, materia, assunto, texto_id, comando, enunciado, alternativas, gabarito, anulada)
values
${linhas.join(",\n")}
on conflict (id) do update set
  numero = excluded.numero, bloco = excluded.bloco, materia = excluded.materia, assunto = excluded.assunto,
  texto_id = excluded.texto_id, comando = excluded.comando, enunciado = excluded.enunciado, alternativas = excluded.alternativas,
  gabarito = excluded.gabarito, anulada = excluded.anulada;
`;

writeFileSync(saida, sql);
console.log(`OK: ${prova.id}, ${questoes.length} questões, ${textos.length} textos → ${saida}`);
