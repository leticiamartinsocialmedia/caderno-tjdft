-- Caderno TJDFT · 0005: simulados com as provas anteriores do TJDFT
-- Rode depois do 0004. Pode rodar de novo sem estragar nada.
--
-- Provas, textos e questões são um banco comum, só de leitura no app (as questões entram por SQL,
-- transcritas dos cadernos oficiais das bancas). Tentativas e respostas são de cada conta.

create table if not exists public.simulado_provas (
  id text primary key, -- ex.: 'tjdft-2022-fgv-tecnico-adm'
  orgao text not null,
  ano integer not null,
  banca text not null,
  cargo text not null,
  estilo text not null check (estilo in ('multipla', 'certo_errado')),
  duracao_min integer not null,
  -- Como a banca pontua: na múltipla escolha cada acerto vale 1; no Cebraspe, cada erro anula um acerto.
  errada_desconta boolean not null default false,
  -- Blocos na ordem do caderno: [{"nome": "Conhecimentos Básicos", "de": 1, "ate": 20}, ...]
  estrutura jsonb not null default '[]',
  discursiva text, -- tema e instruções da redação, quando houver
  fonte text not null, -- de onde o caderno e o gabarito foram transcritos
  ordem integer not null default 0
);

create table if not exists public.simulado_textos (
  id text primary key, -- ex.: 'tjdft-2022-fgv-tecnico-adm/texto-1'
  prova_id text not null references public.simulado_provas (id) on delete cascade,
  titulo text,
  conteudo text not null
);

create table if not exists public.simulado_questoes (
  id text primary key, -- ex.: 'tjdft-2022-fgv-tecnico-adm/12'
  prova_id text not null references public.simulado_provas (id) on delete cascade,
  numero integer not null,
  bloco text not null,
  materia text not null, -- nome da matéria como no edital (liga com o Edital do app)
  assunto text not null,
  texto_id text references public.simulado_textos (id) on delete set null,
  enunciado text not null,
  alternativas jsonb, -- [{"letra": "A", "texto": "..."}]; null nas de certo/errado
  gabarito text not null check (gabarito in ('A', 'B', 'C', 'D', 'E', 'CERTO', 'ERRADO')),
  anulada boolean not null default false,
  unique (prova_id, numero)
);

create index if not exists simulado_questoes_filtro_idx on public.simulado_questoes (materia, assunto);

create table if not exists public.simulado_tentativas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  modo text not null check (modo in ('prova', 'treino')),
  prova_id text references public.simulado_provas (id) on delete set null, -- só no modo prova
  titulo text not null,
  questao_ids text[] not null,
  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz,
  segundos integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.simulado_respostas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tentativa_id uuid not null references public.simulado_tentativas (id) on delete cascade,
  questao_id text not null references public.simulado_questoes (id) on delete cascade,
  resposta text check (resposta in ('A', 'B', 'C', 'D', 'E', 'CERTO', 'ERRADO')), -- null = em branco
  marcada_para_revisar boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tentativa_id, questao_id)
);

create index if not exists simulado_tentativas_user_idx on public.simulado_tentativas (user_id, iniciada_em desc);
create index if not exists simulado_respostas_tentativa_idx on public.simulado_respostas (tentativa_id);
create index if not exists simulado_respostas_user_idx on public.simulado_respostas (user_id, questao_id);

-- Banco de questões: todo mundo logado lê; ninguém grava pelo app.
do $$
declare
  t text;
begin
  foreach t in array array['simulado_provas', 'simulado_textos', 'simulado_questoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists "leitura" on public.%I', t);
    execute format('create policy "leitura" on public.%I for select to authenticated using (true)', t);
    -- Tempo real: quando as questões forem carregadas, as provas aparecem sem recarregar a página.
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;

  foreach t in array array['simulado_tentativas', 'simulado_respostas'] loop
    execute format('drop trigger if exists tocar_updated_at on public.%I', t);
    execute format('create trigger tocar_updated_at before update on public.%I for each row execute function public.tocar_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format(
      'create policy "dono" on public.%I for all to authenticated
       using ((select auth.uid()) = user_id)
       with check ((select auth.uid()) = user_id)', t);
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
