// Tipos das tabelas do Supabase (ver supabase/migrations).

export type StatusTopico = "nao_visto" | "teoria" | "questoes" | "revisado";

export type Materia = {
  id: string;
  nome: string;
  /** Bloco da prova no edital (ex.: "Específicos"); null em matérias criadas à mão. */
  grupo?: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type Topico = {
  id: string;
  materia_id: string;
  nome: string;
  status: StatusTopico;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type FonteBisu = "videoaula_gran" | "pdf_gran" | "comentario_tec" | "revisao_live" | "outro";

export type Bisu = {
  id: string;
  materia_id: string;
  topico_id: string | null;
  texto: string;
  professor: string | null;
  fonte: FonteBisu;
  link: string | null;
  cai_muito: boolean;
  created_at: string;
  updated_at: string;
};

export type Configuracoes = {
  user_id: string;
  nome: string | null;
  data_prova: string | null;
  meta_semanal_horas: number;
  anotacoes_metodos: string | null;
  ultimo_professor: string | null;
  pomodoro: { foco: number; pausa: number; pausa_longa: number; ciclos: number };
};

export type FormatoEscrita = "pratica_tecnica" | "feynman" | "folha_branca" | "lei_seca" | "banca";

export type Assertiva = { texto: string; gabarito: "" | "C" | "E"; comentario: string };

/** Conteúdo de todos os formatos fica guardado junto: trocar de formato não perde o que foi escrito. */
export type ConteudoEscrita = {
  simples?: string;
  prova?: string;
  leigo?: string;
  travei?: string;
  corrigi?: string;
  final?: string;
  texto?: string;
  conferi?: string;
  dispositivo?: string;
  parafrase?: string;
  troca?: string;
  assertivas?: Assertiva[];
};

export type Escrita = {
  id: string;
  materia_id: string | null;
  topico_id: string | null;
  formato: FormatoEscrita;
  titulo: string | null;
  conteudo: ConteudoEscrita;
  lacunas: string | null;
  dominio: number | null;
  palavras: number;
  rascunho: boolean;
  correcao_ia: string | null;
  corrigida_em: string | null;
  created_at: string;
  updated_at: string;
};

export type EscritaVersao = {
  id: string;
  escrita_id: string;
  formato: FormatoEscrita | null;
  conteudo: ConteudoEscrita;
  lacunas: string | null;
  dominio: number | null;
  palavras: number;
  created_at: string;
};

export type TipoItemRevisao = "escrita" | "erro" | "termo";
export type Avaliacao = "esqueci" | "parcial" | "bem";

export type Revisao = {
  id: string;
  item_tipo: TipoItemRevisao;
  item_id: string;
  nivel: number;
  proxima_data: string;
  ultima_data: string | null;
  ativa: boolean;
  created_at: string;
  updated_at: string;
};

export type RevisaoHistorico = {
  id: string;
  revisao_id: string;
  reescrita: string | null;
  avaliacao: Avaliacao;
  nivel_antes: number;
  nivel_depois: number;
  created_at: string;
};

export type Atividade = "questoes_tec" | "videoaula_gran" | "pdf_gran" | "lei_seca" | "revisao" | "escrita" | "simulado";

export type Sessao = {
  id: string;
  data: string;
  materia_id: string | null;
  topico_id: string | null;
  atividade: Atividade;
  minutos: number;
  questoes: number;
  acertos: number;
  observacao: string | null;
  created_at: string;
  updated_at: string;
};

export type MotivoErro = "nao_sabia" | "confundi" | "interpretacao" | "pegadinha" | "chutei";

export type Erro = {
  id: string;
  materia_id: string | null;
  topico_id: string | null;
  assertiva: string;
  gabarito: "certo" | "errado" | "multipla";
  motivo: MotivoErro;
  regra: string | null;
  link_tec: string | null;
  revisado: boolean;
  created_at: string;
  updated_at: string;
};

export type Termo = {
  id: string;
  termo: string;
  extenso: string | null;
  pratica: string | null;
  tecnica: string | null;
  materia_ids: string[];
  topico_ids: string[];
  dispositivo: string | null;
  tags: string[];
  status: "aprendendo" | "ja_sei";
  created_at: string;
  updated_at: string;
};

export type TermoRelacionado = { termo_id: string; relacionado_id: string };

export type Resumo = {
  id: string;
  topico_id: string;
  titulo: string | null;
  texto: string;
  created_at: string;
  updated_at: string;
};

export type TipoMaterial = "aula" | "pdf" | "questoes" | "link" | "arquivo";

export type Material = {
  id: string;
  topico_id: string;
  tipo: TipoMaterial;
  titulo: string;
  url: string | null;
  arquivo_path: string | null;
  arquivo_tamanho: number | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type TipoAula = "videoaula" | "pdf" | "questoes" | "revisao" | "outro";

export type ItemCronograma = {
  id: string;
  data: string;
  ordem: number;
  disciplina: string;
  aula: string;
  tipo: TipoAula;
  materia_id: string | null;
  topico_id: string | null;
  link: string | null;
  concluido: boolean;
  concluido_em: string | null;
  origem: "gran" | "manual";
  created_at: string;
  updated_at: string;
};
