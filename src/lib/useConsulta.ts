"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Carrega dados com estados de carregando e erro, e permite recarregar.
 * `chave` refaz a consulta quando muda (por exemplo, o id da página).
 */
export function useConsulta<T>(carregar: () => Promise<T>, chave = "") {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const versao = useRef(0);
  const carregarRef = useRef(carregar);
  useEffect(() => {
    carregarRef.current = carregar;
  });

  const recarregar = useCallback(async () => {
    const minha = ++versao.current;
    setCarregando(true);
    setErro(false);
    try {
      const resultado = await carregarRef.current();
      if (minha === versao.current) setDados(resultado);
    } catch (e) {
      console.error(e);
      if (minha === versao.current) setErro(true);
    } finally {
      if (minha === versao.current) setCarregando(false);
    }
  }, []);

  /** Atualiza sem mostrar carregando nem erro (usado pelo tempo real). */
  const atualizar = useCallback(async () => {
    const minha = ++versao.current;
    try {
      const resultado = await carregarRef.current();
      if (minha === versao.current) {
        setDados(resultado);
        setErro(false);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    // Buscar dados ao montar é justamente sincronizar com um sistema externo (o banco).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recarregar();
  }, [recarregar, chave]);

  return { dados, setDados, carregando, erro, recarregar, atualizar };
}

/** Lança o erro do Supabase, se houver, e devolve os dados. */
export function exigir<T>(resposta: { data: T | null; error: unknown }): T {
  if (resposta.error) throw resposta.error;
  return resposta.data as T;
}
