-- Caderno TJDFT: estrutura completa do banco.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode rodar de novo sem problema: tudo usa "if not exists" ou "or replace".

-- ---------------------------------------------------------------------------
-- Funções de apoio
-- ---------------------------------------------------------------------------

create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.materias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topicos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  materia_id uuid not null references public.materias (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  status text not null default 'nao_visto'
    check (status in ('nao_visto', 'teoria', 'questoes', 'revisado')),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bisus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  materia_id uuid not null references public.materias (id) on delete cascade,
  topico_id uuid references public.topicos (id) on delete set null,
  texto text not null check (length(trim(texto)) > 0),
  professor text,
  fonte text not null default 'videoaula_gran'
    check (fonte in ('videoaula_gran', 'pdf_gran', 'comentario_tec', 'revisao_live', 'outro')),
  link text,
  cai_muito boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.escritas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  materia_id uuid references public.materias (id) on delete set null,
  topico_id uuid references public.topicos (id) on delete set null,
  formato text not null
    check (formato in ('pratica_tecnica', 'feynman', 'folha_branca', 'lei_seca', 'banca')),
  titulo text,
  conteudo jsonb not null default '{}'::jsonb,
  lacunas text,
  dominio smallint check (dominio between 1 and 5),
  palavras integer not null default 0,
  rascunho boolean not null default true,
  correcao_ia text,
  corrigida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.escrita_versoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  escrita_id uuid not null references public.escritas (id) on delete cascade,
  conteudo jsonb not null,
  lacunas text,
  dominio smallint,
  palavras integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.revisoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_tipo text not null check (item_tipo in ('escrita', 'erro', 'termo')),
  item_id uuid not null,
  nivel smallint not null default 0 check (nivel >= 0),
  proxima_data date not null,
  ultima_data date,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_tipo, item_id)
);

create table if not exists public.revisao_historico (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  revisao_id uuid not null references public.revisoes (id) on delete cascade,
  reescrita text,
  avaliacao text not null check (avaliacao in ('esqueci', 'parcial', 'bem')),
  nivel_antes smallint not null,
  nivel_depois smallint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sessoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  materia_id uuid references public.materias (id) on delete set null,
  topico_id uuid references public.topicos (id) on delete set null,
  atividade text not null
    check (atividade in ('questoes_tec', 'videoaula_gran', 'pdf_gran', 'lei_seca', 'revisao', 'escrita', 'simulado')),
  minutos integer not null default 0 check (minutos >= 0),
  questoes integer not null default 0 check (questoes >= 0),
  acertos integer not null default 0 check (acertos >= 0),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint acertos_ate_questoes check (acertos <= questoes)
);

create table if not exists public.erros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  materia_id uuid references public.materias (id) on delete set null,
  topico_id uuid references public.topicos (id) on delete set null,
  assertiva text not null check (length(trim(assertiva)) > 0),
  gabarito text not null check (gabarito in ('certo', 'errado', 'multipla')),
  motivo text not null
    check (motivo in ('nao_sabia', 'confundi', 'interpretacao', 'pegadinha', 'chutei')),
  regra text,
  link_tec text,
  revisado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.termos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  termo text not null check (length(trim(termo)) > 0),
  extenso text,
  pratica text,
  tecnica text,
  materia_ids uuid[] not null default '{}',
  dispositivo text,
  tags text[] not null default '{}',
  status text not null default 'aprendendo' check (status in ('aprendendo', 'ja_sei')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Não confundir com": guardamos as duas direções (A→B e B→A).
create table if not exists public.termos_relacionados (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  termo_id uuid not null references public.termos (id) on delete cascade,
  relacionado_id uuid not null references public.termos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (termo_id, relacionado_id),
  check (termo_id <> relacionado_id)
);

create table if not exists public.configuracoes (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nome text,
  data_prova date,
  meta_semanal_horas numeric(5, 1) not null default 15 check (meta_semanal_horas >= 0),
  anotacoes_metodos text,
  ultimo_professor text,
  pomodoro jsonb not null default '{"foco": 25, "pausa": 5, "pausa_longa": 15, "ciclos": 4}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices (cada consulta filtra por user_id; chaves estrangeiras indexadas)
-- ---------------------------------------------------------------------------

create index if not exists materias_user_idx on public.materias (user_id, ordem);
create index if not exists topicos_user_idx on public.topicos (user_id);
create index if not exists topicos_materia_idx on public.topicos (materia_id, ordem);
create index if not exists bisus_user_idx on public.bisus (user_id, created_at desc);
create index if not exists bisus_materia_idx on public.bisus (materia_id);
create index if not exists bisus_topico_idx on public.bisus (topico_id);
create index if not exists escritas_user_idx on public.escritas (user_id, updated_at desc);
create index if not exists escritas_materia_idx on public.escritas (materia_id);
create index if not exists escritas_topico_idx on public.escritas (topico_id);
create index if not exists escrita_versoes_escrita_idx on public.escrita_versoes (escrita_id, created_at desc);
create index if not exists escrita_versoes_user_idx on public.escrita_versoes (user_id);
create index if not exists revisoes_fila_idx on public.revisoes (user_id, proxima_data) where ativa;
create index if not exists revisao_historico_revisao_idx on public.revisao_historico (revisao_id, created_at desc);
create index if not exists revisao_historico_user_idx on public.revisao_historico (user_id);
create index if not exists sessoes_user_data_idx on public.sessoes (user_id, data desc);
create index if not exists sessoes_materia_idx on public.sessoes (materia_id);
create index if not exists sessoes_topico_idx on public.sessoes (topico_id);
create index if not exists erros_user_idx on public.erros (user_id, created_at desc);
create index if not exists erros_materia_idx on public.erros (materia_id);
create index if not exists erros_topico_idx on public.erros (topico_id);
create index if not exists termos_user_idx on public.termos (user_id, termo);
create index if not exists termos_rel_user_idx on public.termos_relacionados (user_id);
create index if not exists termos_rel_relacionado_idx on public.termos_relacionados (relacionado_id);

-- ---------------------------------------------------------------------------
-- updated_at automático, RLS e permissões
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'materias', 'topicos', 'bisus', 'escritas', 'revisoes', 'sessoes', 'erros', 'termos', 'configuracoes'
  ] loop
    execute format('drop trigger if exists tocar_updated_at on public.%I', t);
    execute format(
      'create trigger tocar_updated_at before update on public.%I
       for each row execute function public.tocar_updated_at()', t);
  end loop;

  foreach t in array array[
    'materias', 'topicos', 'bisus', 'escritas', 'escrita_versoes', 'revisoes', 'revisao_historico',
    'sessoes', 'erros', 'termos', 'termos_relacionados', 'configuracoes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format(
      'create policy "dono" on public.%I for all to authenticated
       using ((select auth.uid()) = user_id)
       with check ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Edital inicial: roda uma vez por conta, no primeiro acesso ao app.
-- SECURITY INVOKER: grava como o próprio usuário, então o RLS vale normalmente.
-- ---------------------------------------------------------------------------

create or replace function public.semear_edital()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  edital jsonb := $edital$[
    {"nome": "Língua Portuguesa", "topicos": [
      "Interpretação de textos", "Tipologia e gêneros textuais", "Ortografia e acentuação",
      "Classes de palavras", "Concordância verbal e nominal", "Regência e crase", "Pontuação",
      "Colocação pronominal", "Coesão e coerência", "Reescrita de frases", "Redação oficial"]},
    {"nome": "Direito Constitucional", "topicos": [
      "Princípios fundamentais", "Direitos e garantias fundamentais (art. 5º)", "Remédios constitucionais",
      "Direitos sociais, nacionalidade e direitos políticos", "Organização do Estado",
      "Administração Pública (arts. 37 a 41)", "Poder Legislativo e processo legislativo", "Poder Executivo",
      "Poder Judiciário (arts. 92 a 126)", "Funções essenciais à Justiça", "Controle de constitucionalidade"]},
    {"nome": "Direito Administrativo", "topicos": [
      "Princípios", "Organização administrativa", "Poderes", "Atos administrativos", "Agentes públicos",
      "Licitações (Lei 14.133/2021)", "Contratos", "Serviços públicos", "Controle",
      "Responsabilidade civil do Estado", "Improbidade (Lei 8.429/1992)", "Processo administrativo (Lei 9.784/1999)"]},
    {"nome": "Legislação do TJDFT e dos servidores", "topicos": [
      "Lei 8.112/1990: provimento e vacância", "Lei 8.112/1990: direitos e vantagens",
      "Lei 8.112/1990: regime disciplinar e PAD", "Lei 11.416/2006",
      "Lei 11.697/2008 (organização judiciária do DF)", "Regimento Interno do TJDFT",
      "Lei 13.146/2015", "Resoluções do CNJ"]},
    {"nome": "Direito Processual Civil", "topicos": [
      "Normas fundamentais", "Jurisdição e competência", "Partes e litisconsórcio", "Intervenção de terceiros",
      "Atos e prazos", "Tutela provisória", "Procedimento comum", "Sentença e coisa julgada", "Recursos",
      "Cumprimento de sentença", "Juizados Especiais Cíveis"]},
    {"nome": "Direito Processual Penal", "topicos": [
      "Inquérito", "Ação penal", "Competência", "Provas", "Prisão e cautelares", "Citações e intimações",
      "Procedimentos", "Sentença", "Recursos", "Juizados Especiais Criminais"]},
    {"nome": "Direito Penal", "topicos": [
      "Aplicação da lei penal", "Teoria do crime", "Imputabilidade", "Concurso de pessoas", "Penas",
      "Extinção da punibilidade", "Crimes contra a Administração Pública"]},
    {"nome": "Direito Civil", "topicos": [
      "LINDB", "Pessoas", "Bens", "Fatos e negócios jurídicos", "Prescrição e decadência", "Obrigações",
      "Contratos (parte geral)"]}
  ]$edital$::jsonb;
  m jsonb;
  m_ordem integer := 0;
  m_id uuid;
begin
  if uid is null then
    raise exception 'É preciso estar logada para preparar o edital.';
  end if;

  insert into public.configuracoes (user_id) values (uid) on conflict (user_id) do nothing;

  if exists (select 1 from public.materias where user_id = uid) then
    return;
  end if;

  for m in select * from jsonb_array_elements(edital) loop
    insert into public.materias (user_id, nome, ordem)
    values (uid, m ->> 'nome', m_ordem)
    returning id into m_id;

    insert into public.topicos (user_id, materia_id, nome, ordem)
    select uid, m_id, t.nome, (t.ordem - 1)::integer
    from jsonb_array_elements_text(m -> 'topicos') with ordinality as t (nome, ordem);

    m_ordem := m_ordem + 1;
  end loop;
end;
$$;

revoke execute on function public.semear_edital() from public, anon;
grant execute on function public.semear_edital() to authenticated;
