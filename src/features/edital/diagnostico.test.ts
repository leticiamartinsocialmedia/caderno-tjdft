import { describe, expect, it } from "vitest";
import { diagnosticar, type DadosDiagnostico } from "./diagnostico";

const base: DadosDiagnostico = {
  status: "teoria",
  sessoes: [],
  erros: [],
  escritas: [{ dominio: 4, rascunho: false }],
  termosAprendendo: 0,
  revisoesHoje: 0,
  materiais: 1,
};

describe("o que revisar no tópico", () => {
  it("aponta os erros pendentes com o motivo mais comum", () => {
    const r = diagnosticar({
      ...base,
      erros: [
        { motivo: "pegadinha", revisado: false },
        { motivo: "pegadinha", revisado: false },
        { motivo: "confundi", revisado: true },
      ],
    });
    expect(r[0]).toMatchObject({ id: "erros", nivel: "alerta", titulo: "2 erros para revisar" });
    expect(r[0].texto).toMatch(/pegadinha/);
  });

  it("acerto abaixo de 60% manda voltar à teoria", () => {
    const r = diagnosticar({ ...base, sessoes: [{ minutos: 30, questoes: 20, acertos: 10 }] });
    expect(r.find((x) => x.id === "acerto")).toMatchObject({ nivel: "alerta", acao: "escrita-feynman" });
  });

  it("acerto entre 60% e 74% é atenção; a partir de 75% não aparece", () => {
    expect(diagnosticar({ ...base, sessoes: [{ minutos: 0, questoes: 20, acertos: 13 }] }).find((x) => x.id === "acerto")?.nivel).toBe("atencao");
    expect(diagnosticar({ ...base, sessoes: [{ minutos: 0, questoes: 20, acertos: 15 }] }).some((x) => x.id === "acerto")).toBe(false);
  });

  it("poucas questões ainda não contam como acerto", () => {
    const r = diagnosticar({ ...base, sessoes: [{ minutos: 0, questoes: 4, acertos: 0 }] });
    expect(r.some((x) => x.id === "acerto")).toBe(false);
    expect(r.find((x) => x.id === "questoes")?.titulo).toBe("Só 4 questões registradas");
  });

  it("tópico não visto pede para começar pelo material", () => {
    const r = diagnosticar({ ...base, status: "nao_visto", escritas: [], materiais: 0 });
    expect(r.map((x) => x.id)).toEqual(["nao-visto"]);
    expect(r[0].rotuloAcao).toBe("Adicionar material");
  });

  it("revisões do dia vêm primeiro e tudo em dia aparece quando não há nada", () => {
    const r = diagnosticar({ ...base, revisoesHoje: 2, termosAprendendo: 3, sessoes: [{ minutos: 0, questoes: 10, acertos: 9 }] });
    expect(r.map((x) => x.id)).toEqual(["revisoes", "termos"]);
    expect(diagnosticar({ ...base, sessoes: [{ minutos: 0, questoes: 10, acertos: 9 }] })[0].nivel).toBe("ok");
  });
});
