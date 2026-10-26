-- Caderno TJDFT · 0004: cronograma de estudos (importado do Gran ou montado à mão)
-- Rode depois do 0003. Pode rodar de novo sem estragar nada.

create table if not exists public.cronograma (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  ordem integer not null default 0,
  -- Nome da disciplina como vem do Gran (ex.: "Noções de Direito Penal"); a matéria do edital é ligada quando o nome bate.
  disciplina text not null check (length(trim(disciplina)) > 0),
  aula text not null check (length(trim(aula)) > 0),
  tipo text not null default 'videoaula' check (tipo in ('videoaula', 'pdf', 'questoes', 'revisao', 'outro')),
  materia_id uuid references public.materias (id) on delete set null,
  topico_id uuid references public.topicos (id) on delete set null,
  link text,
  concluido boolean not null default false,
  concluido_em timestamptz,
  origem text not null default 'manual' check (origem in ('gran', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, data, disciplina, aula)
);

create index if not exists cronograma_dia_idx on public.cronograma (user_id, data, ordem);
create index if not exists cronograma_pendentes_idx on public.cronograma (user_id, data) where not concluido;
create index if not exists cronograma_materia_idx on public.cronograma (materia_id);
create index if not exists cronograma_topico_idx on public.cronograma (topico_id);

do $$
begin
  drop trigger if exists tocar_updated_at on public.cronograma;
  create trigger tocar_updated_at before update on public.cronograma for each row execute function public.tocar_updated_at();
  alter table public.cronograma enable row level security;
  revoke all on public.cronograma from anon;
  grant select, insert, update, delete on public.cronograma to authenticated;
  drop policy if exists "dono" on public.cronograma;
  create policy "dono" on public.cronograma for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cronograma') then
    alter publication supabase_realtime add table public.cronograma;
  end if;
end;
$$;
