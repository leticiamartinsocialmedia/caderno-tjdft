import { describe, expect, it } from "vitest";
import { lerCronogramaGran, materiaDaDisciplina, nomeCurto } from "./gran";

const TABELA = `Cronograma de Estudos | TJDFT - Técnico Judiciário
Outubro/2026
Dia de estudo\tAula\tTipo\tConcluído
13 - Terça-feira\tNoções de Direito Constitucional | 1 - Teoria da Constituição - Conceitos\tVideoaula\tSim
13 - Terça-feira\tNoções de Direito Penal | 2 - Conceitos Introdutórios\tVideoaula\tNão
18 - Domingo\tRevisão\tRevisão\tNão
31 - Sábado\tNoções de Direito Processual Penal | 3 - Procedimento do Júri: Pronúncia\tVideoaula\tNão
12 - Quinta-feira\tNoções de Direito Penal | 13 - Aplicação da Lei Penal no Tempo\tVideoaula\tNão
`;

describe("lerCronogramaGran", () => {
  it("lê a tabela copiada com tabulações e vira o mês sem cabeçalho", () => {
    const { aulas, avisos } = lerCronogramaGran(TABELA, "2026-10-26");
    expect(avisos).toEqual([]);
    expect(aulas.map((a) => a.data)).toEqual(["2026-10-13", "2026-10-13", "2026-10-18", "2026-10-31", "2026-11-12"]);
    expect(aulas[0]).toMatchObject({ disciplina: "Noções de Direito Constitucional", aula: "1 - Teoria da Constituição - Conceitos", tipo: "videoaula", concluido: true, ordem: 0 });
    expect(aulas[1]).toMatchObject({ concluido: false, ordem: 1 });
    expect(aulas[2]).toMatchObject({ disciplina: "Revisão", aula: "Revisão", tipo: "revisao" });
  });

  it("lê uma célula por linha (cópia no celular)", () => {
    const texto = "Novembro/2026\n15 - Domingo\nNoções de Direito Civil | 3 - LINDB III\nVideoaula\nNão\n15 - Domingo\nRevisão\nRevisao\nNão";
    const { aulas } = lerCronogramaGran(texto, "2026-10-26");
    expect(aulas).toHaveLength(2);
    expect(aulas[0]).toMatchObject({ data: "2026-11-15", disciplina: "Noções de Direito Civil", aula: "3 - LINDB III" });
    expect(aulas[1].tipo).toBe("revisao");
  });

  it("sem cabeçalho de mês, deduz pelo dia da semana", () => {
    const { aulas } = lerCronogramaGran("13 - Terça-feira\tX | 1 - A\tVideoaula\tNão\n12 - Quinta-feira\tX | 2 - B\tVideoaula\tNão", "2026-10-26");
    expect(aulas.map((a) => a.data)).toEqual(["2026-10-13", "2026-11-12"]);
  });

  it("ignora a mesma aula repetida no mesmo dia (prints que se sobrepõem)", () => {
    const linha = "18 - Domingo\tNoções de Direito Constitucional | 3 - Classificações II\tVideoaula\tNão";
    const { aulas } = lerCronogramaGran(`Outubro/2026\n${linha}\n${linha}`, "2026-10-26");
    expect(aulas).toHaveLength(1);
  });

  it("corrige o \"Nocões\" que o Gran às vezes escreve", () => {
    const { aulas } = lerCronogramaGran("Outubro/2026\n24 - Sábado\tNocões de Direito Processual Civil | 5 - Aplicação\tVideoaula\tNão", "2026-10-26");
    expect(aulas[0].disciplina).toBe("Noções de Direito Processual Civil");
  });

  it("avisa linhas incompletas", () => {
    const { aulas, avisos } = lerCronogramaGran("Outubro/2026\n13 - Terça-feira\tNoções de Direito Penal | 1", "2026-10-26");
    expect(aulas).toHaveLength(0);
    expect(avisos).toHaveLength(1);
  });
});

describe("materiaDaDisciplina", () => {
  const materias = [
    "Língua Portuguesa",
    "Noções de Administração de Recursos Humanos e Gestão Pública",
    "Noções de Direito Penal",
    "Noções de Direito Processual Penal",
    "Noções de Direito Civil",
    "Noções de Direito Processual Civil",
    "Redação (prova discursiva)",
  ].map((nome, i) => ({ id: String(i), nome }));

  it("liga pelo nome, sem confundir Penal com Processual Penal", () => {
    expect(materiaDaDisciplina("Noções de Direito Penal", materias)?.nome).toBe("Noções de Direito Penal");
    expect(materiaDaDisciplina("Noções de Direito Processual Penal", materias)?.nome).toBe("Noções de Direito Processual Penal");
    expect(materiaDaDisciplina("Direito Civil", materias)?.nome).toBe("Noções de Direito Civil");
  });

  it("liga Redação Discursiva e deixa de fora o que não está no edital", () => {
    expect(materiaDaDisciplina("Redação Discursiva", materias)?.nome).toBe("Redação (prova discursiva)");
    expect(materiaDaDisciplina("Inteligência Emocional", materias)).toBeNull();
    expect(materiaDaDisciplina("Revisão", materias)).toBeNull();
  });
});

describe("nomeCurto", () => {
  it("encurta os nomes do Gran", () => {
    expect(nomeCurto("Noções de Direito Processual Civil")).toBe("Processual Civil");
    expect(nomeCurto("Noções de Administração de Recursos Humanos e Gestão Pública")).toBe("RH e Gestão Pública");
    expect(nomeCurto("Redação Discursiva")).toBe("Redação Discursiva");
  });
});
