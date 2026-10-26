import type { ReactNode } from "react";

// Nos cadernos, alguns trechos vêm sublinhados (ex.: "a forma verbal sublinhada"). No banco eles
// ficam marcados como __trecho__.

export function TextoProva({ texto }: { texto: string }): ReactNode {
  const partes = texto.split(/__(.+?)__/g);
  return partes.map((p, i) =>
    i % 2 ? (
      <u key={i} className="decoration-2 underline-offset-[3px]">
        {p}
      </u>
    ) : (
      p
    ),
  );
}

/** Para copiar a questão (Caderno de erros): troca o sublinhado por _trecho_. */
export function textoSimples(texto: string) {
  return texto.replace(/__(.+?)__/g, "_$1_");
}
