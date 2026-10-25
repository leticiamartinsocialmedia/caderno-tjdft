import { describe, expect, it } from "vitest";
import { dataSP, diasEntre, formatarData, hojeSP, inicioDaSemana, lerDataBR, somarDias } from "./datas";

describe("datas em São Paulo", () => {
  it("vira o dia no horário de Brasília, não no UTC", () => {
    // 02:30 UTC do dia 10 ainda é 23:30 do dia 9 em São Paulo.
    expect(hojeSP(new Date("2026-03-10T02:30:00Z"))).toBe("2026-03-09");
    expect(dataSP("2026-03-10T03:30:00Z")).toBe("2026-03-10");
  });

  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-01-31", 1)).toBe("2026-02-01");
    expect(somarDias("2026-12-31", 90)).toBe("2027-03-31");
    expect(diasEntre("2026-10-25", "2026-11-24")).toBe(30);
  });

  it("formata e lê dd/mm/aaaa", () => {
    expect(formatarData("2026-07-05")).toBe("05/07/2026");
    expect(lerDataBR("05/07/2026")).toBe("2026-07-05");
    expect(lerDataBR("31/02/2026")).toBeNull();
  });

  it("acha a segunda-feira da semana", () => {
    expect(inicioDaSemana("2026-10-25")).toBe("2026-10-19"); // domingo
    expect(inicioDaSemana("2026-10-19")).toBe("2026-10-19");
  });
});
