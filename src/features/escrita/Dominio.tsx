"use client";

const ROTULOS = ["", "Quase nada", "Pouco", "Mais ou menos", "Bem", "Muito bem"];

export function SeletorDominio({ valor, aoMudar }: { valor: number | null; aoMudar: (v: number | null) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-[13px] font-semibold">Quanto domino</legend>
      <div className="flex flex-wrap items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => aoMudar(valor === n ? null : n)}
            aria-pressed={valor === n}
            title={ROTULOS[n]}
            className={`tabular h-10 w-10 rounded-md border text-sm font-extrabold transition-colors ${
              valor !== null && n <= valor ? "border-texto bg-texto text-fundo" : "border-borda text-texto-2 hover:bg-hover"
            }`}
          >
            {n}
          </button>
        ))}
        <span className="ml-1 text-[12.5px] text-texto-2">{valor ? ROTULOS[valor] : "Toque de 1 a 5"}</span>
      </div>
    </fieldset>
  );
}

/** Bolinhas de 1 a 5 para listas. */
export function PontosDominio({ valor }: { valor: number | null }) {
  if (!valor) return <span className="text-xs text-texto-2">—</span>;
  return (
    <span className="inline-flex items-center gap-1" title={`Domínio ${valor} de 5`} aria-label={`Domínio ${valor} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= valor ? "bg-texto" : "bg-borda"}`} />
      ))}
    </span>
  );
}
