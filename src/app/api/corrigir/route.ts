import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import { FORMATO_POR_ID, textoCorrido } from "@/features/escrita/formatos";
import type { Escrita } from "@/lib/tipos";

// A correção pode levar perto de um minuto.
export const maxDuration = 120;

const MODELO = "claude-opus-5-5";

const INSTRUCOES = `Você é professor de cursinho para o concurso de servidores do TJDFT (Técnico e Analista Judiciário), banca Cebraspe, questões de Certo ou Errado.
A aluna é iniciante e escreveu um texto para fixar o conteúdo. Corrija com precisão jurídica e linguagem simples, em português do Brasil.

Responda em texto simples, sem Markdown (sem #, sem asteriscos, sem tabelas). Use exatamente estas seções, cada título sozinho numa linha:

O que está certo
O que corrigir
O que faltou
Explicação prática
Explicação técnica
Assertivas estilo Cebraspe

Regras:
- Em "O que corrigir", cite o dispositivo legal de cada correção (lei, artigo, parágrafo, inciso). Se não houver erro, diga isso.
- "Explicação prática" usa um exemplo do dia a dia. "Explicação técnica" usa os termos que a prova usa.
- Em "Assertivas estilo Cebraspe", escreva 3 assertivas numeradas sobre o mesmo assunto, misturando certas e erradas, cada uma seguida de "Gabarito: Certo" ou "Gabarito: Errado" e uma frase de justificativa.
- Não invente artigos. Se não tiver certeza de um número de artigo, diga o assunto sem o número.
- Seja direto: frases curtas, listas com hífen quando ajudar.`;

function ativo() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** O app pergunta se a correção está ligada para mostrar ou esconder o botão. */
export async function GET() {
  return NextResponse.json({ ativo: ativo() });
}

export async function POST(request: NextRequest) {
  if (!ativo()) return NextResponse.json({ erro: "A correção por IA não está ligada." }, { status: 404 });

  const sb = await supabaseServidor();
  const { data: auth } = await sb.auth.getClaims();
  if (!auth?.claims) return NextResponse.json({ erro: "Entre de novo para corrigir." }, { status: 401 });

  const corpo = (await request.json().catch(() => ({}))) as { escritaId?: string };
  if (!corpo.escritaId) return NextResponse.json({ erro: "Escrita não informada." }, { status: 400 });

  // O RLS garante que só a dona da escrita consegue lê-la.
  const { data: escrita } = await sb.from("escritas").select("*").eq("id", corpo.escritaId).maybeSingle();
  if (!escrita) return NextResponse.json({ erro: "Escrita não encontrada." }, { status: 404 });
  const e = escrita as Escrita;

  const [materia, topico] = await Promise.all([
    e.materia_id ? sb.from("materias").select("nome").eq("id", e.materia_id).maybeSingle() : null,
    e.topico_id ? sb.from("topicos").select("nome").eq("id", e.topico_id).maybeSingle() : null,
  ]);

  const texto = textoCorrido(e.formato, e.conteudo);
  if (!texto.trim()) return NextResponse.json({ erro: "Escreva alguma coisa antes de pedir a correção." }, { status: 400 });

  const pedido = [
    `Matéria: ${materia?.data?.nome ?? "não informada"}`,
    `Tópico: ${topico?.data?.nome ?? e.titulo ?? "não informado"}`,
    `Formato da escrita: ${FORMATO_POR_ID[e.formato].nome}`,
    "",
    "Texto da aluna:",
    texto,
    e.lacunas ? `\nLacunas que ela percebeu:\n${e.lacunas}` : "",
  ].join("\n");

  const cliente = new Anthropic();
  let correcao = "";
  try {
    const resposta = await cliente.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: INSTRUCOES,
      messages: [{ role: "user", content: pedido }],
    });
    if (resposta.stop_reason === "refusal") {
      return NextResponse.json({ erro: "A IA não conseguiu corrigir este texto. Tente reescrever o trecho." }, { status: 422 });
    }
    correcao = resposta.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch (erro) {
    if (erro instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ erro: "A chave da Anthropic está inválida. Confira na Vercel." }, { status: 502 });
    }
    if (erro instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ erro: "Muitas correções seguidas. Espere um minuto e tente de novo." }, { status: 429 });
    }
    if (erro instanceof Anthropic.APIError) {
      return NextResponse.json({ erro: "O serviço de IA não respondeu. Tente de novo em instantes." }, { status: 502 });
    }
    throw erro;
  }

  if (!correcao) return NextResponse.json({ erro: "A IA devolveu uma resposta vazia. Tente de novo." }, { status: 502 });

  const corrigidaEm = new Date().toISOString();
  const { error } = await sb.from("escritas").update({ correcao_ia: correcao, corrigida_em: corrigidaEm }).eq("id", e.id);
  if (error) return NextResponse.json({ erro: "A correção ficou pronta, mas não deu para salvar. Tente de novo." }, { status: 500 });

  return NextResponse.json({ correcao, corrigida_em: corrigidaEm });
}
