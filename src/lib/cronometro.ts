"use client";

import { useCallback, useEffect, useState } from "react";

// O cronômetro de estudo fica guardado neste aparelho: continua contando ao trocar de tela
// e até com o app fechado (guarda a hora em que começou).
const CHAVE = "cronometro-estudo";

type Estado = { inicio: number | null; acumulado: number };

function ler(): Estado {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return JSON.parse(bruto) as Estado;
  } catch {}
  return { inicio: null, acumulado: 0 };
}

function gravar(e: Estado) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(e));
    window.dispatchEvent(new Event("cronometro"));
  } catch {}
}

export function decorrido(e: Estado, agora = Date.now()) {
  return e.acumulado + (e.inicio ? agora - e.inicio : 0);
}

export function formatarRelogio(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dois(m)}:${dois(ss)}` : `${dois(m)}:${dois(ss)}`;
}

export function useCronometroEstudo() {
  const [estado, setEstado] = useState<Estado>({ inicio: null, acumulado: 0 });
  const [, setTique] = useState(0);

  useEffect(() => {
    const sincronizar = () => setEstado(ler());
    sincronizar();
    window.addEventListener("cronometro", sincronizar);
    window.addEventListener("storage", sincronizar);
    return () => {
      window.removeEventListener("cronometro", sincronizar);
      window.removeEventListener("storage", sincronizar);
    };
  }, []);

  useEffect(() => {
    if (!estado.inicio) return;
    const t = setInterval(() => setTique((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [estado.inicio]);

  const iniciar = useCallback(() => {
    const e = ler();
    if (!e.inicio) gravar({ ...e, inicio: Date.now() });
  }, []);

  const pausar = useCallback(() => {
    const e = ler();
    if (e.inicio) gravar({ inicio: null, acumulado: decorrido(e) });
  }, []);

  /** Para e zera. Devolve os minutos contados (mínimo 1 se contou algo). */
  const parar = useCallback(() => {
    const ms = decorrido(ler());
    gravar({ inicio: null, acumulado: 0 });
    return ms > 0 ? Math.max(1, Math.round(ms / 60000)) : 0;
  }, []);

  return {
    rodando: Boolean(estado.inicio),
    ms: decorrido(estado),
    iniciar,
    pausar,
    parar,
  };
}
