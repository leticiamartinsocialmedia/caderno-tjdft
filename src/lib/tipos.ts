// Tipos das tabelas do Supabase (ver supabase/migrations).

export type StatusTopico = "nao_visto" | "teoria" | "questoes" | "revisado";

export type Materia = {
  id: string;
  nome: string;
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
