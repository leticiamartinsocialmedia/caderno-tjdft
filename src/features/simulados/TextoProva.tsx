import type { ReactNode } from "react";
import type { SimuladoTexto } from "@/lib/tipos";

// Destaques dos cadernos, guardados no banco como marcação simples:
// __sublinhado__ ("a forma verbal sublinhada"), **negrito** e *itálico*.

const MARCAS = /(\*\*.+?\*\*|__.+?__|\*[^*\n]+?\*)/g;

export function TextoProva({ texto }: { texto: string }): ReactNode {
  return texto.split(MARCAS).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("__") && p.endsWith("__") && p.length > 4)
      return (
        <u key={i} className="decoration-2 underline-offset-[3px]">
          {p.slice(2, -2)}
        </u>
      );
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

/** Para copiar a questão (Caderno de erros): tira negrito e itálico e troca o sublinhado por _trecho_. */
export function textoSimples(texto: string) {
  return texto
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "_$1_")
    .replace(/\*([^*\n]+?)\*/g, "$1");
}

/**
 * Texto de apoio. Nos cadernos do Cebraspe as linhas são numeradas (1, 4, 7...) e os itens citam
 * "linha 30" ou "ℓ.11-14"; aqui as linhas ficam iguais às do caderno, com a mesma numeração.
 * A referência bibliográfica vem depois de uma linha em branco.
 */
export function TextoApoio({ texto }: { texto: SimuladoTexto }) {
  if (!texto.linhas_numeradas) {
    return (
      <div className="font-serif text-[15.5px] leading-relaxed whitespace-pre-line">
        <TextoProva texto={texto.conteudo} />
      </div>
    );
  }
  const [corpo, ...resto] = texto.conteudo.split("\n\n");
  return (
    <div className="font-serif text-[14px] leading-[1.7] sm:text-[15px]">
      <ol className="flex flex-col">
        {corpo.split("\n").map((l, i) => (
          <li key={i} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-baseline">
            <span className="tabular pr-2 text-right font-sans text-[10.5px] text-texto-2 italic select-none" aria-hidden={(i + 1) % 3 !== 1}>
              {(i + 1) % 3 === 1 ? i + 1 : ""}
            </span>
            {/* Linha do caderno que não cabe no celular: a continuação fica recuada (recuo deslocado). */}
            <span className={l.startsWith("\t") ? "block pl-4 indent-6" : "block pl-4 -indent-4"}>
              <span className="sr-only">Linha {i + 1}: </span>
              <TextoProva texto={l.replace(/^\t/, "")} />
            </span>
          </li>
        ))}
      </ol>
      {resto.length > 0 && <p className="mt-3 pl-9 font-sans text-[11.5px] leading-snug text-texto-2">{resto.join(" ")}</p>}
    </div>
  );
}
