"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { Botao } from "@/components/ui/Botao";

const TOTAL = 10 * 60;

function mmss(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Cronômetro regressivo de 10 minutos da Folha em branco. */
export function Cronometro10({ aoTerminar }: { aoTerminar: () => void }) {
  const [restante, setRestante] = useState(TOTAL);
  const [rodando, setRodando] = useState(false);
  const fim = useRef<number | null>(null);
  const terminarRef = useRef(aoTerminar);
  useEffect(() => {
    terminarRef.current = aoTerminar;
  });

  useEffect(() => {
    if (!rodando) return;
    const tick = setInterval(() => {
      const s = Math.max(0, Math.round(((fim.current ?? Date.now()) - Date.now()) / 1000));
      setRestante(s);
      if (s === 0) {
        setRodando(false);
        terminarRef.current();
      }
    }, 250);
    return () => clearInterval(tick);
  }, [rodando]);

  function iniciar() {
    fim.current = Date.now() + restante * 1000;
    setRodando(true);
  }

  const acabou = restante === 0;
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${acabou ? "border-rosa bg-rosa-suave" : "border-borda"}`}>
      <Timer size={20} className={acabou ? "text-rosa-texto" : "text-texto-2"} />
      <span className="tabular text-[28px] leading-none font-extrabold" aria-live="off">
        {mmss(restante)}
      </span>
      <span className="text-[13px] text-texto-2">
        {acabou ? "Tempo esgotado. Agora confira no material." : rodando ? "Escreva sem consultar nada." : "Sem consultar o material."}
      </span>
      <div className="ml-auto flex gap-2">
        {!acabou &&
          (rodando ? (
            <Botao icone={<Pause size={15} />} onClick={() => setRodando(false)}>
              Pausar
            </Botao>
          ) : (
            <Botao variante="primario" icone={<Play size={15} />} onClick={iniciar}>
              {restante === TOTAL ? "Começar 10 min" : "Continuar"}
            </Botao>
          ))}
        {restante !== TOTAL && (
          <Botao
            variante="fantasma"
            icone={<RotateCcw size={15} />}
            onClick={() => {
              setRodando(false);
              setRestante(TOTAL);
            }}
          >
            Recomeçar
          </Botao>
        )}
      </div>
    </div>
  );
}
