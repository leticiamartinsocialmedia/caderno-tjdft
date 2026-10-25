"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookA, BookX, FolderOpen, Lightbulb, Loader2, NotebookText, PenLine, PlayCircle, Search, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { exigir } from "@/lib/useConsulta";
import { contem } from "@/lib/grifo";
import { textoCorrido } from "@/features/escrita/formatos";
import type { Bisu, Erro, Escrita, Termo } from "@/lib/tipos";

type Resultado = { id: string; grupo: string; icone: LucideIcon; titulo: string; detalhe: string; href: string; textoBusca: string };

async function carregarIndice(): Promise<Resultado[]> {
  const sb = supabase();
  const [materias, topicos, bisus, escritas, termos, erros, resumos, materiais] = await Promise.all([
    sb.from("materias").select("id, nome"),
    sb.from("topicos").select("id, nome, materia_id"),
    sb.from("bisus").select("id, texto, professor, materia_id").limit(2000),
    sb.from("escritas").select("id, titulo, formato, conteudo, topico_id, materia_id").limit(2000),
    sb.from("termos").select("id, termo, extenso, pratica, tecnica").limit(2000),
    sb.from("erros").select("id, assertiva, regra, materia_id").limit(2000),
    sb.from("resumos").select("id, titulo, texto, topico_id").limit(2000),
    sb.from("materiais").select("id, titulo, tipo, topico_id").limit(2000),
  ]);
  const nomeMateria = new Map((exigir(materias) as { id: string; nome: string }[]).map((m) => [m.id, m.nome]));
  const listaTopicos = exigir(topicos) as { id: string; nome: string; materia_id: string }[];
  const nomeTopico = new Map(listaTopicos.map((t) => [t.id, t.nome]));
  const materiaDoTopico = new Map(listaTopicos.map((t) => [t.id, t.materia_id]));
  const corta = (s: string, n = 110) => (s.length > n ? `${s.slice(0, n)}…` : s);
  const linkTopico = (id: string) => `/edital/${materiaDoTopico.get(id)}/${id}`;
  // Resumos e materiais só existem depois do SQL 0003.
  const listaResumos = (resumos.error ? [] : resumos.data) as { id: string; titulo: string | null; texto: string; topico_id: string }[];
  const listaMateriais = (materiais.error ? [] : materiais.data) as { id: string; titulo: string; topico_id: string }[];

  return [
    ...listaTopicos.map((t) => ({
      id: `t-${t.id}`,
      grupo: "Tópicos do edital",
      icone: FolderOpen,
      titulo: t.nome,
      detalhe: nomeMateria.get(t.materia_id) ?? "",
      href: `/edital/${t.materia_id}/${t.id}`,
      textoBusca: `${t.nome} ${nomeMateria.get(t.materia_id) ?? ""}`,
    })),
    ...listaResumos
      .filter((r) => materiaDoTopico.has(r.topico_id))
      .map((r) => ({
        id: `s-${r.id}`,
        grupo: "Resumos",
        icone: NotebookText,
        titulo: r.titulo || corta(r.texto.replace(/==/g, ""), 70),
        detalhe: nomeTopico.get(r.topico_id) ?? "",
        href: linkTopico(r.topico_id),
        textoBusca: [r.titulo, r.texto].join(" "),
      })),
    ...listaMateriais
      .filter((m) => materiaDoTopico.has(m.topico_id))
      .map((m) => ({
        id: `m-${m.id}`,
        grupo: "Materiais",
        icone: PlayCircle,
        titulo: m.titulo,
        detalhe: nomeTopico.get(m.topico_id) ?? "",
        href: linkTopico(m.topico_id),
        textoBusca: m.titulo,
      })),
    ...(exigir(termos) as Termo[]).map((t) => ({
      id: `n-${t.id}`,
      grupo: "Nomenclatura",
      icone: BookA,
      titulo: t.termo,
      detalhe: t.extenso ?? "",
      href: `/nomenclatura?abrir=${t.id}`,
      textoBusca: [t.termo, t.extenso, t.pratica, t.tecnica].join(" "),
    })),
    ...(exigir(bisus) as Bisu[]).map((b) => ({
      id: `b-${b.id}`,
      grupo: "Bisus",
      icone: Lightbulb,
      titulo: corta(b.texto.replace(/==/g, "")),
      detalhe: [b.professor, nomeMateria.get(b.materia_id)].filter(Boolean).join(" · "),
      href: `/bisus?busca=${encodeURIComponent(b.texto.replace(/==/g, "").slice(0, 40))}`,
      textoBusca: [b.texto, b.professor].join(" "),
    })),
    ...(exigir(escritas) as Escrita[]).map((e) => {
      const texto = textoCorrido(e.formato, e.conteudo ?? {});
      return {
        id: `e-${e.id}`,
        grupo: "Escritas",
        icone: PenLine,
        titulo: e.titulo || (e.topico_id && nomeTopico.get(e.topico_id)) || "Escrita sem título",
        detalhe: corta(texto.replace(/^.*:\n/gm, "").replace(/\s+/g, " "), 90),
        href: `/escrita/${e.id}`,
        textoBusca: [e.titulo, e.topico_id && nomeTopico.get(e.topico_id), texto].join(" "),
      };
    }),
    ...(exigir(erros) as Erro[]).map((e) => ({
      id: `r-${e.id}`,
      grupo: "Caderno de erros",
      icone: BookX,
      titulo: corta(e.assertiva),
      detalhe: nomeMateria.get(e.materia_id ?? "") ?? "",
      href: `/erros?abrir=${e.id}`,
      textoBusca: [e.assertiva, e.regra].join(" "),
    })),
  ];
}

export function BuscaGlobal({ fechar }: { fechar: () => void }) {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [indice, setIndice] = useState<Resultado[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    carregarIndice()
      .then(setIndice)
      .catch(() => setFalhou(true));
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [fechar]);

  const resultados = useMemo(() => {
    if (!indice || termo.trim().length < 2) return [];
    const grupos = new Map<string, Resultado[]>();
    for (const r of indice) {
      if (!contem(r.textoBusca, termo)) continue;
      const lista = grupos.get(r.grupo) ?? [];
      if (lista.length < 5) grupos.set(r.grupo, [...lista, r]);
    }
    return [...grupos.values()].flat();
  }, [indice, termo]);

  function ir(r: Resultado) {
    fechar();
    router.push(r.href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[10vh]" onMouseDown={fechar}>
      <div
        role="dialog"
        aria-label="Busca"
        aria-modal="true"
        className="flex max-h-[75vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-borda bg-superficie shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-borda px-4">
          <Search size={18} className="shrink-0 text-texto-2" />
          <input
            ref={ref}
            id="busca-global"
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setAtivo(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setAtivo((a) => Math.min(a + 1, resultados.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setAtivo((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && resultados[ativo]) {
                ir(resultados[ativo]);
              }
            }}
            placeholder="Buscar bisus, escritas, termos, erros e tópicos"
            aria-label="Buscar em todo o caderno"
            className="h-13 min-w-0 flex-1 bg-transparent text-base outline-none focus-visible:outline-none sm:text-sm"
            autoComplete="off"
          />
          {!indice && !falhou && <Loader2 size={16} className="shrink-0 animate-spin text-texto-2" />}
        </div>
        <div className="overflow-y-auto">
          {falhou ? (
            <p className="px-4 py-6 text-center text-[13px] text-erro">Não deu para buscar agora. Confira a internet.</p>
          ) : termo.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-[13px] text-texto-2">Digite pelo menos 2 letras. Use ↑ ↓ e Enter para abrir.</p>
          ) : indice && resultados.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-texto-2">Nada encontrado para &quot;{termo}&quot;.</p>
          ) : (
            <ul role="listbox" aria-label="Resultados" className="py-1">
              {resultados.map((r, i) => {
                const Icone = r.icone;
                const cabecalho = i === 0 || resultados[i - 1].grupo !== r.grupo;
                return (
                  <li key={r.id} role="presentation">
                    {cabecalho && <p className="px-4 pt-3 pb-1 text-[11px] font-bold tracking-wide text-texto-2 uppercase">{r.grupo}</p>}
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === ativo}
                      onMouseEnter={() => setAtivo(i)}
                      onClick={() => ir(r)}
                      className={`flex w-full items-start gap-3 px-4 py-2 text-left ${i === ativo ? "bg-hover" : ""}`}
                    >
                      <Icone size={16} className="mt-0.5 shrink-0 text-texto-2" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold">{r.titulo}</span>
                        {r.detalhe && <span className="block truncate text-xs text-texto-2">{r.detalhe}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
