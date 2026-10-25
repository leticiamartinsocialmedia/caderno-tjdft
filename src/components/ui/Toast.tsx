"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, X, AlertCircle } from "lucide-react";

type Toast = {
  id: number;
  texto: string;
  tipo: "ok" | "erro" | "info";
  acao?: { rotulo: string; fn: () => void };
  duracao: number;
};

type NovoToast = Omit<Toast, "id" | "tipo" | "duracao"> & Partial<Pick<Toast, "tipo" | "duracao">>;

type CtxToast = {
  avisar: (t: NovoToast) => void;
  /** Some da tela na hora; só apaga de verdade depois de 6 s, se ninguém clicar em "Desfazer". */
  excluirComDesfazer: (opcoes: { esconder: () => void; restaurar: () => void; apagar: () => Promise<unknown>; texto?: string }) => void;
};

const Ctx = createContext<CtxToast | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast fora do ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const proximoId = useRef(1);
  // Exclusões pendentes: se a página fechar antes dos 6 s, o item simplesmente não é apagado.
  const pendentes = useRef(new Map<number, () => Promise<unknown>>());

  const fechar = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const avisar = useCallback((t: NovoToast) => {
    const id = proximoId.current++;
    setToasts((ts) => [...ts.slice(-2), { tipo: "ok", duracao: 3500, ...t, id }]);
    return id;
  }, []);

  const excluirComDesfazer: CtxToast["excluirComDesfazer"] = useCallback(
    ({ esconder, restaurar, apagar, texto = "Excluído" }) => {
      esconder();
      let desfeito = false;
      const id = proximoId.current;
      const executar = async () => {
        pendentes.current.delete(id);
        if (desfeito) return;
        try {
          await apagar();
        } catch {
          restaurar();
          avisar({ texto: "Não deu para excluir. Tente de novo.", tipo: "erro" });
        }
      };
      pendentes.current.set(id, executar);
      avisar({
        texto,
        duracao: 6000,
        acao: {
          rotulo: "Desfazer",
          fn: () => {
            desfeito = true;
            pendentes.current.delete(id);
            restaurar();
          },
        },
      });
      setTimeout(executar, 6000);
    },
    [avisar],
  );

  return (
    <Ctx.Provider value={{ avisar, excluirComDesfazer }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[calc(80px+env(safe-area-inset-bottom))] lg:pb-[max(16px,env(safe-area-inset-bottom))]"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ItemToast key={t.id} toast={t} fechar={() => fechar(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ItemToast({ toast, fechar }: { toast: Toast; fechar: () => void }) {
  useEffect(() => {
    const timer = setTimeout(fechar, toast.duracao);
    return () => clearTimeout(timer);
  }, [toast.duracao, fechar]);

  const Icone = toast.tipo === "erro" ? AlertCircle : CheckCircle2;
  return (
    <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-lg bg-[#111114] py-2.5 pr-2 pl-3.5 text-[13px] font-semibold text-white shadow-lg dark:bg-[#2a2a2e]">
      <Icone size={16} className={toast.tipo === "erro" ? "text-[#ff6b6b]" : "text-[#4ade80]"} />
      <span className="min-w-0">{toast.texto}</span>
      {toast.acao && (
        <>
          <span className="text-white/40">·</span>
          <button
            type="button"
            onClick={() => {
              toast.acao?.fn();
              fechar();
            }}
            className="rounded px-1.5 py-0.5 font-bold text-[#ff7a9c] hover:bg-white/10"
          >
            {toast.acao.rotulo}
          </button>
        </>
      )}
      <button type="button" onClick={fechar} className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Fechar aviso">
        <X size={14} />
      </button>
    </div>
  );
}
