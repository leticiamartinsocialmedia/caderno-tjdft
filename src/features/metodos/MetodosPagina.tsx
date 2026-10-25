"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, CloudOff, Loader2, NotebookPen } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { exigir, useConsulta } from "@/lib/useConsulta";
import { useTempoReal } from "@/lib/tempoReal";
import { haQuanto } from "@/lib/datas";
import type { Configuracoes } from "@/lib/tipos";
import { CabecalhoPagina } from "@/components/ui/Cabecalho";
import { Esqueleto } from "@/components/ui/Estados";
import { useApp } from "@/components/shell/AppContext";
import { METODOS } from "./conteudo";
import { Pomodoro, POMODORO_PADRAO } from "./Pomodoro";

export function MetodosPagina() {
  const { usuario } = useApp();
  const { dados, carregando, atualizar } = useConsulta(async () =>
    exigir(await supabase().from("configuracoes").select("*").eq("user_id", usuario.id).maybeSingle()) as Configuracoes | null,
  );

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo="Métodos" subtitulo="Como estudar, quando usar cada técnica e um atalho para praticar no app." />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {METODOS.map((m) => {
          const Icone = m.icone;
          return (
            <article key={m.id} id={`metodo-${m.id}`} className="flex flex-col rounded-lg border border-borda-card bg-superficie p-4 sm:p-5">
              <h2 className="flex items-center gap-2.5 text-[15px] font-extrabold">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-hover">
                  <Icone size={17} />
                </span>
                {m.nome}
              </h2>
              <p className="mt-3 text-xs font-bold tracking-wide text-texto-2 uppercase">Quando usar</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed">{m.quando}</p>
              <p className="mt-3 text-xs font-bold tracking-wide text-texto-2 uppercase">Como fazer</p>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-[13.5px] leading-relaxed marker:text-texto-2">
                {m.como.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              {m.aviso && (
                <p className="mt-3 flex gap-2 rounded-md bg-alerta-suave px-3 py-2 text-[13px] leading-relaxed font-semibold">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-alerta" />
                  {m.aviso}
                </p>
              )}
              <Link href={m.atalho.href} className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[13px] font-bold text-rosa-texto hover:underline">
                {m.atalho.rotulo} <ArrowRight size={14} />
              </Link>
            </article>
          );
        })}
      </div>

      <Pomodoro key={JSON.stringify(dados?.pomodoro ?? POMODORO_PADRAO)} config={dados?.pomodoro ?? POMODORO_PADRAO} />

      <Anotacoes inicial={dados?.anotacoes_metodos ?? null} carregado={!carregando || dados !== null} usuarioId={usuario.id} aoMudarNoBanco={atualizar} />
    </div>
  );
}

/** "Minhas anotações sobre métodos": salva sozinho e acompanha outros aparelhos. */
function Anotacoes({
  inicial,
  carregado,
  usuarioId,
  aoMudarNoBanco,
}: {
  inicial: string | null;
  carregado: boolean;
  usuarioId: string;
  aoMudarNoBanco: () => void;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const [estado, setEstado] = useState<"parado" | "salvando" | "salvo" | "erro">("parado");
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const [, setTique] = useState(0);
  const sujo = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const valorRef = useRef("");
  const salvarRef = useRef<() => Promise<void>>(async () => {});

  // Primeiro valor vindo do banco, e atualizações de outros aparelhos quando não há edição pendente.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!sujo.current && inicial !== null && inicial !== valorRef.current) {
      valorRef.current = inicial;
      setTexto(inicial);
    } else if (texto === null && carregado) {
      setTexto(inicial ?? "");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [inicial, carregado, texto]);

  useEffect(() => {
    const t = setInterval(() => setTique((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useTempoReal(["configuracoes"], () => {
    if (!sujo.current) aoMudarNoBanco();
  });

  const salvar = useCallback(async () => {
    if (!sujo.current) return;
    const valor = valorRef.current;
    setEstado("salvando");
    const { error } = await supabase().from("configuracoes").upsert({ user_id: usuarioId, anotacoes_metodos: valor }, { onConflict: "user_id" });
    if (error) {
      setEstado("erro");
      timer.current = setTimeout(() => void salvarRef.current(), 5000);
      return;
    }
    if (valorRef.current === valor) sujo.current = false;
    setSalvoEm(new Date());
    setEstado("salvo");
  }, [usuarioId]);

  useEffect(() => {
    salvarRef.current = salvar;
  }, [salvar]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (sujo.current) void salvar();
    },
    [salvar],
  );

  return (
    <section className="rounded-lg border border-borda p-4 sm:p-5" aria-labelledby="titulo-anotacoes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-anotacoes" className="flex items-center gap-2 text-[15px] font-extrabold">
          <NotebookPen size={17} /> Minhas anotações sobre métodos
        </h2>
        <span className="text-[12.5px] text-texto-2" aria-live="polite">
          {estado === "salvando" ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" /> Salvando…
            </span>
          ) : estado === "erro" ? (
            <span className="inline-flex items-center gap-1.5 text-erro">
              <CloudOff size={13} /> Sem conexão, tentando de novo
            </span>
          ) : salvoEm ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-sucesso" /> Salvo {haQuanto(salvoEm)}
            </span>
          ) : (
            "Salva sozinho"
          )}
        </span>
      </div>
      {texto === null ? (
        <Esqueleto className="mt-3 h-40" />
      ) : (
        <>
          <label htmlFor="anotacoes-metodos" className="sr-only">
            Minhas anotações sobre métodos
          </label>
          <textarea
            id="anotacoes-metodos"
            rows={8}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              valorRef.current = e.target.value;
              sujo.current = true;
              clearTimeout(timer.current);
              timer.current = setTimeout(() => void salvar(), 1200);
            }}
            placeholder="O que funciona para você? Ex.: Pomodoro de 40 min rende mais à noite. Revisar no ônibus com áudio."
            className="folha mt-3 w-full resize-y rounded-md border border-borda outline-none focus:border-rosa"
          />
        </>
      )}
    </section>
  );
}
