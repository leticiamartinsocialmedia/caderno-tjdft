import { Fragment, type ReactNode } from "react";

/** Divide o texto em partes normais e grifadas (entre ==). */
export function partesGrifo(texto: string): { texto: string; grifado: boolean }[] {
  const partes: { texto: string; grifado: boolean }[] = [];
  const regex = /==([^=\n](?:[^=\n]|=(?!=))*?)==/g;
  let ultimo = 0;
  for (const m of texto.matchAll(regex)) {
    const inicio = m.index ?? 0;
    if (inicio > ultimo) partes.push({ texto: texto.slice(ultimo, inicio), grifado: false });
    partes.push({ texto: m[1], grifado: true });
    ultimo = inicio + m[0].length;
  }
  if (ultimo < texto.length) partes.push({ texto: texto.slice(ultimo), grifado: false });
  return partes;
}

/** Texto com ==grifo== em marca-texto amarelo. Destaca também o termo buscado. */
export function TextoGrifado({ texto, busca }: { texto: string; busca?: string }): ReactNode {
  return partesGrifo(texto).map((p, i) =>
    p.grifado ? (
      <mark key={i} className="grifo">
        <Destaque texto={p.texto} busca={busca} />
      </mark>
    ) : (
      <Fragment key={i}>
        <Destaque texto={p.texto} busca={busca} />
      </Fragment>
    ),
  );
}

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Busca sem diferenciar acento e maiúscula. */
export function contem(texto: string | null | undefined, busca: string) {
  return semAcento(texto ?? "").includes(semAcento(busca.trim()));
}

function Destaque({ texto, busca }: { texto: string; busca?: string }) {
  const b = busca?.trim();
  if (!b) return <>{texto}</>;
  const alvo = semAcento(b);
  const base = semAcento(texto);
  const pedacos: ReactNode[] = [];
  let i = 0;
  let achou = base.indexOf(alvo);
  while (achou !== -1) {
    pedacos.push(texto.slice(i, achou));
    pedacos.push(
      <span key={achou} className="rounded-sm underline decoration-rosa decoration-2 underline-offset-2">
        {texto.slice(achou, achou + b.length)}
      </span>,
    );
    i = achou + b.length;
    achou = base.indexOf(alvo, i);
  }
  pedacos.push(texto.slice(i));
  return <>{pedacos}</>;
}
