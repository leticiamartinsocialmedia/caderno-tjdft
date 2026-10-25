"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

// Etapa 10 liga a busca em bisus, escritas, nomenclatura, erros e tópicos.
export function BuscaGlobal({ fechar }: { fechar: () => void }) {
  const [termo, setTermo] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [fechar]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]" onMouseDown={fechar}>
      <div
        role="dialog"
        aria-label="Busca"
        className="w-full max-w-xl overflow-hidden rounded-lg border border-borda bg-superficie shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-borda px-4">
          <Search size={18} className="text-texto-2" />
          <input
            ref={ref}
            id="busca-global"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar bisus, escritas, termos, erros e tópicos"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <p className="px-4 py-6 text-center text-[13px] text-texto-2">A busca completa chega na etapa 10.</p>
      </div>
    </div>
  );
}
