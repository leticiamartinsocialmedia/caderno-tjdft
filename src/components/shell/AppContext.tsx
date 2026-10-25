"use client";

import { createContext, useContext } from "react";

export type Usuario = { id: string; email: string; nome: string };

export type CtxApp = {
  usuario: Usuario;
  revisoesHoje: number;
  atualizarContadores: () => void;
  abrirBusca: () => void;
};

export const AppCtx = createContext<CtxApp | null>(null);

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp fora do AppShell");
  return ctx;
}
