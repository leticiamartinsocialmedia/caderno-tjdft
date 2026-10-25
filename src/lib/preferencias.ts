"use client";

import { useEffect, useState } from "react";

/** Estado lembrado só neste navegador (visualização, filtros). Funciona mesmo sem localStorage. */
export function usePreferencia<T extends string>(chave: string, padrao: T) {
  const [valor, setValor] = useState<T>(padrao);
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(`pref:${chave}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (salvo) setValor(salvo as T);
    } catch {}
  }, [chave]);
  const mudar = (novo: T) => {
    setValor(novo);
    try {
      localStorage.setItem(`pref:${chave}`, novo);
    } catch {}
  };
  return [valor, mudar] as const;
}
