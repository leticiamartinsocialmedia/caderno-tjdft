import { describe, expect, it } from "vitest";
import { corAcerto, evolucaoSemanal, formatarMinutos, minutosDaSemana, motivoMaisComum, pctAcerto, porDia, porMateria, somar } from "./desempenho";

const s = (data: string, materia_id: string | null, minutos: number, questoes: number, acertos: number) => ({
  data,
  materia_id,
  minutos,
  questoes,
  acertos,
});

describe("desempenho", () => {
  it("calcula % de acerto e trata zero questões", () => {
    expect(pctAcerto(15, 20)).toBe(75);
    expect(pctAcerto(0, 0)).toBeNull();
  });

  it("pinta a pill pelas faixas 75 / 60", () => {
    expect(corAcerto(75)).toBe("verde");
    expect(corAcerto(74.6)).toBe("verde"); // arredonda para 75
    expect(corAcerto(74)).toBe("amarelo");
    expect(corAcerto(60)).toBe("amarelo");
    expect(corAcerto(59.4)).toBe("vermelho");
    expect(corAcerto(null)).toBe("neutro");
  });

  it("soma por matéria", () => {
    const m = porMateria([s("2026-10-20", "a", 30, 10, 8), s("2026-10-21", "a", 60, 10, 5), s("2026-10-21", "b", 20, 0, 0)]);
    expect(m.get("a")).toEqual({ minutos: 90, questoes: 20, acertos: 13, pct: 65 });
    expect(m.get("b")?.pct).toBeNull();
  });

  it("monta os 7 dias, inclusive os vazios", () => {
    const dias = porDia([s("2026-10-25", "a", 40, 0, 0), s("2026-10-25", "a", 20, 0, 0), s("2026-10-10", "a", 99, 0, 0)], "2026-10-25");
    expect(dias).toHaveLength(7);
    expect(dias[0].data).toBe("2026-10-19");
    expect(dias[6]).toMatchObject({ data: "2026-10-25", minutos: 60 });
    expect(somar(dias.slice(0, 6)).minutos).toBe(0);
  });

  it("agrupa a evolução por semana (segunda a domingo)", () => {
    const ev = evolucaoSemanal([s("2026-10-19", "a", 0, 10, 5), s("2026-10-25", "a", 0, 10, 9), s("2026-10-26", "a", 0, 4, 4), s("2026-10-27", "a", 30, 0, 0)]);
    expect(ev).toEqual([
      { semana: "2026-10-19", minutos: 0, questoes: 20, acertos: 14, pct: 70 },
      { semana: "2026-10-26", minutos: 0, questoes: 4, acertos: 4, pct: 100 },
    ]);
  });

  it("conta só a semana atual na meta", () => {
    expect(minutosDaSemana([s("2026-10-18", "a", 100, 0, 0), s("2026-10-19", "a", 30, 0, 0), s("2026-10-25", "a", 45, 0, 0)], "2026-10-25")).toBe(75);
  });

  it("formata minutos", () => {
    expect(formatarMinutos(45)).toBe("45 min");
    expect(formatarMinutos(120)).toBe("2 h");
    expect(formatarMinutos(85)).toBe("1 h 25 min");
  });

  it("acha o motivo de erro mais comum", () => {
    expect(motivoMaisComum([{ motivo: "pegadinha" }, { motivo: "confundi" }, { motivo: "pegadinha" }])).toEqual({ motivo: "pegadinha", quantidade: 2 });
    expect(motivoMaisComum([])).toBeNull();
  });
});
