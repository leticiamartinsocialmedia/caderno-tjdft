export function LogoIcone({ className = "h-7 w-7" }: { className?: string }) {
  // "A" estilizado: duas pernas e uma barra que lembra um marca-texto.
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#FF2E63" />
      <path d="M9 24 L16 7 L23 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.5 18.5 H21" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ claro = false, compacto = false }: { claro?: boolean; compacto?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoIcone />
      {!compacto && (
        <span className={`text-[15px] font-extrabold tracking-tight ${claro ? "text-white" : "text-texto"}`}>
          Caderno TJDFT
        </span>
      )}
    </span>
  );
}
