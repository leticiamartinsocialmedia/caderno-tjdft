import { describe, expect, it } from "vitest";
import { diasDaGrade, somarMes } from "./Calendario";

describe("calendário", () => {
  it("vira o mês e o ano", () => {
    expect(somarMes("2026-12", 1)).toBe("2027-01");
    expect(somarMes("2027-01", -1)).toBe("2026-12");
  });

  it("monta outubro/2026 de domingo a sábado, como no Gran", () => {
    const dias = diasDaGrade("2026-10");
    expect(dias[0]).toBe("2026-09-27"); // 1º de outubro é quinta
    expect(dias.at(-1)).toBe("2026-10-31"); // 31 é sábado
    expect(dias).toHaveLength(35);
    expect(dias.indexOf("2026-10-04") % 7).toBe(0); // dia 4 é domingo
  });
});
