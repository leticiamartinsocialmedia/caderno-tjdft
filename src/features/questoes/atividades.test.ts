import { describe, expect, it } from "vitest";
import { validarSessao } from "./atividades";

const base = { data: "2026-10-25", minutos: "60", questoes: "20", acertos: "15" };

describe("validação da sessão", () => {
  it("aceita uma sessão normal", () => {
    expect(validarSessao(base)).toEqual({});
  });

  it("não deixa acertos passarem das questões", () => {
    expect(validarSessao({ ...base, acertos: "21" }).acertos).toMatch(/não podem passar/);
  });

  it("recusa número quebrado e negativo", () => {
    expect(validarSessao({ ...base, minutos: "12.5" }).minutos).toBeDefined();
    expect(validarSessao({ ...base, questoes: "-3" }).questoes).toBeDefined();
  });

  it("pede minutos ou questões", () => {
    expect(validarSessao({ ...base, minutos: "", questoes: "", acertos: "" }).geral).toBeDefined();
    expect(validarSessao({ ...base, minutos: "30", questoes: "", acertos: "" })).toEqual({});
  });
});
