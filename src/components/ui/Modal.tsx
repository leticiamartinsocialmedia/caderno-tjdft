"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { Botao } from "./Botao";

export function Modal({
  titulo,
  fechar,
  children,
  rodape,
  largura = "max-w-lg",
}: {
  titulo: string;
  fechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const primeiro = ref.current?.querySelector<HTMLElement>("input, textarea, select, button:not([data-fechar])");
    primeiro?.focus();
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = "";
      anterior?.focus();
    };
  }, [fechar]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={fechar}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full ${largura} flex-col rounded-t-xl border border-borda bg-superficie shadow-xl sm:rounded-xl`}
      >
        <div className="flex items-center justify-between border-b border-borda px-5 py-4">
          <h2 className="text-base font-extrabold">{titulo}</h2>
          <button
            type="button"
            data-fechar
            onClick={fechar}
            className="rounded-md p-1 text-texto-2 hover:bg-hover hover:text-texto"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {rodape && (
          <div className="flex justify-end gap-2 border-t border-borda px-5 py-3.5 pb-[max(14px,env(safe-area-inset-bottom))]">{rodape}</div>
        )}
      </div>
    </div>
  );
}

/** Modal com um formulário: Enter envia, rodapé com Cancelar e o botão de ação. */
export function ModalFormulario({
  titulo,
  fechar,
  aoEnviar,
  rotuloAcao,
  enviando,
  children,
  largura,
}: {
  titulo: string;
  fechar: () => void;
  aoEnviar: () => void;
  rotuloAcao: string;
  enviando?: boolean;
  children: ReactNode;
  largura?: string;
}) {
  const idForm = `form-${titulo.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <Modal
      titulo={titulo}
      fechar={fechar}
      largura={largura}
      rodape={
        <>
          <Botao onClick={fechar}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form={idForm} disabled={enviando}>
            {rotuloAcao}
          </Botao>
        </>
      }
    >
      <form
        id={idForm}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          aoEnviar();
        }}
      >
        {children}
      </form>
    </Modal>
  );
}
