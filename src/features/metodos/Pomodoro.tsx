"use client";

import { useEffect, useRef, useState } from "react";
import { Coffee, Pause, Play, RotateCcw, Settings2, SkipForward, Timer } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { Configuracoes } from "@/lib/tipos";
import { Botao } from "@/components/ui/Botao";
import { Campo, estiloInput } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/components/shell/AppContext";

type Fase = "foco" | "pausa" | "pausa_longa";
type Config = Configuracoes["pomodoro"];
export const POMODORO_PADRAO: Config = { foco: 25, pausa: 5, pausa_longa: 15, ciclos: 4 };

const ROTULO_FASE: Record<Fase, string> = { foco: "Foco", pausa: "Pausa", pausa_longa: "Pausa longa" };

function mmss(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function bip() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.8);
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
}

export function Pomodoro({ config: inicial }: { config: Config }) {
  const { usuario } = useApp();
  const { avisar } = useToast();
  const [config, setConfig] = useState<Config>(inicial);
  const [fase, setFase] = useState<Fase>("foco");
  const [ciclo, setCiclo] = useState(1);
  const [restante, setRestante] = useState(inicial.foco * 60);
  const [rodando, setRodando] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [rascunho, setRascunho] = useState(inicial);
  const fim = useRef<number | null>(null);
  const tituloOriginal = useRef<string>("");

  useEffect(() => {
    tituloOriginal.current = document.title;
    return () => {
      document.title = tituloOriginal.current;
    };
  }, []);

  const duracao = (f: Fase, c = config) => (f === "foco" ? c.foco : f === "pausa" ? c.pausa : c.pausa_longa) * 60;

  function irPara(f: Fase, novoCiclo = ciclo) {
    setFase(f);
    setCiclo(novoCiclo);
    setRestante(duracao(f));
    fim.current = Date.now() + duracao(f) * 1000;
  }

  function avancar() {
    if (fase === "foco") irPara(ciclo % config.ciclos === 0 ? "pausa_longa" : "pausa");
    else irPara("foco", fase === "pausa_longa" ? 1 : ciclo + 1);
  }

  const avancarRef = useRef(avancar);
  useEffect(() => {
    avancarRef.current = avancar;
  });

  useEffect(() => {
    if (!rodando) {
      document.title = tituloOriginal.current || document.title;
      return;
    }
    const t = setInterval(() => {
      const s = Math.max(0, Math.round(((fim.current ?? Date.now()) - Date.now()) / 1000));
      setRestante(s);
      document.title = `${mmss(s)} · Pomodoro`;
      if (s === 0) {
        bip();
        avancarRef.current();
      }
    }, 250);
    return () => clearInterval(t);
  }, [rodando]);

  async function guardarConfig() {
    const limpo: Config = {
      foco: Math.min(120, Math.max(1, Math.round(rascunho.foco) || 25)),
      pausa: Math.min(60, Math.max(1, Math.round(rascunho.pausa) || 5)),
      pausa_longa: Math.min(90, Math.max(1, Math.round(rascunho.pausa_longa) || 15)),
      ciclos: Math.min(12, Math.max(1, Math.round(rascunho.ciclos) || 4)),
    };
    setConfig(limpo);
    setRascunho(limpo);
    setAjustando(false);
    setRodando(false);
    setFase("foco");
    setCiclo(1);
    setRestante(limpo.foco * 60);
    const { error } = await supabase().from("configuracoes").upsert({ user_id: usuario.id, pomodoro: limpo }, { onConflict: "user_id" });
    avisar(error ? { texto: "Não deu para guardar a configuração.", tipo: "erro" } : { texto: "Pomodoro ajustado" });
  }

  const total = duracao(fase);
  const pct = total ? ((total - restante) / total) * 100 : 0;

  return (
    <section id="pomodoro" aria-label="Pomodoro" className="scroll-mt-20 rounded-lg border border-borda p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold">
          <Timer size={17} /> Pomodoro
        </h2>
        <Botao variante="fantasma" icone={<Settings2 size={15} />} onClick={() => setAjustando((a) => !a)} aria-expanded={ajustando}>
          Ajustar
        </Botao>
      </div>

      {ajustando && (
        <form
          className="mt-3 grid grid-cols-2 gap-3 rounded-md bg-hover p-3 sm:grid-cols-[repeat(4,1fr)_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void guardarConfig();
          }}
        >
          {(
            [
              ["foco", "Foco (min)"],
              ["pausa", "Pausa (min)"],
              ["pausa_longa", "Pausa longa (min)"],
              ["ciclos", "Ciclos até a longa"],
            ] as const
          ).map(([k, r]) => (
            <Campo key={k} id={`pomo-${k}`} rotulo={r}>
              <input
                id={`pomo-${k}`}
                type="number"
                inputMode="numeric"
                min={1}
                className={`${estiloInput} tabular`}
                value={rascunho[k]}
                onChange={(e) => setRascunho({ ...rascunho, [k]: Number(e.target.value) })}
              />
            </Campo>
          ))}
          <Botao variante="primario" type="submit" className="col-span-2 sm:col-span-1">
            Guardar
          </Botao>
        </form>
      )}

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
        <div
          className="relative flex h-44 w-44 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(var(--c-rosa) ${pct}%, var(--c-hover) ${pct}% 100%)` }}
          role="timer"
          aria-label={`${ROTULO_FASE[fase]}: ${mmss(restante)}`}
        >
          <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-fundo">
            <span className="text-xs font-bold tracking-wide text-texto-2 uppercase">{ROTULO_FASE[fase]}</span>
            <span className="tabular text-[34px] leading-tight font-extrabold">{mmss(restante)}</span>
            <span className="tabular text-xs text-texto-2">
              Ciclo {((ciclo - 1) % config.ciclos) + 1} de {config.ciclos}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <p className="text-[13px] text-texto-2">
            {config.foco} min de foco, {config.pausa} de pausa e {config.pausa_longa} de pausa longa a cada {config.ciclos} ciclos.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {rodando ? (
              <Botao icone={<Pause size={15} />} onClick={() => setRodando(false)}>
                Pausar
              </Botao>
            ) : (
              <Botao
                variante="primario"
                icone={fase === "foco" ? <Play size={15} /> : <Coffee size={15} />}
                onClick={() => {
                  fim.current = Date.now() + restante * 1000;
                  setRodando(true);
                }}
              >
                {restante === total ? (fase === "foco" ? "Começar foco" : "Começar pausa") : "Continuar"}
              </Botao>
            )}
            <Botao variante="fantasma" icone={<SkipForward size={15} />} onClick={avancar}>
              Pular
            </Botao>
            <Botao
              variante="fantasma"
              icone={<RotateCcw size={15} />}
              onClick={() => {
                setRodando(false);
                setFase("foco");
                setCiclo(1);
                setRestante(config.foco * 60);
              }}
            >
              Zerar
            </Botao>
          </div>
        </div>
      </div>
    </section>
  );
}
