"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Largura real do contêiner, para desenhar o SVG em pixels (texto não estica). */
function useLargura() {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, largura] as const;
}

export type Ponto = { chave: string; rotulo: string; valor: number; dica: ReactNode };

function Dica({ x, y, largura, children }: { x: number; y: number; largura: number; children: ReactNode }) {
  const esquerda = Math.min(Math.max(x, 70), largura - 70);
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-borda bg-superficie px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
      style={{ left: esquerda, top: y - 8 }}
    >
      {children}
    </div>
  );
}

function TabelaOculta({ titulo, pontos, formatar }: { titulo: string; pontos: Ponto[]; formatar: (v: number) => string }) {
  return (
    <table className="sr-only">
      <caption>{titulo}</caption>
      <tbody>
        {pontos.map((p) => (
          <tr key={p.chave}>
            <th scope="row">{p.rotulo}</th>
            <td>{formatar(p.valor)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Colunas de uma série só (ex.: minutos por dia). */
export function GraficoColunas({
  titulo,
  pontos,
  formatar,
  altura = 170,
  destacarUltimo = true,
}: {
  titulo: string;
  pontos: Ponto[];
  formatar: (v: number) => string;
  altura?: number;
  destacarUltimo?: boolean;
}) {
  const [ref, largura] = useLargura();
  const [ativo, setAtivo] = useState<number | null>(null);
  const topo = 18;
  const base = altura - 24;
  const max = Math.max(1, ...pontos.map((p) => p.valor));
  const faixa = largura / Math.max(1, pontos.length);
  const larguraBarra = Math.min(24, faixa * 0.55);

  return (
    <div ref={ref} className="relative w-full" style={{ height: altura }}>
      <TabelaOculta titulo={titulo} pontos={pontos} formatar={formatar} />
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label={titulo} className="block overflow-visible">
          <line x1={0} x2={largura} y1={base + 0.5} y2={base + 0.5} stroke="var(--c-borda)" strokeWidth={1} />
          {pontos.map((p, i) => {
            const h = p.valor > 0 ? Math.max(4, ((base - topo) * p.valor) / max) : 0;
            const cx = faixa * i + faixa / 2;
            const x = cx - larguraBarra / 2;
            const y = base - h;
            const ultimo = i === pontos.length - 1;
            const r = Math.min(4, h / 2, larguraBarra / 2);
            return (
              <g
                key={p.chave}
                tabIndex={0}
                onPointerEnter={() => setAtivo(i)}
                onPointerLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(i)}
                onBlur={() => setAtivo(null)}
                className="outline-none"
                aria-label={`${p.rotulo}: ${formatar(p.valor)}`}
              >
                {/* Área de toque maior que a barra */}
                <rect x={faixa * i} y={topo} width={faixa} height={base - topo} fill="transparent" />
                {h > 0 && (
                  <path
                    d={`M${x},${base} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + larguraBarra - r},${y} Q${x + larguraBarra},${y} ${x + larguraBarra},${y + r} L${x + larguraBarra},${base} Z`}
                    fill="var(--c-rosa)"
                    opacity={ativo === null || ativo === i ? 1 : 0.45}
                  />
                )}
                {destacarUltimo && ultimo && p.valor > 0 && (
                  <text x={cx} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--c-texto)" className="tabular">
                    {formatar(p.valor)}
                  </text>
                )}
                <text
                  x={cx}
                  y={altura - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={ultimo ? 700 : 500}
                  fill={ultimo ? "var(--c-texto)" : "var(--c-texto-2)"}
                >
                  {p.rotulo}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {ativo !== null && pontos[ativo] && (
        <Dica x={faixa * ativo + faixa / 2} y={Math.max(topo, base - ((base - topo) * pontos[ativo].valor) / max)} largura={largura}>
          {pontos[ativo].dica}
        </Dica>
      )}
    </div>
  );
}

/** Linha de 0 a 100% (ex.: % de acerto por semana), com linhas-guia nas faixas. */
export function GraficoLinhaPct({
  titulo,
  pontos,
  guias = [],
  altura = 220,
}: {
  titulo: string;
  pontos: Ponto[];
  guias?: { valor: number; rotulo: string }[];
  altura?: number;
}) {
  const [ref, largura] = useLargura();
  const [ativo, setAtivo] = useState<number | null>(null);
  const esq = 34;
  const dir = 16;
  const topo = 14;
  const base = altura - 26;
  const y = (v: number) => base - ((base - topo) * v) / 100;
  const passo = pontos.length > 1 ? (largura - esq - dir) / (pontos.length - 1) : 0;
  const x = (i: number) => (pontos.length > 1 ? esq + passo * i : (largura + esq - dir) / 2);
  const caminho = pontos.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.valor)}`).join(" ");
  // Mostra no máximo ~7 rótulos no eixo para não colidirem.
  const cada = Math.max(1, Math.ceil(pontos.length / Math.max(2, Math.floor((largura - esq) / 64))));

  return (
    <div ref={ref} className="relative w-full" style={{ height: altura }}>
      <TabelaOculta titulo={titulo} pontos={pontos} formatar={(v) => `${Math.round(v)}%`} />
      {largura > 0 && (
        <svg
          width={largura}
          height={altura}
          role="img"
          aria-label={titulo}
          className="block overflow-visible"
          onPointerMove={(e) => {
            if (!pontos.length) return;
            const bx = e.currentTarget.getBoundingClientRect().left;
            const i = pontos.length > 1 ? Math.round((e.clientX - bx - esq) / passo) : 0;
            setAtivo(Math.min(pontos.length - 1, Math.max(0, i)));
          }}
          onPointerLeave={() => setAtivo(null)}
        >
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={esq} x2={largura - dir} y1={y(v) + 0.5} y2={y(v) + 0.5} stroke="var(--c-borda)" strokeWidth={1} />
              <text x={esq - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--c-texto-2)" className="tabular">
                {v}%
              </text>
            </g>
          ))}
          {guias.map((g) => (
            <g key={g.valor}>
              <line x1={esq} x2={largura - dir} y1={y(g.valor) + 0.5} y2={y(g.valor) + 0.5} stroke="var(--c-texto-2)" strokeOpacity={0.35} strokeWidth={1} />
              <text x={esq + 6} y={y(g.valor) - 4} textAnchor="start" fontSize={10.5} fill="var(--c-texto-2)">
                {g.rotulo}
              </text>
            </g>
          ))}
          {pontos.length > 1 && (
            <>
              <path d={`${caminho} L${x(pontos.length - 1)},${base} L${x(0)},${base} Z`} fill="var(--c-rosa)" opacity={0.1} />
              <path d={caminho} fill="none" stroke="var(--c-rosa)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}
          {ativo !== null && <line x1={x(ativo)} x2={x(ativo)} y1={topo} y2={base} stroke="var(--c-texto-2)" strokeOpacity={0.4} strokeWidth={1} />}
          {pontos.map((p, i) => {
            const ultimo = i === pontos.length - 1;
            return (
              <g key={p.chave}>
                {(ultimo || ativo === i) && (
                  <circle cx={x(i)} cy={y(p.valor)} r={5} fill="var(--c-rosa)" stroke="var(--c-fundo)" strokeWidth={2} />
                )}
                {ultimo && (
                  <text x={x(i)} y={y(p.valor) - 10} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--c-texto)" className="tabular">
                    {Math.round(p.valor)}%
                  </text>
                )}
                {(i % cada === 0 || ultimo) && (
                  <text x={x(i)} y={altura - 6} textAnchor="middle" fontSize={11} fill="var(--c-texto-2)">
                    {p.rotulo}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {ativo !== null && pontos[ativo] && (
        <Dica x={x(ativo)} y={y(pontos[ativo].valor)} largura={largura}>
          {pontos[ativo].dica}
        </Dica>
      )}
    </div>
  );
}
