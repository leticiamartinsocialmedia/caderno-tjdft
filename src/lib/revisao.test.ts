import { describe, expect, it } from "vitest";
import { avaliar, primeiraRevisao, rotuloIntervalo } from "./revisao";

const HOJE = "2026-10-25";

describe("revisão espaçada", () => {
  it("agenda a primeira revisão para amanhã", () => {
    expect(primeiraRevisao(HOJE)).toEqual({ nivel: 0, proxima_data: "2026-10-26" });
  });

  it("'Lembrei bem' avança 1 → 7 → 30 → 90 dias", () => {
    let nivel = 0;
    const datas: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = avaliar(nivel, "bem", HOJE);
      nivel = r.nivel;
      datas.push(r.proxima_data);
    }
    expect(datas).toEqual(["2026-11-01", "2026-11-24", "2027-01-23", "2027-01-23"]);
    expect(nivel).toBe(3);
  });

  it("'Esqueci' volta para 1 dia", () => {
    expect(avaliar(3, "esqueci", HOJE)).toEqual({ nivel: 0, proxima_data: "2026-10-26", ultima_data: HOJE });
  });

  it("'Lembrei uma parte' repete o intervalo", () => {
    expect(avaliar(2, "parcial", HOJE)).toMatchObject({ nivel: 2, proxima_data: "2026-11-24" });
    expect(avaliar(0, "parcial", HOJE)).toMatchObject({ nivel: 0, proxima_data: "2026-10-26" });
  });

  it("aguenta nível fora da faixa", () => {
    expect(avaliar(9, "bem", HOJE).nivel).toBe(3);
    expect(avaliar(-1, "parcial", HOJE).nivel).toBe(0);
    expect(rotuloIntervalo(0)).toBe("1 dia");
    expect(rotuloIntervalo(3)).toBe("90 dias");
  });
});
